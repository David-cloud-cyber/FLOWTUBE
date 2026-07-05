-- These tables are written by trusted server/webhook code only.
-- Keep RLS explicit with deny-all user policies so service_role remains the only writer.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'payment_events'
      and policyname = 'payment_events_service_only'
  ) then
    create policy payment_events_service_only
      on public.payment_events
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'rate_limit_events'
      and policyname = 'rate_limit_events_service_only'
  ) then
    create policy rate_limit_events_service_only
      on public.rate_limit_events
      for all
      to authenticated
      using (false)
      with check (false);
  end if;
end $$;
