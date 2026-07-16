-- Make failed-generation refunds idempotent and atomic.
create unique index if not exists credit_transactions_generation_refunded_unique
  on public.credit_transactions (generation_id)
  where reason = 'generation_refunded' and generation_id is not null;

create or replace function public.refund_failed_generation(p_generation_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  generation_row public.generations%rowtype;
  profile_row public.profiles%rowtype;
  next_credits integer;
  now_value timestamptz := now();
begin
  select * into generation_row
  from public.generations
  where id = p_generation_id
  for update;

  if not found
     or generation_row.debited_at is null
     or generation_row.failure_refunded_at is not null
     or generation_row.credits <= 0 then
    return false;
  end if;

  select * into profile_row
  from public.profiles
  where id = generation_row.user_id
  for update;

  if not found then
    return false;
  end if;

  next_credits := profile_row.credits + generation_row.credits;

  update public.profiles
  set credits = next_credits, updated_at = now_value
  where id = generation_row.user_id;

  insert into public.credit_transactions (
    user_id,
    generation_id,
    amount,
    reason,
    balance_after,
    metadata
  ) values (
    generation_row.user_id,
    generation_row.id,
    generation_row.credits,
    'generation_refunded',
    next_credits,
    jsonb_build_object(
      'failed_status', generation_row.status,
      'provider_cost_usd', coalesce(generation_row.cost_usd, 0)
    )
  );

  insert into public.pricing_audit_logs (
    user_id,
    generation_id,
    pricing_model_id,
    credits_charged,
    credit_floor_usd,
    retail_credit_usd,
    provider_cost_usd,
    status,
    metadata
  ) values (
    generation_row.user_id,
    generation_row.id,
    coalesce(generation_row.pricing_model_id, generation_row.model_id),
    generation_row.credits,
    coalesce(generation_row.credit_floor_usd, 0),
    coalesce(generation_row.retail_credit_usd, 0),
    coalesce(generation_row.cost_usd, 0),
    'refunded',
    jsonb_build_object('reason', 'generation_failed')
  );

  update public.generations
  set failure_refunded_at = now_value,
      refunded_at = now_value,
      updated_at = now_value
  where id = generation_row.id;

  return true;
end;
$$;

revoke all on function public.refund_failed_generation(uuid) from public, anon, authenticated;
grant execute on function public.refund_failed_generation(uuid) to service_role;
