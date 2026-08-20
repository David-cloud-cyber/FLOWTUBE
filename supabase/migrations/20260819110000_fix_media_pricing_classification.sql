-- Prevent duration-priced video endpoints from being exposed or billed as images.
-- This repairs legacy catalog rows and makes the invariant enforceable for new writes.

do $$
begin
  if to_regclass('public.pricing_models') is null then
    return;
  end if;

  update public.pricing_models
  set
    media_type = case
      when lower(coalesce(fal_endpoint, '')) like '%lipsync%' then 'lipsync'
      when lower(coalesce(fal_endpoint, '')) like '%upscale/video%'
        or lower(coalesce(fal_endpoint, '')) like '%video-to-video%'
        or lower(coalesce(fal_endpoint, '')) like '%reframe%'
        or lower(coalesce(fal_endpoint, '')) like '%subtitles%' then 'video_edit'
      when lower(coalesce(fal_endpoint, '')) like '%video%'
        or lower(coalesce(fal_endpoint, '')) like '%veo%'
        or lower(coalesce(fal_endpoint, '')) like '%kling%'
        or lower(coalesce(fal_endpoint, '')) like '%seedance%'
        or lower(coalesce(fal_endpoint, '')) like '%sora%'
        or lower(coalesce(fal_endpoint, '')) like '%gemini-omni-flash%' then 'video'
      else media_type
    end,
    action = case
      when lower(coalesce(fal_endpoint, '')) like '%lipsync%' then 'lipsync'
      when lower(coalesce(fal_endpoint, '')) like '%upscale/video%' then 'upscale_video'
      when lower(coalesce(fal_endpoint, '')) like '%subtitles%' then 'subtitles'
      when lower(coalesce(fal_endpoint, '')) like '%video-to-video%'
        or lower(coalesce(fal_endpoint, '')) like '%reframe%' then 'video_to_video'
      when lower(coalesce(fal_endpoint, '')) like '%image-to-video%' then 'image_to_video'
      when lower(coalesce(fal_endpoint, '')) like '%reference-to-video%' then 'reference_to_video'
      else 'generate_video'
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'capabilities', case
        when lower(coalesce(fal_endpoint, '')) like '%lipsync%' then jsonb_build_array('lipsync')
        when lower(coalesce(fal_endpoint, '')) like '%image-to-video%' then jsonb_build_array('image-to-video')
        when lower(coalesce(fal_endpoint, '')) like '%reference-to-video%' then jsonb_build_array('reference-to-video')
        when lower(coalesce(fal_endpoint, '')) like '%video-to-video%'
          or lower(coalesce(fal_endpoint, '')) like '%reframe%' then jsonb_build_array('video-to-video')
        else jsonb_build_array('text-to-video')
      end,
      'classification_guard', 'duration_priced_media_is_video'
    )
  where active
    and pricing_unit = 'second'
    and media_type in ('image', 'image_edit');

  -- Unknown duration-priced rows are disabled instead of being guessed as images.
  update public.pricing_models
  set active = false,
      media_type = 'video',
      action = 'generate_video',
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'disabled_reason', 'Invalid media pricing classification',
        'classification_guard', 'duration_priced_media_is_video'
      )
  where active
    and pricing_unit = 'second'
    and media_type in ('image', 'image_edit');
end $$;

alter table public.pricing_models
  drop constraint if exists pricing_models_media_unit_consistency;

alter table public.pricing_models
  add constraint pricing_models_media_unit_consistency check (
    (media_type not in ('image', 'image_edit') or pricing_unit = 'unit')
    and (media_type not in ('video', 'video_edit', 'lipsync') or pricing_unit = 'second')
  );
