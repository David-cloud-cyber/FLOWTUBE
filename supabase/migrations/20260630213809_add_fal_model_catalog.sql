with endpoints(endpoint) as (
  values
    ('bytedance/seedance-2.0/image-to-video'),
    ('bytedance/seedance-2.0/fast/image-to-video'),
    ('bytedance/seedance-2.0/fast/reference-to-video'),
    ('bytedance/seedance-2.0/fast/text-to-video'),
    ('bytedance/seedance-2.0/mini/image-to-video'),
    ('bytedance/seedance-2.0/mini/reference-to-video'),
    ('bytedance/seedance-2.0/mini/text-to-video'),
    ('bytedance/seedance-2.0/reference-to-video'),
    ('bytedance/seedance-2.0/text-to-video'),
    ('fal-ai/krea-2/turbo'),
    ('fal-ai/krea-2/turbo/lora'),
    ('alibaba/happy-horse/v1.1/image-to-video'),
    ('alibaba/happy-horse/v1.1/reference-to-video'),
    ('alibaba/happy-horse/v1.1/text-to-video'),
    ('fal-ai/kling-video/v3/pro/image-to-video'),
    ('fal-ai/kling-video/v3/4k/image-to-video'),
    ('fal-ai/kling-video/v3/4k/text-to-video'),
    ('fal-ai/kling-video/v3/pro/text-to-video'),
    ('fal-ai/kling-video/v3/standard/image-to-video'),
    ('fal-ai/kling-video/v3/standard/text-to-video'),
    ('fal-ai/pixverse/v6/image-to-video'),
    ('fal-ai/nano-banana-2/edit'),
    ('fal-ai/nano-banana-2'),
    ('openai/gpt-image-2/edit'),
    ('openai/gpt-image-2'),
    ('fal-ai/nano-banana-pro/edit'),
    ('fal-ai/nano-banana-pro'),
    ('fal-ai/flux/schnell'),
    ('fal-ai/flux/dev'),
    ('fal-ai/flux/dev/image-to-image'),
    ('fal-ai/flux/dev/redux'),
    ('fal-ai/flux/schnell/redux'),
    ('fal-ai/bytedance/seedream/v4.5/edit'),
    ('fal-ai/bytedance/seedream/v4.5/text-to-image'),
    ('fal-ai/bytedance/seedream/v5/lite/text-to-image'),
    ('fal-ai/flux-2-pro'),
    ('fal-ai/flux-2-pro/edit'),
    ('fal-ai/flux-2-pro/outpaint'),
    ('fal-ai/bria/background/remove'),
    ('fal-ai/elevenlabs/voice-changer'),
    ('fal-ai/elevenlabs/dubbing'),
    ('fal-ai/elevenlabs/speech-to-text/scribe-v2'),
    ('fal-ai/elevenlabs/music'),
    ('fal-ai/elevenlabs/text-to-dialogue/eleven-v3'),
    ('fal-ai/heygen/avatar5/digital-twin'),
    ('fal-ai/heygen/v3/video-agent'),
    ('fal-ai/heygen/v3/lipsync/precision'),
    ('fal-ai/heygen/v3/lipsync/speed'),
    ('fal-ai/heygen/avatar4/image-to-video'),
    ('fal-ai/heygen/avatar4/digital-twin'),
    ('fal-ai/heygen/v2/translate/speed'),
    ('fal-ai/heygen/v2/translate/precision'),
    ('fal-ai/heygen/avatar3/digital-twin'),
    ('fal-ai/heygen/v2/video-agent'),
    ('google/gemini-omni-flash/image-to-video'),
    ('google/gemini-omni-flash/edit'),
    ('google/gemini-omni-flash'),
    ('fal-ai/veo3'),
    ('fal-ai/veo3/fast'),
    ('fal-ai/veo3.1/lite/first-last-frame-to-video'),
    ('fal-ai/veo3.1/lite/image-to-video'),
    ('fal-ai/veo3.1/fast/extend-video'),
    ('fal-ai/veo3.1/extend-video'),
    ('fal-ai/gemini-3.1-flash-image-preview/edit'),
    ('fal-ai/gemini-3.1-flash-image-preview'),
    ('fal-ai/lyria3/pro'),
    ('fal-ai/gemini-3.1-flash-tts'),
    ('luma/agent/ray/v3.2/video-to-video'),
    ('luma/agent/ray/v3.2/reframe'),
    ('luma/agent/ray/v3.2/text-to-video'),
    ('luma/agent/ray/v3.2/image-to-video'),
    ('luma/agent/uni-1/v1/edit'),
    ('luma/agent/uni-1/v1/max'),
    ('luma/agent/uni-1/v1/max/edit'),
    ('luma/agent/uni-1/v1/text-to-image'),
    ('bria/fibo-edit/edit'),
    ('fal-ai/minimax/speech-2.8-hd'),
    ('fal-ai/minimax/speech-2.8-turbo'),
    ('fal-ai/minimax/voice-clone'),
    ('xai/grok-imagine-video/v1.5/image-to-video'),
    ('xai/grok-imagine-image/quality/text-to-image'),
    ('xai/grok-imagine-image/quality/edit'),
    ('xai/grok-imagine-video/reference-to-video'),
    ('xai/grok-imagine-video/extend-video'),
    ('xai/grok-imagine-image/edit'),
    ('veed/subtitles'),
    ('veed/fabric-1.0/text'),
    ('veed/fabric-1.0'),
    ('veed/avatars/text-to-video'),
    ('veed/avatars/audio-to-video'),
    ('veed/video-background-removal/fast'),
    ('veed/video-background-removal'),
    ('veed/video-background-removal/green-screen'),
    ('fal-ai/creatify/aurora'),
    ('fal-ai/bytedance/omnihuman/v1.5'),
    ('fal-ai/sync-lipsync/v3/image-to-video'),
    ('fal-ai/sync-lipsync/v3'),
    ('fal-ai/seedvr/upscale/image'),
    ('fal-ai/topaz/upscale/video'),
    ('fal-ai/ideogram/remove-background'),
    ('sonilo/v1.1/text-to-music')
),
classified as (
  select
    endpoint,
    case endpoint
      when 'fal-ai/nano-banana-pro' then 'nano'
      when 'fal-ai/nano-banana-2' then 'nano2'
      when 'fal-ai/nano-banana-2/edit' then 'nano2-edit'
      when 'fal-ai/flux/schnell' then 'flux'
      when 'fal-ai/bytedance/seedream/v5/lite/text-to-image' then 'seedream-lite'
      when 'fal-ai/veo3' then 'veoq'
      when 'fal-ai/veo3/fast' then 'veol'
      when 'openai/gpt-image-2' then 'gpt-image-2'
      when 'openai/gpt-image-2/edit' then 'gpt-image-2-edit'
      when 'fal-ai/gemini-3.1-flash-image-preview' then 'gemini-flash-image'
      when 'fal-ai/gemini-3.1-flash-image-preview/edit' then 'gemini-flash-image-edit'
      when 'fal-ai/minimax/speech-2.8-hd' then 'minimax-tts'
      when 'fal-ai/minimax/speech-2.8-turbo' then 'minimax-tts-turbo'
      when 'fal-ai/minimax/voice-clone' then 'minimax-voice-clone'
      when 'fal-ai/gemini-3.1-flash-tts' then 'gemini-flash-tts'
      when 'fal-ai/lyria3/pro' then 'lyria3-pro'
      when 'sonilo/v1.1/text-to-music' then 'sonilo-music'
      else lower(trim(both '-' from regexp_replace(regexp_replace(endpoint, '^fal-ai/', ''), '[^a-zA-Z0-9]+', '-', 'g')))
    end as id,
    initcap(regexp_replace(regexp_replace(regexp_replace(endpoint, '^fal-ai/', ''), '/', ' ', 'g'), '[-_]+', ' ', 'g')) as label,
    lower(endpoint) as e
  from endpoints
),
typed as (
  select
    *,
    case
      when e like '%lipsync%' then 'lipsync'
      when e like '%voice-clone%' or e like '%digital-twin%' then 'voice_clone'
      when e like '%speech%' or e like '%tts%' or e like '%music%' or e like '%lyria%' or e like '%text-to-music%' or e like '%dubbing%' or e like '%translate%' or e like '%voice-changer%' then 'audio'
      when e like '%video-to-video%' or e like '%reframe%' or e like '%upscale/video%' or e like '%subtitles%' or e like '%video-background-removal%' then 'video_edit'
      when e like '%edit%' or e like '%outpaint%' or e like '%background/remove%' or e like '%remove-background%' or e like '%image-to-image%' or e like '%redux%' or e like '%upscale/image%' then 'image_edit'
      when e in ('fal-ai/veo3', 'fal-ai/veo3/fast') then 'video'
      when e like '%video%' or e like '%avatar%' or e like '%omnihuman%' then 'video'
      else 'image'
    end as media_type,
    case
      when e in ('fal-ai/veo3', 'fal-ai/veo3/fast') then 'text-to-video'
      when e like '%reference-to-video%' then 'reference-to-video'
      when e like '%image-to-video%' then 'image-to-video'
      when e like '%text-to-video%' then 'text-to-video'
      when e like '%extend-video%' then 'extend-video'
      when e like '%video-to-video%' then 'video-to-video'
      when e like '%first-last-frame%' then 'first-last-frame-to-video'
      when e like '%text-to-image%' then 'text-to-image'
      when e like '%/edit%' or e like '%fibo-edit%' then 'edit'
      when e like '%image-to-image%' or e like '%redux%' then 'image-to-image'
      when e like '%remove-background%' or e like '%background/remove%' then 'remove-background'
      when e like '%outpaint%' then 'outpaint'
      when e like '%upscale/image%' then 'image-upscale'
      when e like '%upscale/video%' then 'video-upscale'
      when e like '%lipsync%' then 'lipsync'
      when e like '%voice-clone%' or e like '%digital-twin%' then 'voice-clone'
      when e like '%music%' or e like '%lyria%' or e like '%text-to-music%' then 'music'
      when e like '%speech-to-text%' then 'speech-to-text'
      when e like '%speech%' or e like '%tts%' or e like '%text-to-dialogue%' then 'tts'
      when e like '%dubbing%' or e like '%translate%' then 'dubbing'
      when e like '%subtitles%' then 'subtitles'
      else 'text-to-image'
    end as capability,
    case
      when e like '%4k%' or e like '%pro%' or e like '%quality%' or e like '%max%' or e like '%gpt-image-2%' or e like '%nano-banana-pro%' then 'premium'
      when e like '%mini%' or e like '%schnell%' or e like '%lite%' or e like '%fast%' or e like '%turbo%' then 'economy'
      else 'standard'
    end as quality_tier
  from classified
),
priced as (
  select
    *,
    case
      when e like '%4k%' then 0.35
      when e like '%veo3.1%' or e like '%veo3%' then case when e like '%lite%' or e like '%fast%' then 0.10 else 0.20 end
      when e like '%kling-video/v3/pro%' then 0.18
      when e like '%kling-video/v3/standard%' then 0.12
      when e like '%seedance-2.0/mini%' then 0.06
      when e like '%seedance-2.0/fast%' then 0.08
      when e like '%seedance-2.0%' then 0.12
      when e like '%ray/v3.2%' then 0.18
      when e like '%grok-imagine-video%' then 0.18
      when e like '%happy-horse%' or e like '%pixverse%' then 0.08
      when e like '%avatar%' or e like '%heygen%' or e like '%omnihuman%' then 0.14
      when media_type in ('video','video_edit','lipsync') then 0.10
      when e like '%voice-clone%' or e like '%digital-twin%' then 1.50
      when capability = 'music' then 0.08
      when media_type = 'audio' then 0.05
      when e like '%gpt-image-2%' or e like '%nano-banana-pro%' then 0.08
      when e like '%nano-banana-2%' then 0.08
      when e like '%flux-2-pro%' then 0.06
      when e like '%flux/dev%' then 0.04
      when e like '%flux/schnell%' then 0.04
      when e like '%seedream%' then 0.035
      when e like '%remove-background%' or e like '%background/remove%' then 0.01
      else 0.04
    end::numeric(10,4) as cost_per_unit_usd,
    case when media_type in ('video','video_edit','lipsync') or capability = 'music' then 'second' when media_type = 'audio' then 'thousand_chars' else 'unit' end as pricing_unit,
    case when capability = 'music' then 30 when media_type in ('video','video_edit','lipsync') then 5 else 1 end::numeric(10,2) as default_units,
    case when capability = 'music' then 10 when media_type in ('video','video_edit','lipsync') then 5 else 1 end::numeric(10,2) as minimum_units,
    case
      when e like '%veo3%' then 8
      when capability = 'music' then 120
      when media_type in ('video','video_edit') then case when e like '%4k%' then 10 else 15 end
      when media_type = 'lipsync' then 60
      when media_type = 'audio' then 20
      else null
    end::numeric(10,2) as maximum_units
  from typed
)
insert into public.pricing_models
  (id, label, provider, media_type, action, fal_endpoint, pricing_unit, cost_usd, cost_per_unit_usd, default_units, minimum_units, maximum_units, credit_floor_usd, retail_credit_usd, margin_multiplier, requires_confirmation, premium, active, metadata)
select
  id,
  case id
    when 'nano' then 'Nano Banana Pro'
    when 'nano2' then 'Nano Banana 2'
    when 'nano2-edit' then 'Nano Banana 2 Edit'
    when 'flux' then 'Flux Schnell'
    when 'seedream-lite' then 'Seedream 5.0 Lite'
    when 'veoq' then 'Veo 3.1 Quality'
    when 'veol' then 'Veo 3.1 Lite'
    when 'gpt-image-2' then 'GPT Image 2'
    when 'gpt-image-2-edit' then 'GPT Image 2 Edit'
    when 'gemini-flash-image' then 'Gemini 3.1 Flash Image'
    when 'gemini-flash-image-edit' then 'Gemini 3.1 Flash Image Edit'
    when 'minimax-tts' then 'MiniMax Speech 2.8 HD'
    when 'minimax-tts-turbo' then 'MiniMax Speech 2.8 Turbo'
    when 'minimax-voice-clone' then 'MiniMax Voice Clone'
    when 'gemini-flash-tts' then 'Gemini 3.1 Flash TTS'
    when 'lyria3-pro' then 'Lyria 3 Pro'
    when 'sonilo-music' then 'Sonilo 1.1 Music'
    else label
  end,
  'fal.ai',
  media_type,
  case
    when capability = 'text-to-image' then 'generate_image'
    when capability in ('edit', 'image-to-image', 'outpaint') then 'edit_image'
    when capability = 'remove-background' then 'remove_background'
    when capability = 'image-upscale' then 'upscale_image'
    when capability = 'text-to-video' then 'generate_video'
    when capability = 'image-to-video' then 'image_to_video'
    when capability = 'reference-to-video' then 'reference_to_video'
    when capability = 'first-last-frame-to-video' then 'first_last_frame_to_video'
    when capability = 'extend-video' then 'extend_video'
    when capability = 'video-to-video' then 'video_to_video'
    when capability = 'video-upscale' then 'upscale_video'
    when capability = 'lipsync' then 'lipsync'
    when capability = 'voice-clone' then 'clone_voice'
    when capability = 'music' then 'generate_music'
    when capability = 'speech-to-text' then 'speech_to_text'
    when capability = 'tts' then 'generate_voice'
    when capability = 'dubbing' then 'dubbing'
    when capability = 'subtitles' then 'subtitles'
    else replace(capability, '-', '_')
  end,
  endpoint,
  pricing_unit,
  cost_per_unit_usd * default_units,
  cost_per_unit_usd,
  default_units,
  minimum_units,
  maximum_units,
  0.008,
  0.013,
  3.5,
  (media_type not in ('image','image_edit') or quality_tier = 'premium' or cost_per_unit_usd >= 0.08),
  quality_tier = 'premium',
  true,
  jsonb_build_object(
    'provider', 'fal.ai',
    'endpoint', endpoint,
    'capabilities', jsonb_build_array(capability),
    'quality_tier', quality_tier,
    'input_profile', case
      when capability = 'first-last-frame-to-video' then 'first_last_frame'
      when capability = 'reference-to-video' then 'reference_video'
      when capability = 'image-to-video' then 'image_video'
      when capability in ('extend-video','video-to-video') then 'video_reference'
      when media_type in ('image_edit') then 'image_edit'
      when capability = 'lipsync' then 'lipsync'
      when media_type = 'audio' then 'audio_prompt'
      else 'text_prompt'
    end,
    'family', split_part(endpoint, '/', 1),
    'fal_only', true,
    'cost_estimate', true
  )
from priced
on conflict (id) do update set
  label = excluded.label,
  provider = 'fal.ai',
  media_type = excluded.media_type,
  action = excluded.action,
  fal_endpoint = excluded.fal_endpoint,
  pricing_unit = excluded.pricing_unit,
  cost_usd = excluded.cost_usd,
  cost_per_unit_usd = excluded.cost_per_unit_usd,
  default_units = excluded.default_units,
  minimum_units = excluded.minimum_units,
  maximum_units = excluded.maximum_units,
  credit_floor_usd = excluded.credit_floor_usd,
  retail_credit_usd = excluded.retail_credit_usd,
  margin_multiplier = excluded.margin_multiplier,
  requires_confirmation = excluded.requires_confirmation,
  premium = excluded.premium,
  active = true,
  metadata = coalesce(public.pricing_models.metadata, '{}'::jsonb) || excluded.metadata;

update public.pricing_models
set active = false,
    metadata = coalesce(metadata, '{}'::jsonb) || '{"disabled_reason":"No fal.ai endpoint configured after fal-only catalog update"}'::jsonb
where coalesce(fal_endpoint, '') = '';
