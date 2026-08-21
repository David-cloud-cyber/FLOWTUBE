-- Commit the terminal generation state and its reserved credit transaction in
-- one database transaction. A completed row can never exist without a closed
-- credit reservation after this migration.

create or replace function public.complete_generation_with_result(
  p_generation_id uuid,
  p_result_url text,
  p_provider_payload jsonb default '{}'::jsonb,
  p_provider_cost_usd numeric default null
)
returns table(finalized boolean, balance_after integer, credits integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  generation_row public.generations%rowtype;
  profile_row public.profiles%rowtype;
  next_balance integer;
begin
  if nullif(trim(coalesce(p_result_url, '')), '') is null then
    raise exception 'A verified result URL is required';
  end if;

  select * into generation_row
  from public.generations
  where id = p_generation_id
  for update;
  if not found then
    return query select false, 0, 0;
    return;
  end if;

  select coalesce(p.credits, 0) into next_balance
  from public.profiles p
  where p.id = generation_row.user_id;

  if generation_row.status = 'completed' and generation_row.debited_at is not null then
    return query select false, coalesce(next_balance, 0), generation_row.credits;
    return;
  end if;
  if generation_row.status not in ('pending', 'running', 'completed') then
    return query select false, coalesce(next_balance, 0), generation_row.credits;
    return;
  end if;

  if generation_row.reserved_credits > 0 then
    update public.credit_transactions
    set reason = 'generation_completed',
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('reserved_then_completed', true)
    where generation_id = generation_row.id
      and reason = 'generation_reserved';
  elsif generation_row.debited_at is null and generation_row.credits > 0 then
    select * into profile_row
    from public.profiles
    where id = generation_row.user_id
    for update;
    if not found then
      raise exception 'Generation owner profile not found';
    end if;
    next_balance := greatest(0, profile_row.credits - generation_row.credits);
    update public.profiles
    set credits = next_balance, updated_at = now()
    where id = generation_row.user_id;
    insert into public.credit_transactions (
      user_id, generation_id, amount, reason, balance_after, metadata
    ) values (
      generation_row.user_id,
      generation_row.id,
      -generation_row.credits,
      'generation_completed',
      next_balance,
      jsonb_build_object('legacy_generation', true, 'pricing_model_id', coalesce(generation_row.pricing_model_id, generation_row.model_id))
    );
  end if;

  update public.generations
  set status = 'completed',
      progress = 100,
      result_url = p_result_url,
      provider_payload = coalesce(p_provider_payload, '{}'::jsonb),
      cost_usd = case when p_provider_cost_usd is not null and p_provider_cost_usd >= 0 then p_provider_cost_usd else cost_usd end,
      completed_at = now(),
      debited_at = coalesce(debited_at, now()),
      credits_released_at = case when reserved_credits > 0 then now() else credits_released_at end,
      reserved_credits = 0,
      updated_at = now()
  where id = generation_row.id;

  return query select true, coalesce(next_balance, 0), generation_row.credits;
end;
$$;

revoke all on function public.complete_generation_with_result(uuid, text, jsonb, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_generation_with_result(uuid, text, jsonb, numeric)
  to service_role;
