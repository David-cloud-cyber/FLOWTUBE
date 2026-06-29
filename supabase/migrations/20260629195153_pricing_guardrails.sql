create table if not exists public.pricing_models (
  id text primary key,
  label text not null,
  provider text not null default 'fal.ai',
  media_type text not null check (media_type in ('image', 'video', 'audio', 'lipsync', 'image_edit', 'video_edit', 'voice_clone')),
  action text not null,
  fal_endpoint text,
  pricing_unit text not null check (pricing_unit in ('unit', 'second', 'thousand_chars')),
  cost_usd numeric(10,4),
  cost_per_unit_usd numeric(10,4) not null,
  default_units numeric(10,2) not null default 1,
  minimum_units numeric(10,2) not null default 1,
  maximum_units numeric(10,2),
  credit_floor_usd numeric(10,4) not null default 0.008,
  retail_credit_usd numeric(10,4) not null default 0.013,
  margin_multiplier numeric(10,2) not null default 3.5,
  credits integer generated always as (ceil((cost_per_unit_usd * default_units * margin_multiplier) / credit_floor_usd)::integer) stored,
  min_credits integer generated always as (ceil((cost_per_unit_usd * minimum_units * margin_multiplier) / credit_floor_usd)::integer) stored,
  requires_confirmation boolean not null default false,
  premium boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_models_positive_values check (
    cost_per_unit_usd > 0
    and default_units > 0
    and minimum_units > 0
    and credit_floor_usd > 0
    and retail_credit_usd >= credit_floor_usd
    and margin_multiplier >= 1
  )
);

create table if not exists public.pricing_plans (
  id text primary key,
  display_name text not null,
  monthly_price_usd numeric(10,2) not null default 0,
  included_credits integer not null default 0 check (included_credits >= 0),
  monthly_message_limit integer not null default 300 check (monthly_message_limit >= 0),
  daily_message_limit integer not null default 50 check (daily_message_limit >= 0),
  daily_video_limit integer not null default 1 check (daily_video_limit >= 0),
  concurrent_image_jobs integer not null default 1 check (concurrent_image_jobs >= 0),
  concurrent_video_jobs integer not null default 0 check (concurrent_video_jobs >= 0),
  allowed_media_types text[] not null default array['image']::text[],
  watermark_required boolean not null default false,
  media_retention_days integer not null default 30 check (media_retention_days >= 1),
  priority_queue boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_packs (
  id text primary key,
  label text not null,
  credits integer not null check (credits > 0),
  price_usd numeric(10,2) not null check (price_usd > 0),
  floor_credit_usd numeric(10,4) not null default 0.008,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_packs_floor_guard check ((price_usd / credits) >= floor_credit_usd)
);

create table if not exists public.pricing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  pricing_model_id text references public.pricing_models(id) on delete set null,
  credits_charged integer not null check (credits_charged >= 0),
  credit_floor_usd numeric(10,4) not null default 0.008,
  retail_credit_usd numeric(10,4) not null default 0.013,
  provider_cost_usd numeric(10,4) not null default 0,
  revenue_floor_usd numeric(10,4) generated always as ((credits_charged * credit_floor_usd)::numeric(10,4)) stored,
  revenue_retail_usd numeric(10,4) generated always as ((credits_charged * retail_credit_usd)::numeric(10,4)) stored,
  gross_margin_floor_usd numeric(10,4) generated always as (((credits_charged * credit_floor_usd) - provider_cost_usd)::numeric(10,4)) stored,
  status text not null default 'completed' check (status in ('quoted', 'completed', 'refunded', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.generations add column if not exists pricing_model_id text references public.pricing_models(id) on delete set null;
alter table public.generations add column if not exists credit_floor_usd numeric(10,4) not null default 0.008;
alter table public.generations add column if not exists retail_credit_usd numeric(10,4) not null default 0.013;
alter table public.generations add column if not exists margin_multiplier numeric(10,2) not null default 3.5;
alter table public.generations add column if not exists revenue_floor_usd numeric(10,4);
alter table public.generations add column if not exists gross_margin_floor_usd numeric(10,4);
alter table public.generations add column if not exists requires_confirmation boolean not null default false;
alter table public.generations add column if not exists confirmed_at timestamptz;
alter table public.generations add column if not exists refunded_at timestamptz;
alter table public.generations drop constraint if exists generations_type_check;
alter table public.generations add constraint generations_type_check check (type in ('image', 'video', 'audio', 'lipsync', 'image_edit', 'video_edit', 'voice_clone'));

create index if not exists pricing_models_media_type_idx on public.pricing_models(media_type, active);
create index if not exists pricing_plans_active_idx on public.pricing_plans(active);
create index if not exists credit_packs_active_idx on public.credit_packs(active);
create index if not exists pricing_audit_logs_user_created_at_idx on public.pricing_audit_logs(user_id, created_at desc);
create index if not exists pricing_audit_logs_generation_id_idx on public.pricing_audit_logs(generation_id) where generation_id is not null;

drop trigger if exists pricing_models_touch_updated_at on public.pricing_models;
create trigger pricing_models_touch_updated_at before update on public.pricing_models for each row execute function private.touch_updated_at();
drop trigger if exists pricing_plans_touch_updated_at on public.pricing_plans;
create trigger pricing_plans_touch_updated_at before update on public.pricing_plans for each row execute function private.touch_updated_at();
drop trigger if exists credit_packs_touch_updated_at on public.credit_packs;
create trigger credit_packs_touch_updated_at before update on public.credit_packs for each row execute function private.touch_updated_at();

alter table public.pricing_models enable row level security;
alter table public.pricing_plans enable row level security;
alter table public.credit_packs enable row level security;
alter table public.pricing_audit_logs enable row level security;

drop policy if exists pricing_models_public_read on public.pricing_models;
create policy pricing_models_public_read on public.pricing_models for select to anon, authenticated using (active);
drop policy if exists pricing_plans_public_read on public.pricing_plans;
create policy pricing_plans_public_read on public.pricing_plans for select to anon, authenticated using (active);
drop policy if exists credit_packs_public_read on public.credit_packs;
create policy credit_packs_public_read on public.credit_packs for select to anon, authenticated using (active);
drop policy if exists pricing_audit_logs_owner_select on public.pricing_audit_logs;
create policy pricing_audit_logs_owner_select on public.pricing_audit_logs for select to authenticated using ((select auth.uid()) = user_id);

revoke all on public.pricing_models, public.pricing_plans, public.credit_packs, public.pricing_audit_logs from anon, authenticated;
grant select on public.pricing_models, public.pricing_plans, public.credit_packs to anon, authenticated;
grant select on public.pricing_audit_logs to authenticated;
grant all on public.pricing_models, public.pricing_plans, public.credit_packs, public.pricing_audit_logs to service_role;

insert into public.pricing_models
  (id, label, media_type, action, fal_endpoint, pricing_unit, cost_usd, cost_per_unit_usd, default_units, minimum_units, maximum_units, requires_confirmation, premium, metadata)
values
  ('gpt-image-15', 'GPT Image 1.5', 'image', 'generate_image', null, 'unit', 0.009, 0.009, 1, 1, null, false, false, '{"tier":"economy"}'),
  ('seedream-lite', 'Seedream 5.0 Lite', 'image', 'generate_image', 'fal-ai/bytedance/seedream/v5/lite/text-to-image', 'unit', 0.035, 0.035, 1, 1, null, false, false, '{"tier":"economy"}'),
  ('flux', 'Flux', 'image', 'generate_image', 'fal-ai/flux/schnell', 'unit', 0.04, 0.04, 1, 1, null, false, false, '{"tier":"standard"}'),
  ('nano2', 'Nano Banana 2', 'image', 'generate_image', null, 'unit', 0.08, 0.08, 1, 1, null, false, true, '{"tier":"premium"}'),
  ('nano', 'Nano Banana Pro', 'image', 'generate_image', 'fal-ai/nano-banana-pro', 'unit', 0.15, 0.15, 1, 1, null, false, true, '{"tier":"premium"}'),
  ('nano2-edit', 'Nano Banana 2 Edit', 'image_edit', 'edit_image', null, 'unit', 0.08, 0.08, 1, 1, null, false, true, '{"tier":"premium"}'),
  ('seedream-edit', 'Seedream Lite Edit', 'image_edit', 'edit_image', null, 'unit', 0.035, 0.035, 1, 1, null, false, false, '{"tier":"economy"}'),
  ('kling', 'Kling', 'video', 'generate_video', 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', 'second', null, 0.12, 5, 5, 15, true, true, '{"tier":"premium","audio":false}'),
  ('veoq', 'Veo 3.1 Quality', 'video', 'generate_video', 'fal-ai/veo3', 'second', null, 0.20, 5, 5, 8, true, true, '{"tier":"premium","audio":false}'),
  ('veol', 'Veo 3.1 Lite', 'video', 'generate_video', 'fal-ai/veo3/fast', 'second', null, 0.10, 5, 5, 8, true, false, '{"tier":"standard","audio":false}'),
  ('seedance', 'Seedance', 'video', 'generate_video', 'fal-ai/bytedance/seedance/v1/lite/text-to-video', 'second', null, 0.08, 5, 5, 15, true, false, '{"tier":"standard","audio":false}'),
  ('veo-audio-5s', 'Veo 3.1 Audio 5s', 'video', 'generate_video', 'fal-ai/veo3', 'second', null, 0.40, 5, 5, 8, true, true, '{"tier":"premium","audio":true}'),
  ('veo-audio-8s', 'Veo 3.1 Audio 8s', 'video', 'generate_video', 'fal-ai/veo3', 'second', null, 0.40, 8, 5, 8, true, true, '{"tier":"premium","audio":true}'),
  ('kling-lipsync', 'Kling LipSync', 'lipsync', 'lipsync', null, 'second', null, 0.014, 5, 5, 60, true, false, '{"tier":"standard"}'),
  ('minimax-tts', 'MiniMax TTS', 'audio', 'generate_voice', null, 'thousand_chars', null, 0.10, 1, 1, 20, false, false, '{"tier":"standard"}'),
  ('dia-tts', 'Dia TTS', 'audio', 'generate_voice', null, 'thousand_chars', null, 0.04, 1, 1, 20, false, false, '{"tier":"economy"}'),
  ('minimax-voice-clone', 'MiniMax Voice Clone', 'voice_clone', 'clone_voice', null, 'unit', 1.50, 1.50, 1, 1, 1, true, true, '{"tier":"premium"}')
on conflict (id) do update set
  label = excluded.label,
  media_type = excluded.media_type,
  action = excluded.action,
  fal_endpoint = excluded.fal_endpoint,
  pricing_unit = excluded.pricing_unit,
  cost_usd = excluded.cost_usd,
  cost_per_unit_usd = excluded.cost_per_unit_usd,
  default_units = excluded.default_units,
  minimum_units = excluded.minimum_units,
  maximum_units = excluded.maximum_units,
  requires_confirmation = excluded.requires_confirmation,
  premium = excluded.premium,
  active = true,
  metadata = excluded.metadata;

insert into public.pricing_plans
  (id, display_name, monthly_price_usd, included_credits, monthly_message_limit, daily_message_limit, daily_video_limit, concurrent_image_jobs, concurrent_video_jobs, allowed_media_types, watermark_required, media_retention_days, priority_queue, metadata)
values
  ('free', 'Free', 0, 100, 400, 20, 0, 1, 0, array['image']::text[], true, 7, false, '{"notes":"strict free tier"}'),
  ('basic', 'Basic', 15, 1000, 300, 60, 2, 2, 1, array['image','video']::text[], false, 30, false, '{"alias":"starter"}'),
  ('starter', 'Starter', 15, 1000, 300, 60, 2, 2, 1, array['image','video']::text[], false, 30, false, '{}'),
  ('pro', 'Pro', 49, 4500, 1500, 150, 8, 4, 2, array['image','video','audio','lipsync','image_edit','video_edit']::text[], false, 90, false, '{}'),
  ('max', 'Max', 129, 12000, 4000, 300, 20, 8, 4, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 180, true, '{"alias":"studio"}'),
  ('studio', 'Studio', 129, 12000, 4000, 300, 20, 8, 4, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 180, true, '{}')
on conflict (id) do update set
  display_name = excluded.display_name,
  monthly_price_usd = excluded.monthly_price_usd,
  included_credits = excluded.included_credits,
  monthly_message_limit = excluded.monthly_message_limit,
  daily_message_limit = excluded.daily_message_limit,
  daily_video_limit = excluded.daily_video_limit,
  concurrent_image_jobs = excluded.concurrent_image_jobs,
  concurrent_video_jobs = excluded.concurrent_video_jobs,
  allowed_media_types = excluded.allowed_media_types,
  watermark_required = excluded.watermark_required,
  media_retention_days = excluded.media_retention_days,
  priority_queue = excluded.priority_queue,
  active = true,
  metadata = excluded.metadata;

insert into public.credit_packs (id, label, credits, price_usd, metadata)
values
  ('starter-topup', 'Starter top-up', 500, 6.50, '{"credit_usd":0.013}'),
  ('growth-topup', 'Growth top-up', 2500, 25.00, '{"credit_usd":0.010}'),
  ('studio-topup', 'Studio top-up', 10000, 80.00, '{"credit_usd":0.008}')
on conflict (id) do update set
  label = excluded.label,
  credits = excluded.credits,
  price_usd = excluded.price_usd,
  active = true,
  metadata = excluded.metadata;
