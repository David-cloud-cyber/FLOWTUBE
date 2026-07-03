-- Skills auto-appris: playbooks reutilisables que l'agent ecrit pour/sur l'utilisateur.
-- Couche "ceiling" de la mémoire: l'utilisateur (ou l'agent) enregistre un workflow gagnant,
-- il est ensuite matche par mots-cles et injecte dans le contexte pour rejouer la meme methode.
create table if not exists public.agent_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  triggers text[] not null default '{}'::text[],
  playbook text not null,
  auto_learned boolean not null default false,
  uses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_skills_user_name_idx on public.agent_skills(user_id, lower(name));
create index if not exists agent_skills_user_idx on public.agent_skills(user_id);

alter table public.agent_skills enable row level security;
drop policy if exists agent_skills_owner_all on public.agent_skills;
create policy agent_skills_owner_all on public.agent_skills
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.agent_skills from anon, authenticated;
grant select, insert, update, delete on public.agent_skills to authenticated;
grant all on public.agent_skills to service_role;

drop trigger if exists agent_skills_touch_updated_at on public.agent_skills;
create trigger agent_skills_touch_updated_at before update on public.agent_skills
  for each row execute function private.touch_updated_at();
