create table if not exists public.agent_run_controls (
  run_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('active', 'cancel_requested', 'cancelled')),
  requested_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (run_id, user_id)
);

create index if not exists agent_run_controls_user_status_idx
  on public.agent_run_controls (user_id, status, updated_at desc);

alter table public.agent_run_controls enable row level security;
revoke all on public.agent_run_controls from public, anon, authenticated;
grant all on public.agent_run_controls to service_role;

comment on table public.agent_run_controls is
  'Server-owned cancellation state for resumable agent runs.';
