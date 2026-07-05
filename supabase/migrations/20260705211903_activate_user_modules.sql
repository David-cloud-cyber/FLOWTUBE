-- User-facing modules: team, API keys, affiliate program.
-- All tables live in public with explicit grants + RLS owner policies.

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  member_user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  display_name text,
  role text not null default 'editor' check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'pending', 'disabled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_owner_idx on public.team_members(owner_id, created_at desc);
create index if not exists team_members_member_user_idx on public.team_members(member_user_id) where member_user_id is not null;
create unique index if not exists team_members_owner_email_key on public.team_members(owner_id, lower(email));

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists team_invites_owner_idx on public.team_invites(owner_id, created_at desc);
create index if not exists team_invites_email_idx on public.team_invites(lower(email));

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Cle API',
  key_hash text not null unique,
  key_prefix text not null,
  scopes text[] not null default array['chat', 'generate']::text[],
  last_used_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_keys_user_idx on public.api_keys(user_id, created_at desc);
create index if not exists api_keys_active_hash_idx on public.api_keys(key_hash) where revoked_at is null;

create table if not exists public.affiliate_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null unique,
  payout_email text,
  status text not null default 'active' check (status in ('active', 'paused', 'blocked')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliate_referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  referred_user_id uuid references public.profiles(id) on delete set null,
  email text,
  status text not null default 'pending' check (status in ('pending', 'trial', 'active', 'cancelled', 'paid')),
  amount_usd numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create index if not exists affiliate_referrals_user_idx on public.affiliate_referrals(affiliate_user_id, created_at desc);
create index if not exists affiliate_referrals_referred_idx on public.affiliate_referrals(referred_user_id) where referred_user_id is not null;

alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;
alter table public.api_keys enable row level security;
alter table public.affiliate_accounts enable row level security;
alter table public.affiliate_referrals enable row level security;

grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.team_invites to authenticated;
grant select, insert, update, delete on public.api_keys to authenticated;
grant select, insert, update, delete on public.affiliate_accounts to authenticated;
grant select, insert, update, delete on public.affiliate_referrals to authenticated;

grant select, insert, update, delete on public.team_members to service_role;
grant select, insert, update, delete on public.team_invites to service_role;
grant select, insert, update, delete on public.api_keys to service_role;
grant select, insert, update, delete on public.affiliate_accounts to service_role;
grant select, insert, update, delete on public.affiliate_referrals to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_members' and policyname='team_members_owner_all') then
    create policy team_members_owner_all on public.team_members
      for all to authenticated
      using ((select auth.uid()) = owner_id)
      with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='team_invites' and policyname='team_invites_owner_all') then
    create policy team_invites_owner_all on public.team_invites
      for all to authenticated
      using ((select auth.uid()) = owner_id)
      with check ((select auth.uid()) = owner_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='api_keys' and policyname='api_keys_owner_all') then
    create policy api_keys_owner_all on public.api_keys
      for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='affiliate_accounts' and policyname='affiliate_accounts_owner_all') then
    create policy affiliate_accounts_owner_all on public.affiliate_accounts
      for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='affiliate_referrals' and policyname='affiliate_referrals_owner_all') then
    create policy affiliate_referrals_owner_all on public.affiliate_referrals
      for all to authenticated
      using ((select auth.uid()) = affiliate_user_id)
      with check ((select auth.uid()) = affiliate_user_id);
  end if;
end $$;
