-- Real MFA state and encrypted connector credential storage.
-- Secrets are written only by the service role Edge Function.

create table if not exists public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_type text not null default 'Bearer',
  scope text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.integration_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists integration_oauth_states_expiry_idx
  on public.integration_oauth_states (expires_at);

alter table public.integration_secrets enable row level security;
alter table public.integration_oauth_states enable row level security;
revoke all on public.integration_secrets, public.integration_oauth_states from anon, authenticated;
grant all on public.integration_secrets, public.integration_oauth_states to service_role;

drop trigger if exists integration_secrets_touch_updated_at on public.integration_secrets;
create trigger integration_secrets_touch_updated_at before update on public.integration_secrets
  for each row execute function private.touch_updated_at();
