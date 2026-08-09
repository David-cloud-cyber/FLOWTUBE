-- Public Explore gallery with explicit publishing and per-user interactions.
-- Private generations/artifacts are never exposed by this table or its policies.

create table if not exists public.explore_publications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  artifact_id uuid references public.artifacts(id) on delete cascade,
  title text not null default 'Création HuggyFlow',
  description text not null default '',
  prompt text not null default '',
  media_url text not null,
  media_type text not null check (media_type in ('image','video','audio','document','artifact')),
  model_label text not null default 'HuggyFlow',
  aspect_ratio text not null default '1:1',
  duration_seconds integer,
  has_audio boolean not null default false,
  tags text[] not null default array[]::text[],
  status text not null default 'published' check (status in ('published','hidden','removed')),
  reactions_count integer not null default 0 check (reactions_count >= 0),
  saves_count integer not null default 0 check (saves_count >= 0),
  remix_count integer not null default 0 check (remix_count >= 0),
  views_count integer not null default 0 check (views_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint explore_publications_one_source check ((generation_id is not null) or (artifact_id is not null)),
  constraint explore_publications_generation_unique unique (generation_id),
  constraint explore_publications_artifact_unique unique (artifact_id)
);

create table if not exists public.explore_interactions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.explore_publications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('reaction','save')),
  created_at timestamptz not null default now(),
  unique (publication_id, user_id, kind)
);

create table if not exists public.explore_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.explore_publications(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  reason text not null default 'other',
  details text not null default '',
  status text not null default 'open' check (status in ('open','reviewed','dismissed','resolved')),
  created_at timestamptz not null default now(),
  unique (publication_id, user_id)
);

create index if not exists explore_publications_feed_idx on public.explore_publications(status, created_at desc);
create index if not exists explore_publications_trending_idx on public.explore_publications(status, reactions_count desc, saves_count desc, remix_count desc);
create index if not exists explore_interactions_publication_idx on public.explore_interactions(publication_id, kind);

alter table public.explore_publications enable row level security;
alter table public.explore_interactions enable row level security;
alter table public.explore_reports enable row level security;

drop policy if exists explore_publications_owner_all on public.explore_publications;
create policy explore_publications_owner_all on public.explore_publications for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists explore_interactions_owner_all on public.explore_interactions;
create policy explore_interactions_owner_all on public.explore_interactions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists explore_reports_owner_all on public.explore_reports;
create policy explore_reports_owner_all on public.explore_reports for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.explore_publications, public.explore_interactions, public.explore_reports from anon, authenticated;
grant all on public.explore_publications, public.explore_interactions, public.explore_reports to service_role;

drop trigger if exists explore_publications_touch_updated_at on public.explore_publications;
create trigger explore_publications_touch_updated_at before update on public.explore_publications
  for each row execute function private.touch_updated_at();
