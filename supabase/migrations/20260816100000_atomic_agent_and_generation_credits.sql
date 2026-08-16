-- Keep agent and media credit mutations atomic and retry-safe.
create unique index if not exists credit_transactions_agent_idempotency_unique
  on public.credit_transactions (user_id, (metadata->>'idempotency_key'))
  where reason = 'agent_message'
    and metadata ? 'idempotency_key';

create or replace function public.charge_agent_credits(
  p_user_id uuid,
  p_credits integer,
  p_idempotency_key text,
  p_metadata jsonb default '{}'::jsonb
)
returns table(charged boolean, balance_after integer, available integer, credits_max integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  profile_row public.profiles%rowtype;
  existing_transaction public.credit_transactions%rowtype;
  next_credits integer;
begin
  if p_credits <= 0 then
    select * into profile_row from public.profiles where id = p_user_id;
    return query select false,
      coalesce(profile_row.credits, 0),
      coalesce(profile_row.credits, 0),
      coalesce(profile_row.credits_max, 0);
    return;
  end if;

  select * into existing_transaction
  from public.credit_transactions
  where user_id = p_user_id
    and reason = 'agent_message'
    and metadata->>'idempotency_key' = nullif(p_idempotency_key, '')
  order by created_at desc
  limit 1;

  if found then
    select p.credits_max into credits_max from public.profiles p where p.id = p_user_id;
    return query select false,
      coalesce(existing_transaction.balance_after, 0),
      coalesce(existing_transaction.balance_after, 0),
      coalesce(credits_max, 0);
    return;
  end if;

  select * into profile_row
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    return query select false, 0, 0, 0;
    return;
  end if;

  if profile_row.credits < p_credits then
    return query select false, profile_row.credits, profile_row.credits, profile_row.credits_max;
    return;
  end if;

  next_credits := profile_row.credits - p_credits;
  update public.profiles
  set credits = next_credits, updated_at = now()
  where id = p_user_id;

  insert into public.credit_transactions (
    user_id, amount, reason, balance_after, metadata
  ) values (
    p_user_id,
    -p_credits,
    'agent_message',
    next_credits,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  return query select true, next_credits, next_credits, profile_row.credits_max;
exception
  when unique_violation then
    select ct.balance_after into balance_after
    from public.credit_transactions
    as ct
    where ct.user_id = p_user_id
      and ct.reason = 'agent_message'
      and ct.metadata->>'idempotency_key' = nullif(p_idempotency_key, '')
    order by ct.created_at desc
    limit 1;
    select p.credits_max into credits_max from public.profiles p where p.id = p_user_id;
    return query select false, coalesce(balance_after, 0), coalesce(balance_after, 0), coalesce(credits_max, 0);
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

  if generation_row.status <> 'completed' or generation_row.debited_at is not null then
    select coalesce((select p.credits from public.profiles p where p.id = generation_row.user_id), 0) into balance_after;
    return query select false, coalesce(balance_after, 0), coalesce(generation_row.credits, 0);
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

  -- A completed render is charged once. The floor prevents a negative balance
  -- if several older jobs completed before the credit guard was introduced.
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
    jsonb_build_object('pricing_model_id', coalesce(generation_row.pricing_model_id, generation_row.model_id))
  );

  update public.generations
  set debited_at = now(), updated_at = now()
  where id = generation_row.id;

  return query select true, next_credits, generation_row.credits;
end;
$$;

revoke all on function public.charge_agent_credits(uuid, integer, text, jsonb) from public, anon, authenticated;
revoke all on function public.debit_completed_generation(uuid) from public, anon, authenticated;
grant execute on function public.charge_agent_credits(uuid, integer, text, jsonb) to service_role;
grant execute on function public.debit_completed_generation(uuid) to service_role;
