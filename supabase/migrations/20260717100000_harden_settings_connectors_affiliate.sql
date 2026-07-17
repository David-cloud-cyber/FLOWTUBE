-- Harden settings capabilities and make connector/affiliate state auditable.

alter table public.api_keys
  add column if not exists expires_at timestamptz,
  add column if not exists last_rotated_at timestamptz;

alter table public.integration_connections
  add column if not exists permissions jsonb not null default '{}'::jsonb,
  add column if not exists sync_status text not null default 'idle',
  add column if not exists last_tested_at timestamptz,
  add column if not exists last_synced_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'integration_connections_sync_status_check'
      and conrelid = 'public.integration_connections'::regclass
  ) then
    alter table public.integration_connections
      add constraint integration_connections_sync_status_check
      check (sync_status in ('idle', 'healthy', 'pending', 'error'));
  end if;
end $$;

alter table public.affiliate_accounts
  add column if not exists payout_method text not null default 'email',
  add column if not exists payout_status text not null default 'not_configured',
  add column if not exists min_payout_usd numeric(12,2) not null default 50,
  add column if not exists pending_earnings_usd numeric(12,2) not null default 0,
  add column if not exists available_earnings_usd numeric(12,2) not null default 0,
  add column if not exists paid_earnings_usd numeric(12,2) not null default 0;

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  ip_hash text not null,
  user_agent_hash text,
  session_id text,
  landing_path text,
  created_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_user_created_idx
  on public.affiliate_clicks(affiliate_user_id, created_at desc);
create index if not exists affiliate_clicks_dedup_idx
  on public.affiliate_clicks(affiliate_user_id, ip_hash, created_at desc);

create table if not exists public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric(12,2) not null check (amount_usd > 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'rejected', 'cancelled')),
  payout_method text not null default 'email',
  destination_masked text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists affiliate_payouts_user_created_idx
  on public.affiliate_payouts(affiliate_user_id, requested_at desc);

delete from public.affiliate_referrals older
using public.affiliate_referrals newer
where older.referred_user_id is not null
  and older.referred_user_id = newer.referred_user_id
  and older.ctid > newer.ctid;

create unique index if not exists affiliate_referrals_referred_unique
  on public.affiliate_referrals(referred_user_id)
  where referred_user_id is not null;

alter table public.affiliate_clicks enable row level security;
alter table public.affiliate_payouts enable row level security;

revoke all on public.affiliate_clicks from anon, authenticated;
revoke all on public.affiliate_payouts from anon, authenticated;
grant all on public.affiliate_clicks to service_role;
grant select on public.affiliate_payouts to authenticated;
grant all on public.affiliate_payouts to service_role;

drop policy if exists affiliate_payouts_owner_select on public.affiliate_payouts;
create policy affiliate_payouts_owner_select on public.affiliate_payouts
  for select to authenticated
  using ((select auth.uid()) = affiliate_user_id);

create or replace function public.sync_affiliate_account_totals(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  update public.affiliate_accounts a
  set pending_earnings_usd = coalesce((select sum(amount_usd) from public.affiliate_referrals r where r.affiliate_user_id = p_user_id and r.status in ('pending', 'trial')), 0),
      available_earnings_usd = coalesce((select sum(amount_usd) from public.affiliate_referrals r where r.affiliate_user_id = p_user_id and r.status = 'active'), 0),
      paid_earnings_usd = coalesce((select sum(amount_usd) from public.affiliate_payouts p where p.affiliate_user_id = p_user_id and p.status = 'paid'), 0),
      updated_at = now()
  where a.user_id = p_user_id;
end;
$$;

revoke all on function public.sync_affiliate_account_totals(uuid) from public, anon, authenticated;
grant execute on function public.sync_affiliate_account_totals(uuid) to service_role;
