create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

create table if not exists public.profiles (
  id uuid primary key,
  email text unique,
  display_name text not null default 'Utilisateur',
  plan text not null default 'free',
  credits integer not null default 1240 check (credits >= 0),
  credits_max integer not null default 1800 check (credits_max > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nouveau projet',
  archived boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null default 'Conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  type text not null check (type in ('image', 'video', 'audio', 'lipsync', 'image_edit', 'video_edit')),
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  model_id text not null,
  model_label text not null,
  provider text not null default 'fal.ai',
  fal_job_id text,
  prompt text not null default '',
  aspect_ratio text not null default '4:5',
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  result_url text,
  error_message text,
  credits integer not null default 0 check (credits >= 0),
  cost_usd numeric(10,4),
  debited_at timestamptz,
  params jsonb not null default '{}'::jsonb,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  reference_image_urls text[] not null default array[]::text[],
  fal_ref_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint collection_items_has_item check (generation_id is not null or project_id is not null)
);

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  amount integer not null,
  reason text not null,
  balance_after integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists projects_user_id_created_at_idx on public.projects(user_id, created_at desc);
create index if not exists conversations_user_project_idx on public.conversations(user_id, project_id);
create index if not exists messages_conversation_created_at_idx on public.messages(conversation_id, created_at);
create index if not exists messages_user_id_idx on public.messages(user_id);
create index if not exists generations_user_status_idx on public.generations(user_id, status, created_at desc);
create index if not exists generations_project_created_at_idx on public.generations(project_id, created_at desc);
create index if not exists generations_fal_job_id_idx on public.generations(fal_job_id) where fal_job_id is not null;
create index if not exists characters_user_id_idx on public.characters(user_id);
create index if not exists collections_user_id_idx on public.collections(user_id);
create index if not exists collection_items_user_collection_idx on public.collection_items(user_id, collection_id);
create index if not exists collection_items_generation_id_idx on public.collection_items(generation_id) where generation_id is not null;
create index if not exists credit_transactions_user_created_at_idx on public.credit_transactions(user_id, created_at desc);
create index if not exists app_events_user_created_at_idx on public.app_events(user_id, created_at desc);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
drop trigger if exists projects_touch_updated_at on public.projects;
create trigger projects_touch_updated_at before update on public.projects for each row execute function private.touch_updated_at();
drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at before update on public.conversations for each row execute function private.touch_updated_at();
drop trigger if exists generations_touch_updated_at on public.generations;
create trigger generations_touch_updated_at before update on public.generations for each row execute function private.touch_updated_at();
drop trigger if exists characters_touch_updated_at on public.characters;
create trigger characters_touch_updated_at before update on public.characters for each row execute function private.touch_updated_at();
drop trigger if exists collections_touch_updated_at on public.collections;
create trigger collections_touch_updated_at before update on public.collections for each row execute function private.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.generations enable row level security;
alter table public.characters enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.app_events enable row level security;

drop policy if exists profiles_owner_select on public.profiles;
create policy profiles_owner_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists profiles_owner_insert on public.profiles;
create policy profiles_owner_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists profiles_owner_update on public.profiles;
create policy profiles_owner_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists conversations_owner_all on public.conversations;
create policy conversations_owner_all on public.conversations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists messages_owner_all on public.messages;
create policy messages_owner_all on public.messages for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists generations_owner_all on public.generations;
create policy generations_owner_all on public.generations for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists characters_owner_all on public.characters;
create policy characters_owner_all on public.characters for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists collections_owner_all on public.collections;
create policy collections_owner_all on public.collections for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists collection_items_owner_all on public.collection_items;
create policy collection_items_owner_all on public.collection_items for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists credit_transactions_owner_select on public.credit_transactions;
create policy credit_transactions_owner_select on public.credit_transactions for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists app_events_owner_select on public.app_events;
create policy app_events_owner_select on public.app_events for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.profiles, public.projects, public.conversations, public.messages, public.generations, public.characters, public.collections, public.collection_items, public.credit_transactions, public.app_events from anon;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.profiles, public.projects, public.conversations, public.messages, public.generations, public.characters, public.collections, public.collection_items to authenticated;
grant select on public.credit_transactions, public.app_events to authenticated;
grant all on public.profiles, public.projects, public.conversations, public.messages, public.generations, public.characters, public.collections, public.collection_items, public.credit_transactions, public.app_events to service_role;
