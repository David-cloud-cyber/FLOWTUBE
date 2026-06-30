alter table public.billing_checkout_sessions
  add column if not exists provider text not null default 'stripe',
  add column if not exists provider_session_id text,
  add column if not exists provider_payment_token text,
  add column if not exists provider_payload jsonb not null default '{}'::jsonb;

create index if not exists billing_checkout_sessions_provider_session_idx
  on public.billing_checkout_sessions(provider, provider_session_id)
  where provider_session_id is not null;

create index if not exists billing_checkout_sessions_provider_token_idx
  on public.billing_checkout_sessions(provider, provider_payment_token)
  where provider_payment_token is not null;

insert into public.pricing_plans
  (id, display_name, monthly_price_usd, annual_price_usd, included_credits, monthly_message_limit, daily_message_limit, daily_video_limit, concurrent_image_jobs, concurrent_video_jobs, allowed_media_types, watermark_required, media_retention_days, priority_queue, storage_gb, max_upload_mb, seat_limit, support_level, trial_days, sort_order, is_business, active, metadata)
values
  ('scale', 'Scale', 249, 2388, 28000, 10000, 650, 55, 14, 8, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 365, true, 1500, 1000, 25, 'priority', 0, 40, true, true, '{"checkout":true,"monthly_label":"$249/mo","annual_label":"$199/mo billed annually","audience":"Agences et equipes en volume","business":true}'::jsonb),
  ('enterprise', 'Enterprise', 499, 4788, 65000, 30000, 1500, 140, 30, 16, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 730, true, 5000, 2000, 75, 'dedicated', 0, 50, true, true, '{"checkout":true,"monthly_label":"$499/mo","annual_label":"$399/mo billed annually","audience":"Production intensive et organisations","business":true,"dedicated_support":true}'::jsonb)
on conflict (id) do update
set display_name = excluded.display_name,
    monthly_price_usd = excluded.monthly_price_usd,
    annual_price_usd = excluded.annual_price_usd,
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
    storage_gb = excluded.storage_gb,
    max_upload_mb = excluded.max_upload_mb,
    seat_limit = excluded.seat_limit,
    support_level = excluded.support_level,
    trial_days = excluded.trial_days,
    sort_order = excluded.sort_order,
    is_business = excluded.is_business,
    active = true,
    metadata = coalesce(public.pricing_plans.metadata, '{}'::jsonb) || excluded.metadata;
