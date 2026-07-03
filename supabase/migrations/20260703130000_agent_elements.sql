-- Elements: references nommees reutilisables (personnage, produit, logo, decor, style).
-- Epinglees une fois, rappelees par @nom dans n'importe quel prompt pour garder la coherence visuelle.
create table if not exists public.agent_elements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  kind text not null default 'reference' check (kind in ('character', 'product', 'logo', 'environment', 'style', 'reference')),
  media_url text not null,
  source_generation_id uuid references public.generations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists agent_elements_user_name_idx on public.agent_elements(user_id, lower(name));
create index if not exists agent_elements_project_idx on public.agent_elements(project_id) where project_id is not null;

alter table public.agent_elements enable row level security;
drop policy if exists agent_elements_owner_all on public.agent_elements;
create policy agent_elements_owner_all on public.agent_elements
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.agent_elements from anon, authenticated;
grant select, insert, update, delete on public.agent_elements to authenticated;
grant all on public.agent_elements to service_role;

drop trigger if exists agent_elements_touch_updated_at on public.agent_elements;
create trigger agent_elements_touch_updated_at before update on public.agent_elements
  for each row execute function private.touch_updated_at();
