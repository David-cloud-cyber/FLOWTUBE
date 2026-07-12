-- Artifact workspace comments and review state.
-- Comments are intentionally owner-scoped; collaboration permissions remain outside this scope.

create table if not exists public.artifact_comments (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.artifacts(id) on delete cascade,
  version_id uuid references public.artifact_versions(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  file_path text,
  line_number integer check (line_number is null or line_number > 0),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artifact_comments_artifact_created_idx
  on public.artifact_comments(artifact_id, created_at desc);
create index if not exists artifact_comments_version_idx
  on public.artifact_comments(version_id, created_at desc);

alter table public.artifact_comments enable row level security;

drop policy if exists artifact_comments_owner_all on public.artifact_comments;
create policy artifact_comments_owner_all on public.artifact_comments for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.artifact_comments from anon, authenticated;
grant select, insert, update, delete on public.artifact_comments to authenticated;
grant all on public.artifact_comments to service_role;

drop trigger if exists artifact_comments_touch_updated_at on public.artifact_comments;
create trigger artifact_comments_touch_updated_at before update on public.artifact_comments
  for each row execute function private.touch_updated_at();
