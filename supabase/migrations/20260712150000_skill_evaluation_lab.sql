-- Additive Skill Evaluation Lab for AgentFlow.
-- This stores evaluation runs separately from chat messages, skills and artifacts.

create table if not exists public.agent_eval_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  kind text not null check (kind in ('blind_comparator','posthoc_analyzer','grader','benchmark_analyzer')),
  title text not null default 'Evaluation AgentFlow',
  status text not null default 'completed' check (status in ('queued','running','completed','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_eval_runs_user_created_idx
  on public.agent_eval_runs(user_id, created_at desc);
create index if not exists agent_eval_runs_project_created_idx
  on public.agent_eval_runs(project_id, created_at desc);

alter table public.agent_eval_runs enable row level security;

drop policy if exists agent_eval_runs_owner_all on public.agent_eval_runs;
create policy agent_eval_runs_owner_all on public.agent_eval_runs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.agent_eval_runs from anon, authenticated;
grant select, insert, update, delete on public.agent_eval_runs to authenticated;
grant all on public.agent_eval_runs to service_role;

drop trigger if exists agent_eval_runs_touch_updated_at on public.agent_eval_runs;
create trigger agent_eval_runs_touch_updated_at before update on public.agent_eval_runs
  for each row execute function private.touch_updated_at();
