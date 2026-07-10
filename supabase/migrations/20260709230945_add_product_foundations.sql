-- Product foundations: brand memory, reusable templates, safe integration state,
-- export manifests, durable generation telemetry, and user feedback.

create table if not exists public.brand_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  profile jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  brand_kit_id uuid references public.brand_kits(id) on delete cascade,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  label text not null default 'Reference',
  kind text not null default 'reference' check (kind in ('logo', 'product', 'character', 'style', 'reference')),
  created_at timestamptz not null default now()
);

create table if not exists public.creative_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  brand_kit_id uuid references public.brand_kits(id) on delete set null,
  source_generation_id uuid references public.generations(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'creative' check (kind in ('creative', 'ugc', 'image', 'video', 'campaign', 'workflow')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  content jsonb not null default '{}'::jsonb,
  remix_count integer not null default 0 check (remix_count >= 0),
  last_remixed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.export_packages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  status text not null default 'ready' check (status in ('pending', 'ready', 'expired', 'failed')),
  format text not null default 'campaign_manifest' check (format in ('campaign_manifest', 'creative_brief', 'media_links')),
  manifest jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'whatsapp_business', 'meta_ads', 'tiktok', 'slack', 'notion', 'webhook')),
  status text not null default 'disconnected' check (status in ('disconnected', 'pending', 'connected', 'error')),
  account_label text,
  credentials_ref text,
  configuration jsonb not null default '{}'::jsonb,
  last_error text,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null unique references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null check (char_length(event_name) between 1 and 100),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'feedback' check (kind in ('feedback', 'bug', 'feature_request', 'billing')),
  message text not null check (char_length(message) between 3 and 4000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists brand_kits_one_default_per_user_idx
  on public.brand_kits (user_id) where is_default;
create index if not exists brand_kits_user_updated_idx on public.brand_kits (user_id, updated_at desc);
create index if not exists brand_assets_project_idx on public.brand_assets (project_id, created_at desc);
create index if not exists creative_templates_owner_updated_idx on public.creative_templates (user_id, updated_at desc);
create index if not exists creative_templates_public_updated_idx on public.creative_templates (updated_at desc) where visibility = 'public';
create index if not exists export_packages_user_created_idx on public.export_packages (user_id, created_at desc);
create index if not exists generation_jobs_work_idx on public.generation_jobs (status, next_attempt_at) where status in ('queued', 'running');
create index if not exists product_events_user_created_idx on public.product_events (user_id, created_at desc) where user_id is not null;
create index if not exists product_events_name_created_idx on public.product_events (event_name, created_at desc);
create index if not exists user_feedback_user_created_idx on public.user_feedback (user_id, created_at desc);

alter table public.brand_kits enable row level security;
alter table public.brand_assets enable row level security;
alter table public.creative_templates enable row level security;
alter table public.export_packages enable row level security;
alter table public.integration_connections enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.product_events enable row level security;
alter table public.user_feedback enable row level security;

drop policy if exists brand_kits_owner_all on public.brand_kits;
create policy brand_kits_owner_all on public.brand_kits for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists brand_assets_owner_all on public.brand_assets;
create policy brand_assets_owner_all on public.brand_assets for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists creative_templates_read on public.creative_templates;
create policy creative_templates_read on public.creative_templates for select to authenticated
  using ((select auth.uid()) = user_id or visibility = 'public');
drop policy if exists creative_templates_owner_write on public.creative_templates;
create policy creative_templates_owner_write on public.creative_templates for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists creative_templates_owner_update on public.creative_templates;
create policy creative_templates_owner_update on public.creative_templates for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists creative_templates_owner_delete on public.creative_templates;
create policy creative_templates_owner_delete on public.creative_templates for delete to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists export_packages_owner_select on public.export_packages;
create policy export_packages_owner_select on public.export_packages for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists integration_connections_owner_all on public.integration_connections;
create policy integration_connections_owner_all on public.integration_connections for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists generation_jobs_owner_select on public.generation_jobs;
create policy generation_jobs_owner_select on public.generation_jobs for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists user_feedback_owner_select on public.user_feedback;
create policy user_feedback_owner_select on public.user_feedback for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists user_feedback_owner_insert on public.user_feedback;
create policy user_feedback_owner_insert on public.user_feedback for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.brand_kits, public.brand_assets, public.creative_templates, public.export_packages,
  public.integration_connections, public.generation_jobs, public.product_events, public.user_feedback
  from anon, authenticated;
grant select, insert, update, delete on public.brand_kits, public.brand_assets, public.integration_connections to authenticated;
grant select, insert, update, delete on public.creative_templates to authenticated;
grant select on public.export_packages, public.generation_jobs, public.user_feedback to authenticated;
grant insert on public.user_feedback to authenticated;
grant all on public.brand_kits, public.brand_assets, public.creative_templates, public.export_packages,
  public.integration_connections, public.generation_jobs, public.product_events, public.user_feedback
  to service_role;

drop trigger if exists brand_kits_touch_updated_at on public.brand_kits;
create trigger brand_kits_touch_updated_at before update on public.brand_kits
  for each row execute function private.touch_updated_at();
drop trigger if exists creative_templates_touch_updated_at on public.creative_templates;
create trigger creative_templates_touch_updated_at before update on public.creative_templates
  for each row execute function private.touch_updated_at();
drop trigger if exists integration_connections_touch_updated_at on public.integration_connections;
create trigger integration_connections_touch_updated_at before update on public.integration_connections
  for each row execute function private.touch_updated_at();
drop trigger if exists generation_jobs_touch_updated_at on public.generation_jobs;
create trigger generation_jobs_touch_updated_at before update on public.generation_jobs
  for each row execute function private.touch_updated_at();
drop trigger if exists user_feedback_touch_updated_at on public.user_feedback;
create trigger user_feedback_touch_updated_at before update on public.user_feedback
  for each row execute function private.touch_updated_at();
