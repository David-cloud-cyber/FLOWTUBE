-- product_events is written exclusively by trusted backend services.
-- Keep an explicit service-role policy so RLS intent is auditable without
-- granting browser clients any direct access.
drop policy if exists product_events_service_only on public.product_events;
create policy product_events_service_only on public.product_events
  for all to service_role
  using (true)
  with check (true);
