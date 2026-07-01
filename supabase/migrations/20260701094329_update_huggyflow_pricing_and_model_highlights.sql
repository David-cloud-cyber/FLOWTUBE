insert into public.pricing_plans
  (id, display_name, monthly_price_usd, annual_price_usd, included_credits, monthly_message_limit, daily_message_limit, daily_video_limit, concurrent_image_jobs, concurrent_video_jobs, allowed_media_types, watermark_required, media_retention_days, priority_queue, storage_gb, max_upload_mb, seat_limit, support_level, trial_days, sort_order, is_business, active, metadata)
values
  ('basic', 'Creator', 19, 180, 1600, 500, 80, 2, 2, 1, array['image','video','image_edit']::text[], false, 30, false, 20, 120, 1, 'standard', 0, 20, false, true, '{"checkout":true,"monthly_label":"$19/mo","annual_label":"$15/mo billed annually","audience":"Createurs solo","recommended_models":["GPT Image 2","GPT Image Edit","Seedance 2"],"credit_floor_safe":true}'::jsonb),
  ('pro', 'Pro', 59, 588, 5500, 1800, 180, 10, 5, 2, array['image','video','audio','lipsync','image_edit','video_edit']::text[], false, 90, false, 150, 300, 3, 'priority', 0, 30, false, true, '{"checkout":true,"monthly_label":"$59/mo","annual_label":"$49/mo billed annually","audience":"Production contenu chaque semaine","popular":true,"recommended_models":["GPT Image 2","Veo 3","Seedance 2","MiniMax Voice"],"credit_floor_safe":true}'::jsonb),
  ('max', 'Max', 149, 1428, 15000, 5000, 350, 26, 9, 4, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 180, true, 600, 600, 8, 'priority', 0, 40, true, true, '{"checkout":true,"monthly_label":"$149/mo","annual_label":"$119/mo billed annually","audience":"Studio et petites equipes","best_value":true,"recommended_models":["GPT Image 2","Kling 3 Pro","Veo 3","HeyGen Lipsync"],"credit_floor_safe":true}'::jsonb),
  ('scale', 'Scale', 299, 2868, 30000, 12000, 700, 60, 14, 8, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 365, true, 1500, 1000, 20, 'priority', 0, 50, true, true, '{"checkout":true,"monthly_label":"$299/mo","annual_label":"$239/mo billed annually","audience":"Agences multi-clients","business":true,"recommended_models":["Kling 3 4K","Veo 3","Ray 3.2","Lyria Music"],"credit_floor_safe":true}'::jsonb),
  ('enterprise', 'Enterprise', 599, 5988, 60000, 30000, 1500, 130, 28, 14, array['image','video','audio','lipsync','image_edit','video_edit','voice_clone']::text[], false, 730, true, 5000, 2000, 60, 'dedicated', 0, 60, true, true, '{"checkout":true,"monthly_label":"$599/mo","annual_label":"$499/mo billed annually","audience":"Production intensive et organisations","business":true,"dedicated_support":true,"recommended_models":["Veo 3","Kling 3 4K","HeyGen Lipsync","Voice Clone"],"credit_floor_safe":true}'::jsonb)
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

update public.pricing_plans
set active = false,
    metadata = coalesce(metadata, '{}'::jsonb) || '{"hidden_alias":true}'::jsonb
where id in ('starter', 'studio');
