-- Close the production gaps identified in the AgentFlow audit.
-- All tables are owner-scoped and secrets remain service-role only.

alter table public.agent_memory
  add column if not exists last_used_reason text not null default '';

alter table public.api_keys
  add column if not exists daily_limit integer not null default 1000
    check (daily_limit between 1 and 100000);

create table if not exists public.user_security_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_hash text not null unique,
  device_label text not null default 'Navigateur',
  user_agent text not null default '',
  ip_hash text not null default '',
  is_current boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists user_security_sessions_user_idx
  on public.user_security_sessions(user_id, last_seen_at desc);

create table if not exists public.user_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  ip_hash text not null default '',
  user_agent text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists user_security_events_user_idx
  on public.user_security_events(user_id, created_at desc);

create table if not exists public.api_key_usage (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.api_keys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null default '',
  method text not null default 'GET',
  status_code integer not null default 200,
  credits integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists api_key_usage_key_created_idx
  on public.api_key_usage(api_key_id, created_at desc);

create table if not exists public.project_access_grants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner','admin','editor','viewer')),
  permissions jsonb not null default '{"read":true,"edit":false,"generate":false,"publish":false}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, member_user_id)
);
create index if not exists project_access_grants_owner_idx
  on public.project_access_grants(owner_id, project_id);

create table if not exists public.team_custom_roles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table if not exists public.project_approval_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  comment text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists project_approval_requests_owner_idx
  on public.project_approval_requests(owner_id, status, created_at desc);

create table if not exists public.usage_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  threshold_percent integer not null default 80 check (threshold_percent between 1 and 100),
  enabled boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.affiliate_risk_reviews (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.affiliate_referrals(id) on delete cascade,
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  score integer not null default 0 check (score between 0 and 100),
  status text not null default 'clear' check (status in ('clear','review','blocked','resolved')),
  reasons jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(referral_id)
);

create table if not exists public.affiliate_disputes (
  id uuid primary key default gen_random_uuid(),
  referral_id uuid not null references public.affiliate_referrals(id) on delete cascade,
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'open' check (status in ('open','investigating','resolved','rejected')),
  resolution text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.mfa_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null unique,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mfa_recovery_codes_user_idx on public.mfa_recovery_codes(user_id, created_at desc);

alter table public.user_security_sessions enable row level security;
alter table public.user_security_events enable row level security;
alter table public.api_key_usage enable row level security;
alter table public.project_access_grants enable row level security;
alter table public.team_custom_roles enable row level security;
alter table public.project_approval_requests enable row level security;
alter table public.usage_alerts enable row level security;
alter table public.affiliate_risk_reviews enable row level security;
alter table public.affiliate_disputes enable row level security;
alter table public.mfa_recovery_codes enable row level security;

revoke all on public.user_security_sessions, public.user_security_events from anon;
revoke all on public.api_key_usage from anon;
grant select on public.user_security_sessions, public.user_security_events to authenticated;
grant select on public.api_key_usage to authenticated;
grant all on public.user_security_sessions, public.user_security_events, public.api_key_usage to service_role;
grant select, insert, update, delete on public.project_access_grants, public.team_custom_roles, public.project_approval_requests, public.usage_alerts to authenticated;
grant all on public.project_access_grants, public.team_custom_roles, public.project_approval_requests, public.usage_alerts to service_role;
grant select on public.affiliate_risk_reviews, public.affiliate_disputes to authenticated;
grant all on public.affiliate_risk_reviews, public.affiliate_disputes to service_role;
revoke all on public.mfa_recovery_codes from anon, authenticated;
grant all on public.mfa_recovery_codes to service_role;

drop policy if exists user_security_sessions_owner_select on public.user_security_sessions;
create policy user_security_sessions_owner_select on public.user_security_sessions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists user_security_events_owner_select on public.user_security_events;
create policy user_security_events_owner_select on public.user_security_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists api_key_usage_owner_select on public.api_key_usage;
create policy api_key_usage_owner_select on public.api_key_usage for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists project_access_grants_owner_all on public.project_access_grants;
create policy project_access_grants_owner_all on public.project_access_grants for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists team_custom_roles_owner_all on public.team_custom_roles;
create policy team_custom_roles_owner_all on public.team_custom_roles for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists project_approval_requests_owner_all on public.project_approval_requests;
create policy project_approval_requests_owner_all on public.project_approval_requests for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists usage_alerts_owner_all on public.usage_alerts;
create policy usage_alerts_owner_all on public.usage_alerts for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists affiliate_risk_reviews_owner_select on public.affiliate_risk_reviews;
create policy affiliate_risk_reviews_owner_select on public.affiliate_risk_reviews for select to authenticated using ((select auth.uid()) = affiliate_user_id);
drop policy if exists affiliate_disputes_owner_select on public.affiliate_disputes;
create policy affiliate_disputes_owner_select on public.affiliate_disputes for select to authenticated using ((select auth.uid()) = affiliate_user_id);

drop trigger if exists project_access_grants_touch_updated_at on public.project_access_grants;
create trigger project_access_grants_touch_updated_at before update on public.project_access_grants for each row execute function private.touch_updated_at();
drop trigger if exists team_custom_roles_touch_updated_at on public.team_custom_roles;
create trigger team_custom_roles_touch_updated_at before update on public.team_custom_roles for each row execute function private.touch_updated_at();
drop trigger if exists usage_alerts_touch_updated_at on public.usage_alerts;
create trigger usage_alerts_touch_updated_at before update on public.usage_alerts for each row execute function private.touch_updated_at();
