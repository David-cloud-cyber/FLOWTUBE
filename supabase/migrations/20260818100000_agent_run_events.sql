create table if not exists public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (run_id, sequence)
);

create index if not exists agent_run_events_user_run_sequence_idx
  on public.agent_run_events (user_id, run_id, sequence);

create index if not exists agent_run_events_created_at_idx
  on public.agent_run_events (created_at);

alter table public.agent_run_events enable row level security;

comment on table public.agent_run_events is
  'Short-lived, server-owned SSE events used to resume an agent run without trusting client state.';
