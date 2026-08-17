-- HuggyFlow launch pricing: three public plans and server-validated credit options.
alter table public.billing_checkout_sessions
  add column if not exists credit_option_id text,
  add column if not exists payment_phone text;

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_status_check;
alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_status_check
  check (status in ('created', 'open', 'pending', 'processing', 'completed', 'expired', 'cancelled', 'failed'));

create table if not exists public.pricing_plan_options (
  id text primary key,
  plan_id text not null references public.pricing_plans(id) on delete cascade,
  credits integer not null check (credits > 0),
  monthly_price_xof bigint not null check (monthly_price_xof >= 0),
  annual_price_xof bigint not null check (annual_price_xof >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, credits)
);

create index if not exists pricing_plan_options_active_idx
  on public.pricing_plan_options(plan_id, active, sort_order);

drop trigger if exists pricing_plan_options_touch_updated_at on public.pricing_plan_options;
create trigger pricing_plan_options_touch_updated_at
  before update on public.pricing_plan_options
  for each row execute function private.touch_updated_at();

alter table public.pricing_plan_options enable row level security;
revoke all on public.pricing_plan_options from anon, authenticated;
grant select on public.pricing_plan_options to anon, authenticated;
grant all on public.pricing_plan_options to service_role;

drop policy if exists pricing_plan_options_public_read on public.pricing_plan_options;
create policy pricing_plan_options_public_read
  on public.pricing_plan_options for select to anon, authenticated
  using (active);

-- The public launch catalogue contains exactly three plans.
update public.pricing_plans
set active = false,
    pricing_version = '2026-08-launch-v2'
where id not in ('free', 'basic', 'pro');

update public.pricing_plans
set display_name = 'Free',
    monthly_price_usd = 0,
    annual_price_usd = 0,
    monthly_price_xof = 0,
    annual_price_xof = 0,
    included_credits = 100,
    monthly_message_limit = 60,
    daily_message_limit = 10,
    daily_video_limit = 0,
    concurrent_image_jobs = 1,
    concurrent_video_jobs = 0,
    allowed_media_types = array['image']::text[],
    watermark_required = true,
    media_retention_days = 7,
    priority_queue = false,
    storage_gb = 1,
    max_upload_mb = 25,
    seat_limit = 1,
    support_level = 'community',
    sort_order = 0,
    is_business = false,
    active = true,
    pricing_version = '2026-08-launch-v2',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'segment', 'solo', 'checkout', false, 'badge', 'POUR DÉCOUVRIR',
      'tagline', 'Teste HuggyFlow avec 100 crédits offerts.',
      'cta', 'Créer un compte', 'credit_mode', 'one_time'
    )
where id = 'free';

update public.pricing_plans
set display_name = 'Creator',
    monthly_price_usd = 13.17,
    annual_price_usd = 138.33,
    monthly_price_xof = 7900,
    annual_price_xof = 83000,
    included_credits = 500,
    monthly_message_limit = 300,
    daily_message_limit = 60,
    daily_video_limit = 2,
    concurrent_image_jobs = 2,
    concurrent_video_jobs = 1,
    allowed_media_types = array['image','image_edit','video']::text[],
    watermark_required = false,
    media_retention_days = 30,
    priority_queue = false,
    storage_gb = 10,
    max_upload_mb = 100,
    seat_limit = 1,
    support_level = 'standard',
    sort_order = 10,
    is_business = false,
    active = true,
    pricing_version = '2026-08-launch-v2',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'segment', 'solo', 'checkout', true, 'badge', 'RECOMMANDÉ',
      'tagline', 'Les essentiels pour créer et publier régulièrement.',
      'cta', 'Choisir Creator', 'popular', true, 'annual_discount_percent', 12.5,
      'credit_mode', 'monthly_options'
    )
where id = 'basic';

update public.pricing_plans
set display_name = 'Pro',
    monthly_price_usd = 33.17,
    annual_price_usd = 348.33,
    monthly_price_xof = 19900,
    annual_price_xof = 209000,
    included_credits = 1500,
    monthly_message_limit = 900,
    daily_message_limit = 120,
    daily_video_limit = 8,
    concurrent_image_jobs = 4,
    concurrent_video_jobs = 2,
    allowed_media_types = array['image','image_edit','video','audio','lipsync','video_edit']::text[],
    watermark_required = false,
    media_retention_days = 90,
    priority_queue = true,
    storage_gb = 100,
    max_upload_mb = 300,
    seat_limit = 1,
    support_level = 'priority',
    sort_order = 20,
    is_business = false,
    active = true,
    pricing_version = '2026-08-launch-v2',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'segment', 'solo', 'checkout', true, 'badge', 'PREMIUM',
      'tagline', 'Pour produire, tester et livrer avec plus de contrôle.',
      'cta', 'Passer à Pro', 'annual_discount_percent', 12.5,
      'credit_mode', 'monthly_options'
    )
where id = 'pro';

insert into public.pricing_plan_options
  (id, plan_id, credits, monthly_price_xof, annual_price_xof, sort_order, metadata)
values
  ('creator-500', 'basic', 500, 7900, 83000, 10, '{"label":"Creator 500"}'),
  ('creator-1000', 'basic', 1000, 14900, 156450, 20, '{"label":"Creator 1 000"}'),
  ('creator-2500', 'basic', 2500, 34900, 366450, 30, '{"label":"Creator 2 500"}'),
  ('creator-5000', 'basic', 5000, 64900, 681450, 40, '{"label":"Creator 5 000"}'),
  ('pro-1500', 'pro', 1500, 19900, 208950, 10, '{"label":"Pro 1 500"}'),
  ('pro-3000', 'pro', 3000, 37900, 397950, 20, '{"label":"Pro 3 000"}'),
  ('pro-6000', 'pro', 6000, 71900, 755950, 30, '{"label":"Pro 6 000"}'),
  ('pro-10000', 'pro', 10000, 114900, 1206450, 40, '{"label":"Pro 10 000"}')
on conflict (id) do update set
  plan_id = excluded.plan_id,
  credits = excluded.credits,
  monthly_price_xof = excluded.monthly_price_xof,
  annual_price_xof = excluded.annual_price_xof,
  sort_order = excluded.sort_order,
  active = true,
  metadata = excluded.metadata;

update public.pricing_plan_options
set active = false
where plan_id not in ('basic', 'pro');

update public.credit_packs
set active = false
where id not in ('starter-topup', 'growth-topup', 'studio-topup');
