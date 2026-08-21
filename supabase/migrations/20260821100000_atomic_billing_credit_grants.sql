-- Complete billing credit grants under a profile row lock. This prevents two
-- concurrent payment callbacks from crediting the same checkout twice.

create unique index if not exists credit_transactions_billing_grant_unique
  on public.credit_transactions (user_id, ((metadata->>'grant_key')))
  where reason in ('subscription_renewal', 'credit_pack_purchase')
    and metadata ? 'grant_key';

create or replace function public.grant_billing_credits(
  p_user_id uuid,
  p_credits integer,
  p_grant_key text,
  p_reason text,
  p_plan_id text default null,
  p_interval text default null,
  p_subscription_id text default null,
  p_period_end timestamptz default null,
  p_credit_option_id text default null,
  p_source text default 'billing',
  p_metadata jsonb default '{}'::jsonb
)
returns table(granted boolean, balance_after integer, credits_granted integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.profiles%rowtype;
  existing_balance integer;
  next_balance integer;
  normalized_key text := nullif(trim(coalesce(p_grant_key, '')), '');
  normalized_reason text := trim(coalesce(p_reason, ''));
  normalized_interval text := case when p_interval = 'annual' then 'annual' else 'monthly' end;
  normalized_subscription_id text;
begin
  if p_credits <= 0 or normalized_key is null then
    raise exception 'Invalid billing grant';
  end if;
  if normalized_reason not in ('subscription_renewal', 'credit_pack_purchase') then
    raise exception 'Invalid billing grant reason';
  end if;

  select ct.balance_after into existing_balance
  from public.credit_transactions ct
  where ct.user_id = p_user_id
    and ct.reason = normalized_reason
    and ct.metadata->>'grant_key' = normalized_key
  order by ct.created_at desc
  limit 1;
  if found then
    return query select false, coalesce(existing_balance, 0), p_credits;
    return;
  end if;

  select * into profile_row
  from public.profiles
  where id = p_user_id
  for update;
  if not found then
    raise exception 'Billing profile not found';
  end if;

  -- Recheck after acquiring the user lock. Separate callbacks for the same
  -- account are serialized from this point onward.
  select ct.balance_after into existing_balance
  from public.credit_transactions ct
  where ct.user_id = p_user_id
    and ct.reason = normalized_reason
    and ct.metadata->>'grant_key' = normalized_key
  order by ct.created_at desc
  limit 1;
  if found then
    return query select false, coalesce(existing_balance, profile_row.credits), p_credits;
    return;
  end if;

  next_balance := coalesce(profile_row.credits, 0) + p_credits;
  update public.profiles
  set credits = next_balance,
      credits_max = greatest(coalesce(credits_max, 0), next_balance),
      plan = case when p_plan_id is not null then p_plan_id else plan end,
      billing_status = case when p_plan_id is not null then 'active' else billing_status end,
      current_period_end = case when p_plan_id is not null then p_period_end else current_period_end end,
      updated_at = now()
  where id = p_user_id;

  if p_plan_id is not null then
    normalized_subscription_id := coalesce(
      nullif(trim(coalesce(p_subscription_id, '')), ''),
      p_source || ':' || normalized_key
    );
    insert into public.subscriptions (
      user_id,
      plan_id,
      stripe_subscription_id,
      status,
      billing_interval,
      current_period_end,
      metadata
    ) values (
      p_user_id,
      p_plan_id,
      normalized_subscription_id,
      'active',
      normalized_interval,
      p_period_end,
      jsonb_build_object('source', p_source, 'credit_option_id', p_credit_option_id)
        || coalesce(p_metadata, '{}'::jsonb)
    )
    on conflict (stripe_subscription_id) do update set
      user_id = excluded.user_id,
      plan_id = excluded.plan_id,
      status = 'active',
      billing_interval = excluded.billing_interval,
      current_period_end = excluded.current_period_end,
      metadata = coalesce(public.subscriptions.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now();
  end if;

  insert into public.credit_transactions (
    user_id,
    amount,
    reason,
    balance_after,
    metadata
  ) values (
    p_user_id,
    p_credits,
    normalized_reason,
    next_balance,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'grant_key', normalized_key,
      'source', p_source,
      'plan_id', p_plan_id,
      'interval', case when p_plan_id is null then null else normalized_interval end,
      'subscription_id', p_subscription_id,
      'credit_option_id', p_credit_option_id
    )
  );

  return query select true, next_balance, p_credits;
exception
  when unique_violation then
    select ct.balance_after into existing_balance
    from public.credit_transactions ct
    where ct.user_id = p_user_id
      and ct.reason = normalized_reason
      and ct.metadata->>'grant_key' = normalized_key
    order by ct.created_at desc
    limit 1;
    return query select false, coalesce(existing_balance, 0), p_credits;
end;
$$;

revoke all on function public.grant_billing_credits(uuid, integer, text, text, text, text, text, timestamptz, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.grant_billing_credits(uuid, integer, text, text, text, text, text, timestamptz, text, text, jsonb)
  to service_role;

-- Checkout rows contain provider reconciliation data and immutable pricing
-- snapshots. They are served through the billing API, not direct table reads.
revoke select on public.billing_checkout_sessions from authenticated;
