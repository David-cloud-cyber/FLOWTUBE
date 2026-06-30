alter table public.profiles
  alter column credits set default 100,
  alter column credits_max set default 100;

update public.pricing_plans
set active = false,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('hidden_alias', true)
where id in ('starter', 'studio');
