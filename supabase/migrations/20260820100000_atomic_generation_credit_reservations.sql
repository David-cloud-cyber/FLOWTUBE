-- Reserve generation credits before a provider job starts. The reservation
-- closes the race where two concurrent jobs both pass the balance pre-check.

alter table public.generations
  add column if not exists reserved_credits integer not null default 0,
  add column if not exists credits_reserved_at timestamptz,
  add column if not exists credits_released_at timestamptz;

create index if not exists generations_reserved_credits_idx
  on public.generations(user_id, reserved_credits)
  where reserved_credits > 0;

create unique index if not exists credit_transactions_generation_reserved_unique
  on public.credit_transactions (generation_id)
  where reason = 'generation_reserved' and generation_id is not null;

create or replace function public.reserve_generation_credits(p_generation_id uuid)
returns table(reserved boolean, balance_after integer, credits integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generation_row public.generations%rowtype;
  profile_row public.profiles%rowtype;
  next_credits integer;
begin
  select * into generation_row
  from public.generations
  where id = p_generation_id
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  if generation_row.reserved_credits > 0 then
    select p.credits into balance_after
    from public.profiles p
    where p.id = generation_row.user_id;
    return query select true, coalesce(balance_after, 0), generation_row.reserved_credits;
    return;
  end if;

  if generation_row.status <> 'pending' or generation_row.credits <= 0 then
    select p.credits into balance_after
    from public.profiles p
    where p.id = generation_row.user_id;
    return query select false, coalesce(balance_after, 0), greatest(0, generation_row.credits);
    return;
  end if;

  select * into profile_row
  from public.profiles
  where id = generation_row.user_id
  for update;

  if not found then
    return query select false, 0, generation_row.credits;
    return;
  end if;

  if profile_row.credits < generation_row.credits then
    return query select false, profile_row.credits, generation_row.credits;
    return;
  end if;

  next_credits := profile_row.credits - generation_row.credits;
  update public.profiles
  set credits = next_credits, updated_at = now()
  where id = generation_row.user_id;

  insert into public.credit_transactions (
    user_id, generation_id, amount, reason, balance_after, metadata
  ) values (
    generation_row.user_id,
    generation_row.id,
    -generation_row.credits,
    'generation_reserved',
    next_credits,
    jsonb_build_object(
      'reservation', true,
      'pricing_model_id', coalesce(generation_row.pricing_model_id, generation_row.model_id)
    )
  );

  update public.generations
  set reserved_credits = generation_row.credits,
      credits_reserved_at = now(),
      credits_released_at = null,
      updated_at = now()
  where id = generation_row.id;

  return query select true, next_credits, generation_row.credits;
exception
  when unique_violation then
    select p.credits into balance_after
    from public.profiles p
    where p.id = generation_row.user_id;
    return query select true, coalesce(balance_after, 0), generation_row.credits;
end;
$$;

create or replace function public.debit_completed_generation(p_generation_id uuid)
returns table(charged boolean, balance_after integer, credits integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generation_row public.generations%rowtype;
  profile_balance integer;
begin
  select * into generation_row
  from public.generations
  where id = p_generation_id
  for update;

  if not found then
    return query select false, 0, 0;
    return;
  end if;

  select coalesce(p.credits, 0) into profile_balance
  from public.profiles p
  where p.id = generation_row.user_id;

  if generation_row.status <> 'completed' or generation_row.debited_at is not null then
    return query select false, coalesce(profile_balance, 0), coalesce(generation_row.credits, 0);
    return;
  end if;

  if generation_row.reserved_credits > 0 then
    update public.credit_transactions
    set reason = 'generation_completed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('reserved_then_completed', true)
    where generation_id = generation_row.id
      and reason = 'generation_reserved';

    update public.generations
    set debited_at = now(),
        credits_released_at = now(),
        reserved_credits = 0,
        updated_at = now()
    where id = generation_row.id;

    return query select true, coalesce(profile_balance, 0), generation_row.credits;
    return;
  end if;

  -- Legacy generations created before reservations remain chargeable exactly
  -- once, preserving historical behavior while new jobs use the reservation.
  declare
    profile_row public.profiles%rowtype;
    next_credits integer;
  begin
    select * into profile_row
    from public.profiles
    where id = generation_row.user_id
    for update;

    if not found then
      return query select false, 0, generation_row.credits;
      return;
    end if;

    next_credits := greatest(0, profile_row.credits - generation_row.credits);
    update public.profiles
    set credits = next_credits, updated_at = now()
    where id = generation_row.user_id;

    insert into public.credit_transactions (
      user_id, generation_id, amount, reason, balance_after, metadata
    ) values (
      generation_row.user_id,
      generation_row.id,
      -generation_row.credits,
      'generation_completed',
      next_credits,
      jsonb_build_object('legacy_generation', true, 'pricing_model_id', coalesce(generation_row.pricing_model_id, generation_row.model_id))
    );

    update public.generations
    set debited_at = now(), updated_at = now()
    where id = generation_row.id;

    return query select true, next_credits, generation_row.credits;
  end;
end;
$$;

create or replace function public.refund_failed_generation(p_generation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generation_row public.generations%rowtype;
  profile_row public.profiles%rowtype;
  refund_credits integer;
  next_credits integer;
begin
  select * into generation_row
  from public.generations
  where id = p_generation_id
  for update;

  if not found
     or generation_row.failure_refunded_at is not null
     or generation_row.credits <= 0 then
    return false;
  end if;

  refund_credits := case
    when generation_row.reserved_credits > 0 then generation_row.reserved_credits
    when generation_row.debited_at is not null then generation_row.credits
    else 0
  end;
  if refund_credits <= 0 then
    return false;
  end if;

  select * into profile_row
  from public.profiles
  where id = generation_row.user_id
  for update;
  if not found then
    return false;
  end if;

  next_credits := profile_row.credits + refund_credits;
  update public.profiles
  set credits = next_credits, updated_at = now()
  where id = generation_row.user_id;

  insert into public.credit_transactions (
    user_id, generation_id, amount, reason, balance_after, metadata
  ) values (
    generation_row.user_id,
    generation_row.id,
    refund_credits,
    'generation_refunded',
    next_credits,
    jsonb_build_object(
      'failed_status', generation_row.status,
      'reserved_credits', generation_row.reserved_credits,
      'provider_cost_usd', coalesce(generation_row.cost_usd, 0)
    )
  );

  update public.generations
  set failure_refunded_at = now(),
      refunded_at = now(),
      reserved_credits = 0,
      credits_released_at = now(),
      updated_at = now()
  where id = generation_row.id;

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.reserve_generation_credits(uuid) from public, anon, authenticated;
revoke all on function public.debit_completed_generation(uuid) from public, anon, authenticated;
revoke all on function public.refund_failed_generation(uuid) from public, anon, authenticated;
grant execute on function public.reserve_generation_credits(uuid) to service_role;
grant execute on function public.debit_completed_generation(uuid) to service_role;
grant execute on function public.refund_failed_generation(uuid) to service_role;
