insert into public.pricing_plans
  (id, display_name, monthly_price_usd, annual_price_usd, included_credits, monthly_message_limit, daily_message_limit, daily_video_limit, concurrent_image_jobs, concurrent_video_jobs, allowed_media_types, watermark_required, media_retention_days, priority_queue, storage_gb, max_upload_mb, seat_limit, support_level, trial_days, sort_order, is_business, active, metadata)
values
  ('crew', 'Crew', 89, 852, 8000, 2600, 220, 14, 3, 2, array['image','video','audio','lipsync','image_edit','video_edit']::text[], false, 120, false, 300, 450, 5, 'standard', 0, 35, true, true, '{"checkout":true,"monthly_label":"$89/mo","annual_label":"$71/mo billed annually","audience":"Petites equipes qui demarrent","team":true,"recommended_models":["GPT Image 2","Seedance 2","MiniMax Voice"],"credit_floor_safe":true}'::jsonb),
  ('squad', 'Squad', 129, 1236, 12000, 4200, 320, 20, 6, 3, array['image','video','audio','lipsync','image_edit','video_edit']::text[], false, 150, true, 450, 600, 10, 'priority', 0, 38, true, true, '{"checkout":true,"monthly_label":"$129/mo","annual_label":"$103/mo billed annually","audience":"Equipes en pleine croissance","team":true,"popular":true,"recommended_models":["GPT Image 2","Kling 3 Pro","Veo 3","MiniMax Voice"],"credit_floor_safe":true}'::jsonb)
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
