alter table public.profiles add column if not exists stripe_customer_id text unique;
alter table public.profiles add column if not exists billing_email text;
alter table public.profiles add column if not exists billing_status text not null default 'trialing';
alter table public.profiles add column if not exists current_period_end timestamptz;
alter table public.profiles add column if not exists trial_ends_at timestamptz;
alter table public.profiles add column if not exists consented_terms_at timestamptz;
alter table public.profiles add column if not exists consented_privacy_at timestamptz;
alter table public.profiles add column if not exists locale text not null default 'fr';
alter table public.profiles add column if not exists currency text not null default 'usd';
alter table public.profiles add column if not exists country text;

alter table public.pricing_plans add column if not exists annual_price_usd numeric(10,2);
alter table public.pricing_plans add column if not exists stripe_monthly_price_id text;
alter table public.pricing_plans add column if not exists stripe_annual_price_id text;
alter table public.pricing_plans add column if not exists storage_gb integer not null default 1 check (storage_gb >= 0);
alter table public.pricing_plans add column if not exists max_upload_mb integer not null default 25 check (max_upload_mb >= 0);
alter table public.pricing_plans add column if not exists seat_limit integer not null default 1 check (seat_limit >= 1);
alter table public.pricing_plans add column if not exists support_level text not null default 'community';
alter table public.pricing_plans add column if not exists trial_days integer not null default 0 check (trial_days >= 0);
alter table public.pricing_plans add column if not exists sort_order integer not null default 100;
alter table public.pricing_plans add column if not exists is_business boolean not null default false;

alter table public.credit_packs add column if not exists stripe_price_id text;

alter table public.generations add column if not exists storage_bucket text;
alter table public.generations add column if not exists storage_path text;
alter table public.generations add column if not exists storage_url_expires_at timestamptz;
alter table public.generations add column if not exists expires_at timestamptz;
alter table public.generations add column if not exists failure_refunded_at timestamptz;
alter table public.generations add column if not exists moderation_status text not null default 'approved'
  check (moderation_status in ('approved', 'blocked', 'review'));

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  email text,
  name text,
  currency text not null default 'usd',
  tax_country text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint billing_customers_user_unique unique (user_id)
);

create table if not exists public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id text unique,
  mode text not null check (mode in ('subscription', 'payment')),
  plan_id text references public.pricing_plans(id) on delete set null,
  credit_pack_id text references public.credit_packs(id) on delete set null,
  billing_interval text check (billing_interval in ('monthly', 'annual')),
  status text not null default 'created' check (status in ('created', 'open', 'completed', 'expired', 'cancelled', 'failed')),
  amount_usd numeric(10,2),
  currency text not null default 'usd',
  checkout_url text,
  expires_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text references public.pricing_plans(id) on delete set null,
  stripe_subscription_id text unique,
  stripe_customer_id text,
  status text not null default 'incomplete',
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'annual')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  stripe_invoice_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'draft',
  amount_due_usd numeric(10,2) not null default 0,
  amount_paid_usd numeric(10,2) not null default 0,
  currency text not null default 'usd',
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe',
  provider_event_id text not null,
  event_type text not null,
  user_id uuid references public.profiles(id) on delete set null,
  processed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payment_events_provider_event_unique unique (provider, provider_event_id)
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  bucket text not null default 'flowtube-media',
  object_path text not null,
  content_type text,
  bytes bigint check (bytes is null or bytes >= 0),
  source_url text,
  public_url text,
  signed_url_expires_at timestamptz,
  expires_at timestamptz,
  status text not null default 'available' check (status in ('available', 'expired', 'deleted', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_assets_bucket_path_unique unique (bucket, object_path)
);

create table if not exists public.moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  provider text not null default 'flowtube',
  decision text not null check (decision in ('approved', 'blocked', 'review')),
  reason text,
  prompt_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip_hash text,
  route text not null,
  window_start timestamptz not null default date_trunc('minute', now()),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  provider text not null default 'resend',
  template text not null,
  to_email text,
  subject text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy', 'cookies', 'refund_policy')),
  version text not null,
  accepted_at timestamptz not null default now(),
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  constraint user_consents_unique unique (user_id, document_type, version)
);

create index if not exists profiles_stripe_customer_idx on public.profiles(stripe_customer_id) where stripe_customer_id is not null;
create index if not exists billing_checkout_sessions_user_created_idx on public.billing_checkout_sessions(user_id, created_at desc);
create index if not exists subscriptions_user_status_idx on public.subscriptions(user_id, status, created_at desc);
create index if not exists invoices_user_created_idx on public.invoices(user_id, created_at desc);
create index if not exists payment_events_type_created_idx on public.payment_events(event_type, created_at desc);
create index if not exists media_assets_user_created_idx on public.media_assets(user_id, created_at desc);
create index if not exists media_assets_generation_idx on public.media_assets(generation_id) where generation_id is not null;
create index if not exists moderation_events_user_created_idx on public.moderation_events(user_id, created_at desc);
create index if not exists rate_limit_events_route_window_idx on public.rate_limit_events(route, window_start, ip_hash);
create index if not exists email_events_user_created_idx on public.email_events(user_id, created_at desc);
create index if not exists user_consents_user_type_idx on public.user_consents(user_id, document_type, accepted_at desc);

drop trigger if exists billing_customers_touch_updated_at on public.billing_customers;
create trigger billing_customers_touch_updated_at before update on public.billing_customers for each row execute function private.touch_updated_at();
drop trigger if exists billing_checkout_sessions_touch_updated_at on public.billing_checkout_sessions;
create trigger billing_checkout_sessions_touch_updated_at before update on public.billing_checkout_sessions for each row execute function private.touch_updated_at();
drop trigger if exists subscriptions_touch_updated_at on public.subscriptions;
create trigger subscriptions_touch_updated_at before update on public.subscriptions for each row execute function private.touch_updated_at();
drop trigger if exists media_assets_touch_updated_at on public.media_assets;
create trigger media_assets_touch_updated_at before update on public.media_assets for each row execute function private.touch_updated_at();

alter table public.billing_customers enable row level security;
alter table public.billing_checkout_sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.payment_events enable row level security;
alter table public.media_assets enable row level security;
alter table public.moderation_events enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.email_events enable row level security;
alter table public.user_consents enable row level security;

drop policy if exists billing_customers_owner_select on public.billing_customers;
create policy billing_customers_owner_select on public.billing_customers for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists billing_checkout_sessions_owner_select on public.billing_checkout_sessions;
create policy billing_checkout_sessions_owner_select on public.billing_checkout_sessions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists invoices_owner_select on public.invoices;
create policy invoices_owner_select on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists media_assets_owner_select on public.media_assets;
create policy media_assets_owner_select on public.media_assets for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists moderation_events_owner_select on public.moderation_events;
create policy moderation_events_owner_select on public.moderation_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists email_events_owner_select on public.email_events;
create policy email_events_owner_select on public.email_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_consents_owner_select on public.user_consents;
create policy user_consents_owner_select on public.user_consents for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_consents_owner_insert on public.user_consents;
create policy user_consents_owner_insert on public.user_consents for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on public.billing_customers, public.billing_checkout_sessions, public.subscriptions, public.invoices, public.payment_events, public.media_assets, public.moderation_events, public.rate_limit_events, public.email_events, public.user_consents from anon, authenticated;
grant select on public.billing_customers, public.billing_checkout_sessions, public.subscriptions, public.invoices, public.media_assets, public.moderation_events, public.email_events, public.user_consents to authenticated;
grant insert on public.user_consents to authenticated;
grant all on public.billing_customers, public.billing_checkout_sessions, public.subscriptions, public.invoices, public.payment_events, public.media_assets, public.moderation_events, public.rate_limit_events, public.email_events, public.user_consents to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'flowtube-media',
  'flowtube-media',
  false,
  524288000,
  array['image/png','image/jpeg','image/webp','video/mp4','audio/mpeg','audio/wav','application/octet-stream']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists flowtube_media_owner_select on storage.objects;
create policy flowtube_media_owner_select on storage.objects
for select to authenticated
using (
  bucket_id = 'flowtube-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists flowtube_media_owner_insert on storage.objects;
create policy flowtube_media_owner_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'flowtube-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists flowtube_media_owner_update on storage.objects;
create policy flowtube_media_owner_update on storage.objects
for update to authenticated
using (
  bucket_id = 'flowtube-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'flowtube-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

insert into public.pricing_plans
  (id, display_name, monthly_price_usd, annual_price_usd, included_credits, monthly_message_limit, daily_message_limit, daily_video_limit, concurrent_image_jobs, concurrent_video_jobs, allowed_media_types, watermark_required, media_retention_days, priority_queue, storage_gb, max_upload_mb, seat_limit, support_level, trial_days, sort_order, is_business, metadata)
values
  ('free', 'Free', 0, 0, 100, 60, 10, 0, 1, 0, array['image']::text[], true, 7, false, 1, 25, 1, 'community', 0, 0, false, '{"description":"Discovery tier","checkout":false,"taxes":"calculated at checkout"}'),
  ('basic', 'Basic', 15, 144, 1000, 300, 60, 2, 2, 1, array['image','video']::text[], false, 30, false, 10, 100, 1, 'standard', 0, 10, false, '{"alias":"starter","monthly_label":"$15/mo","annual_label":"$12/mo billed annually","checkout":true,"taxes":"calculated at checkout"}'),
  ('starter', 'Starter', 15, 144, 1000, 300, 60, 2, 2, 1, array['image','video']::text[], false, 30, false, 10, 100, 1, 'standard', 0, 11, false, '{"canonical":"basic","checkout":true}'),
  ('pro', 'Pro', 49, 468, 4500, 1500, 150, 8, 4, 2, array['image','video','audio','lipsync','image_edit','video_edit']::text[], false, 90, false, 100, 250, 3, 'priority', 0, 20, false, '{"monthly_label":"$49/mo","annual_label":"$39/mo billed annually","checkout":true,"taxes":"calculated at checkout"}'),
  ('max', 'Max', 129, 1188, 12000, 4000, 300, 20, 8, 4, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 180, true, 500, 500, 10, 'priority', 0, 30, true, '{"alias":"studio","monthly_label":"$129/mo","annual_label":"$99/mo billed annually","checkout":true,"taxes":"calculated at checkout"}'),
  ('studio', 'Studio', 129, 1188, 12000, 4000, 300, 20, 8, 4, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 180, true, 500, 500, 10, 'priority', 0, 31, true, '{"canonical":"max","checkout":true}')
on conflict (id) do update set
  display_name = excluded.display_name,
  monthly_price_usd = excluded.monthly_price_usd,
  annual_price_usd = excluded.annual_price_usd,
  included_credits = excluded.included_credits,
  monthly_message_limit = excluded.monthly_message_limit,
  daily_message_limit = excluded.daily_message_limit,
  daily_video_limit = excluded.daily_video_limit,
  concurrent_image_jobs = excluded.concurrent_image_jobs,
  concurrent_video_jobs = excluded.concurrent_video_jobs,
  allowed_media_types = excluded.allowed_media_types,
  watermark_required = excluded.watermark_required,
  media_retention_days = excluded.media_retention_days,
  priority_queue = excluded.priority_queue,
  storage_gb = excluded.storage_gb,
  max_upload_mb = excluded.max_upload_mb,
  seat_limit = excluded.seat_limit,
  support_level = excluded.support_level,
  trial_days = excluded.trial_days,
  sort_order = excluded.sort_order,
  is_business = excluded.is_business,
  active = true,
  metadata = excluded.metadata;

insert into public.credit_packs (id, label, credits, price_usd, floor_credit_usd, metadata)
values
  ('starter-topup', 'Starter top-up', 500, 6.50, 0.008, '{"credit_usd":0.013,"checkout":true}'),
  ('growth-topup', 'Growth top-up', 2500, 25.00, 0.008, '{"credit_usd":0.010,"checkout":true,"popular":true}'),
  ('studio-topup', 'Studio top-up', 10000, 80.00, 0.008, '{"credit_usd":0.008,"checkout":true,"best_value":true}')
on conflict (id) do update set
  label = excluded.label,
  credits = excluded.credits,
  price_usd = excluded.price_usd,
  floor_credit_usd = excluded.floor_credit_usd,
  active = true,
  metadata = excluded.metadata;
