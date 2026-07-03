-- Couche mémoire persistante de l'agent (inspiree de la memoire 3 couches du type "supercomputer").
-- Couche 1 (globale/marque): project_id NULL  -> voix de marque, couleurs, audience, preferences durables.
-- Couche 2 (projet): project_id renseigne     -> faits specifiques au projet en cours.
create table if not exists public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null default 'fact' check (kind in ('brand', 'fact', 'preference', 'style')),
  label text not null,
  content text not null,
  weight integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule entree par (user, portee projet, label) : "retiens X" met a jour au lieu de dupliquer.
create unique index if not exists agent_memory_scope_label_idx
  on public.agent_memory(user_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(label));
create index if not exists agent_memory_user_idx on public.agent_memory(user_id, kind);
create index if not exists agent_memory_project_idx on public.agent_memory(project_id) where project_id is not null;

alter table public.agent_memory enable row level security;
drop policy if exists agent_memory_owner_all on public.agent_memory;
create policy agent_memory_owner_all on public.agent_memory
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.agent_memory from anon, authenticated;
grant select, insert, update, delete on public.agent_memory to authenticated;
grant all on public.agent_memory to service_role;

drop trigger if exists agent_memory_touch_updated_at on public.agent_memory;
create trigger agent_memory_touch_updated_at before update on public.agent_memory
  for each row execute function private.touch_updated_at();
