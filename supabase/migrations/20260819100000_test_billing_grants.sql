-- Reversible, non-payment test access for explicitly allow-listed environments.
-- This table is service-role only and never participates in checkout or renewals.
create table if not exists public.billing_test_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null check (plan_id = 'pro'),
  credit_option_id text,
  granted_credits integer not null check (granted_credits > 0),
  previous_plan text not null,
  previous_credits integer not null check (previous_credits >= 0),
  previous_credits_max integer not null check (previous_credits_max > 0),
  previous_billing_status text,
  previous_period_end timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists billing_test_grants_active_user_unique
  on public.billing_test_grants(user_id)
  where status = 'active';

create index if not exists billing_test_grants_user_created_idx
  on public.billing_test_grants(user_id, created_at desc);

alter table public.billing_test_grants enable row level security;
revoke all on public.billing_test_grants from public, anon, authenticated;
grant all on public.billing_test_grants to service_role;

create or replace function public.activate_billing_test_grant(
  p_user_id uuid,
  p_plan_id text,
  p_credit_option_id text,
  p_granted_credits integer,
  p_idempotency_key text
)
returns table(
  grant_id uuid,
  active boolean,
  plan_id text,
  credits integer,
  status text,
  previous_plan text,
  previous_credits integer
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.profiles%rowtype;
  existing_grant public.billing_test_grants%rowtype;
  new_grant public.billing_test_grants%rowtype;
  normalized_key text := nullif(trim(p_idempotency_key), '');
begin
  if p_plan_id <> 'pro' or p_granted_credits <> 1500 or normalized_key is null then
    raise exception using message = 'invalid_test_grant';
  end if;

  select * into existing_grant
  from public.billing_test_grants
  where idempotency_key = normalized_key
  limit 1;

  if found then
    return query select existing_grant.id, existing_grant.status = 'active',
      existing_grant.plan_id, existing_grant.granted_credits, existing_grant.status,
      existing_grant.previous_plan, existing_grant.previous_credits;
    return;
  end if;

  select * into existing_grant
  from public.billing_test_grants as active_grant
  where active_grant.user_id = p_user_id and active_grant.status = 'active'
  for update;

  if found then
    raise exception using message = 'test_grant_already_active';
  end if;

  select * into profile_row
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception using message = 'profile_not_found';
  end if;

  if lower(coalesce(profile_row.plan, 'free')) not in ('free', 'basic', 'creator')
    or lower(coalesce(profile_row.billing_status, 'trialing')) in ('active', 'paid', 'past_due')
    or exists (
      select 1 from public.subscriptions as active_subscription
      where active_subscription.user_id = p_user_id
        and active_subscription.status in ('active', 'trialing')
    ) then
    raise exception using message = 'paid_account_not_eligible';
  end if;

  insert into public.billing_test_grants (
    user_id, plan_id, credit_option_id, granted_credits,
    previous_plan, previous_credits, previous_credits_max,
    previous_billing_status, previous_period_end, idempotency_key,
    metadata
  ) values (
    p_user_id, 'pro', nullif(p_credit_option_id, ''), 1500,
    profile_row.plan, profile_row.credits, profile_row.credits_max,
    profile_row.billing_status, profile_row.current_period_end, normalized_key,
    jsonb_build_object('source', 'test_access', 'payment_required', false)
  ) returning * into new_grant;

  update public.profiles
  set plan = 'pro',
      credits = 1500,
      credits_max = 1500,
      billing_status = 'test_active',
      current_period_end = null,
      updated_at = now()
  where id = p_user_id;

  insert into public.credit_transactions (
    user_id, amount, reason, balance_after, metadata
  ) values (
    p_user_id,
    1500 - profile_row.credits,
    'test_plan_grant',
    1500,
    jsonb_build_object(
      'grant_id', new_grant.id,
      'grant_key', normalized_key,
      'plan_id', 'pro',
      'credits', 1500,
      'payment_required', false
    )
  );

  return query select new_grant.id, true, new_grant.plan_id, new_grant.granted_credits,
    new_grant.status, new_grant.previous_plan, new_grant.previous_credits;
exception
  when unique_violation then
    select * into existing_grant
    from public.billing_test_grants
    where idempotency_key = normalized_key
    limit 1;
    if found then
      return query select existing_grant.id, existing_grant.status = 'active',
        existing_grant.plan_id, existing_grant.granted_credits, existing_grant.status,
        existing_grant.previous_plan, existing_grant.previous_credits;
      return;
    end if;
    raise;
end;
$$;

create or replace function public.revoke_billing_test_grant(p_user_id uuid)
returns table(
  grant_id uuid,
  revoked boolean,
  plan_id text,
  credits integer,
  status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  grant_row public.billing_test_grants%rowtype;
  profile_row public.profiles%rowtype;
begin
  select * into grant_row
  from public.billing_test_grants as active_grant
  where active_grant.user_id = p_user_id and active_grant.status = 'active'
  order by created_at desc
  limit 1
  for update;

  if not found then
    select p.* into profile_row from public.profiles p where p.id = p_user_id;
    return query select null::uuid, false,
      coalesce(profile_row.plan, 'free'), coalesce(profile_row.credits, 0), 'none';
    return;
  end if;

  select * into profile_row from public.profiles where id = p_user_id for update;

  update public.profiles
  set plan = grant_row.previous_plan,
      credits = grant_row.previous_credits,
      credits_max = grant_row.previous_credits_max,
      billing_status = grant_row.previous_billing_status,
      current_period_end = grant_row.previous_period_end,
      updated_at = now()
  where id = p_user_id;

  insert into public.credit_transactions (
    user_id, amount, reason, balance_after, metadata
  ) values (
    p_user_id,
    grant_row.previous_credits - coalesce(profile_row.credits, 0),
    'test_plan_revoke',
    grant_row.previous_credits,
    jsonb_build_object('grant_id', grant_row.id, 'plan_id', grant_row.plan_id)
  );

  update public.billing_test_grants
  set status = 'revoked', revoked_at = now()
  where id = grant_row.id;

  return query select grant_row.id, true, grant_row.previous_plan,
    grant_row.previous_credits, 'revoked';
end;
$$;

revoke all on function public.activate_billing_test_grant(uuid, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.revoke_billing_test_grant(uuid) from public, anon, authenticated;
grant execute on function public.activate_billing_test_grant(uuid, text, text, integer, text) to service_role;
grant execute on function public.revoke_billing_test_grant(uuid) to service_role;
