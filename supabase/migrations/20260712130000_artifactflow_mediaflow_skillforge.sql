-- ArtifactFlow, MediaFlow live gallery and persistent SkillForge versions.
-- All tables are owner-scoped; service_role is used only by the Edge Function.

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null default 'Nouvel artifact',
  type text not null default 'markdown' check (type in ('markdown','html','react','svg','table','diagram','document')),
  status text not null default 'ready' check (status in ('draft','ready','error','archived')),
  visibility text not null default 'private' check (visibility in ('private','unlisted','public')),
  current_version integer not null default 1 check (current_version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  entry_file text not null default 'README.md',
  files jsonb not null default '[]'::jsonb,
  source_prompt text not null default '',
  model_id text,
  compile_status text not null default 'not_run' check (compile_status in ('not_run','passed','failed')),
  runtime_error jsonb,
  created_at timestamptz not null default now(),
  unique (artifact_id, version_number)
);

create table if not exists public.artifact_shares (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_id uuid not null references public.artifact_versions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  access_mode text not null default 'view' check (access_mode in ('view','remix')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.agent_skills add column if not exists status text not null default 'active';
alter table public.agent_skills add column if not exists visibility text not null default 'private';
alter table public.agent_skills add column if not exists current_version integer not null default 1;
alter table public.agent_skills add column if not exists definition jsonb not null default '{}'::jsonb;
alter table public.agent_skills add column if not exists last_used_at timestamptz;

create table if not exists public.agent_skill_versions (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.agent_skills(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft','tested','active','needs_review','disabled')),
  definition jsonb not null default '{}'::jsonb,
  source_prompt text not null default '',
  run_count integer not null default 0,
  success_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (skill_id, version_number)
);

create index if not exists artifacts_user_updated_idx on public.artifacts(user_id, updated_at desc);
create index if not exists artifacts_project_updated_idx on public.artifacts(project_id, updated_at desc);
create index if not exists artifact_versions_artifact_idx on public.artifact_versions(artifact_id, version_number desc);
create index if not exists artifact_shares_token_idx on public.artifact_shares(token_hash) where revoked_at is null;
create index if not exists agent_skill_versions_skill_idx on public.agent_skill_versions(skill_id, version_number desc);

alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.artifact_shares enable row level security;
alter table public.agent_skill_versions enable row level security;

drop policy if exists artifacts_owner_all on public.artifacts;
create policy artifacts_owner_all on public.artifacts for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists artifact_versions_owner_all on public.artifact_versions;
create policy artifact_versions_owner_all on public.artifact_versions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists artifact_shares_owner_all on public.artifact_shares;
create policy artifact_shares_owner_all on public.artifact_shares for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists agent_skill_versions_owner_all on public.agent_skill_versions;
create policy agent_skill_versions_owner_all on public.agent_skill_versions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.artifacts, public.artifact_versions, public.artifact_shares, public.agent_skill_versions from anon, authenticated;
grant select, insert, update, delete on public.artifacts, public.artifact_versions, public.artifact_shares, public.agent_skill_versions to authenticated;
grant all on public.artifacts, public.artifact_versions, public.artifact_shares, public.agent_skill_versions to service_role;

drop trigger if exists artifacts_touch_updated_at on public.artifacts;
create trigger artifacts_touch_updated_at before update on public.artifacts
  for each row execute function private.touch_updated_at();
