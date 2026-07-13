-- AgentFlow memory provenance and persistent task graph.
-- The Edge Function is the orchestrator; authenticated users keep direct,
-- owner-scoped read and control access through RLS.

alter table public.agent_memory
  add column if not exists source_type text not null default 'user'
    check (source_type in ('user', 'agent', 'artifact', 'generation', 'connector', 'system')),
  add column if not exists source_id uuid,
  add column if not exists source_excerpt text not null default '',
  add column if not exists confidence numeric(3,2) not null default 1.00
    check (confidence >= 0 and confidence <= 1),
  add column if not exists status text not null default 'active'
    check (status in ('active', 'forgotten', 'archived')),
  add column if not exists expires_at timestamptz,
  add column if not exists last_used_at timestamptz,
  add column if not exists is_pinned boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists agent_memory_retrieval_idx
  on public.agent_memory(user_id, project_id, status, is_pinned desc, confidence desc, updated_at desc);
create index if not exists agent_memory_expiry_idx
  on public.agent_memory(expires_at) where expires_at is not null;

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  root_task_id uuid references public.agent_tasks(id) on delete cascade,
  parent_task_id uuid references public.agent_tasks(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete set null,
  task_type text not null check (task_type in ('workflow', 'generate', 'analyze', 'rank', 'recommend', 'research', 'export')),
  title text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')),
  depends_on uuid[] not null default '{}'::uuid[],
  idempotency_key text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  progress numeric(5,2) not null default 0 check (progress >= 0 and progress <= 100),
  cost_credits integer not null default 0 check (cost_credits >= 0),
  estimated_seconds integer,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 2 check (max_attempts >= 0),
  last_error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_tasks_user_idempotency_idx
  on public.agent_tasks(user_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists agent_tasks_generation_node_idx
  on public.agent_tasks(root_task_id, task_type, generation_id)
  where generation_id is not null;
create index if not exists agent_tasks_project_status_idx
  on public.agent_tasks(project_id, status, created_at desc);
create index if not exists agent_tasks_user_root_idx
  on public.agent_tasks(user_id, root_task_id, created_at asc);
create index if not exists agent_tasks_pending_idx
  on public.agent_tasks(user_id, status, created_at asc)
  where status in ('queued', 'running', 'paused');
create index if not exists agent_tasks_dependencies_gin_idx
  on public.agent_tasks using gin(depends_on);

create table if not exists public.agent_task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_task_events_task_created_idx
  on public.agent_task_events(task_id, created_at asc);
create index if not exists agent_task_events_user_created_idx
  on public.agent_task_events(user_id, created_at desc);

alter table public.agent_tasks enable row level security;
alter table public.agent_task_events enable row level security;

drop policy if exists agent_tasks_owner_all on public.agent_tasks;
create policy agent_tasks_owner_all on public.agent_tasks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists agent_task_events_owner_select on public.agent_task_events;
create policy agent_task_events_owner_select on public.agent_task_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.agent_tasks, public.agent_task_events from anon, authenticated;
grant select, insert, update, delete on public.agent_tasks to authenticated;
grant select on public.agent_task_events to authenticated;
grant all on public.agent_tasks, public.agent_task_events to service_role;

drop trigger if exists agent_tasks_touch_updated_at on public.agent_tasks;
create trigger agent_tasks_touch_updated_at before update on public.agent_tasks
  for each row execute function private.touch_updated_at();
