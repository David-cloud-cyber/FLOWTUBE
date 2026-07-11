alter table public.pricing_plans
  add column if not exists monthly_price_xof bigint,
  add column if not exists annual_price_xof bigint,
  add column if not exists pricing_version text not null default '2026-07-launch-v1';

alter table public.billing_checkout_sessions
  add column if not exists amount_xof bigint,
  add column if not exists pricing_version text,
  add column if not exists pricing_snapshot jsonb not null default '{}'::jsonb;

-- Launch grid: CFA is authoritative for MoneyFusion; USD remains a display and audit value.
insert into public.pricing_plans
  (id, display_name, monthly_price_usd, annual_price_usd, monthly_price_xof, annual_price_xof,
   included_credits, monthly_message_limit, daily_message_limit, daily_video_limit,
   concurrent_image_jobs, concurrent_video_jobs, allowed_media_types, watermark_required,
   media_retention_days, priority_queue, storage_gb, max_upload_mb, seat_limit,
   support_level, trial_days, sort_order, is_business, active, pricing_version, metadata)
values
  ('free', 'Free', 0, 0, 0, 0, 100, 60, 10, 0, 1, 0,
   array['image']::text[], true, 7, false, 1, 25, 1, 'community', 0, 0, false, true,
   '2026-07-launch-v1', '{"segment":"solo","checkout":false,"badge":"DÉCOUVERTE","tagline":"Teste HuggyFlow sans carte bancaire.","cta":"Créer un compte"}'::jsonb),
  ('basic', 'Creator', 13.17, 138.33, 7900, 83000, 500, 300, 60, 2, 2, 1,
   array['image','image_edit','video']::text[], false, 30, false, 10, 100, 1, 'standard', 0, 20, false, true,
   '2026-07-launch-v1', '{"segment":"solo","checkout":true,"badge":"POUR COMMENCER","tagline":"Les essentiels pour publier régulièrement.","cta":"Commencer avec Creator","annual_discount_percent":12.5,"recommended_models":["Seedance 2 Mini","Seedream 5.0 Lite","Flux Schnell"]}'::jsonb),
  ('pro', 'Pro', 33.17, 348.33, 19900, 209000, 1500, 900, 120, 8, 4, 2,
   array['image','image_edit','video','audio','lipsync','video_edit']::text[], false, 90, true, 100, 300, 1, 'priority', 0, 30, false, true,
   '2026-07-launch-v1', '{"segment":"solo","checkout":true,"badge":"LE PLUS CHOISI","popular":true,"tagline":"Pour créer, tester et publier chaque semaine.","cta":"Passer à Pro","annual_discount_percent":12.5,"recommended_models":["Nano Banana Pro","Seedance 2","Kling 3 Pro","Veo 3.1"]}'::jsonb),
  ('crew', 'Team', 66.50, 698.33, 39900, 419000, 3500, 1800, 180, 12, 4, 2,
   array['image','image_edit','video','audio','lipsync','video_edit']::text[], false, 120, false, 250, 450, 5, 'standard', 0, 35, false, true,
   '2026-07-launch-v1', '{"segment":"team","checkout":true,"badge":"ÉQUIPE","team":true,"tagline":"Un espace partagé pour produire ensemble.","cta":"Créer une équipe","annual_discount_percent":12.5}'::jsonb),
  ('squad', 'Squad', 133.17, 1398.33, 79900, 839000, 7000, 3600, 300, 20, 6, 3,
   array['image','image_edit','video','audio','lipsync','video_edit','voice_clone']::text[], false, 180, true, 500, 600, 10, 'priority', 0, 38, false, true,
   '2026-07-launch-v1', '{"segment":"team","checkout":true,"badge":"ÉQUIPE EN CROISSANCE","team":true,"popular":true,"tagline":"Plus de volume, plus de contrôle, moins d’attente.","cta":"Passer à Squad","annual_discount_percent":12.5}'::jsonb),
  ('max', 'Max', 249.83, 2623.33, 149900, 1574000, 13000, 6000, 450, 30, 8, 4,
   array['image','image_edit','video','audio','lipsync','video_edit','voice_clone']::text[], false, 180, true, 1000, 800, 15, 'priority', 0, 40, true, true,
   '2026-07-launch-v1', '{"segment":"business","checkout":true,"badge":"AGENCE","business":true,"tagline":"Pour les studios et agences multi-clients.","cta":"Choisir Max","annual_discount_percent":12.5}'::jsonb),
  ('scale', 'Scale', 499.83, 5248.33, 299900, 3149000, 26000, 12000, 700, 60, 14, 8,
   array['image','image_edit','video','audio','lipsync','video_edit','voice_clone']::text[], false, 365, true, 2000, 1200, 25, 'priority', 0, 50, true, true,
   '2026-07-launch-v1', '{"segment":"business","checkout":true,"badge":"SCALE","business":true,"tagline":"Un moteur de production pour plusieurs marques.","cta":"Passer à Scale","annual_discount_percent":12.5}'::jsonb),
  ('enterprise', 'Enterprise', 999.83, 10498.33, 599900, 6299000, 55000, 30000, 1500, 130, 28, 14,
   array['image','image_edit','video','audio','lipsync','video_edit','voice_clone']::text[], false, 730, true, 5000, 2000, 60, 'dedicated', 0, 60, true, true,
   '2026-07-launch-v1', '{"segment":"business","checkout":true,"badge":"ENTREPRISE","business":true,"tagline":"Capacité, sécurité et accompagnement dédiés.","cta":"Parler à l’équipe","annual_discount_percent":12.5,"dedicated_support":true}'::jsonb)
on conflict (id) do update
set display_name = excluded.display_name,
    monthly_price_usd = excluded.monthly_price_usd,
    annual_price_usd = excluded.annual_price_usd,
    monthly_price_xof = excluded.monthly_price_xof,
    annual_price_xof = excluded.annual_price_xof,
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
    active = excluded.active,
    pricing_version = excluded.pricing_version,
    metadata = coalesce(public.pricing_plans.metadata, '{}'::jsonb) || excluded.metadata;

update public.pricing_plans
set active = false
where id in ('starter', 'studio', 'business');

create index if not exists billing_checkout_sessions_amount_xof_idx
  on public.billing_checkout_sessions(provider, amount_xof, created_at desc);
