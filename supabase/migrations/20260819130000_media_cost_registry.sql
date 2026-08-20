-- HuggyFlow media cost registry: one allowlist, verified billing units and
-- auditable provider-cost metadata. Historical generations are preserved.

alter table public.pricing_models
  add column if not exists provider_cost_source text not null default 'legacy',
  add column if not exists pricing_checked_at timestamptz,
  add column if not exists infrastructure_cost_usd numeric(10,6) not null default 0,
  add column if not exists storage_cost_usd numeric(10,6) not null default 0,
  add column if not exists bandwidth_cost_usd numeric(10,6) not null default 0,
  add column if not exists polling_cost_usd numeric(10,6) not null default 0,
  add column if not exists input_processing_cost_usd numeric(10,6) not null default 0,
  add column if not exists minimum_margin_ratio numeric(6,4) not null default 0.45,
  add column if not exists fallback_route text;

-- Still images are always billed per creation. This is deliberately strict so
-- an imported duration-priced row cannot become a 500+ credit image.
update public.pricing_models
set pricing_unit = 'unit',
    default_units = 1,
    minimum_units = 1,
    maximum_units = 1,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'classification_guard', 'still_images_are_unit_priced',
      'pricing_checked_at', now()
    )
where active
  and media_type in ('image', 'image_edit');

-- Archive every historical media model outside the current public policy.
-- Rows remain available for old generation references and audit history.
update public.pricing_models
set active = false,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'disabled_reason', 'outside_huggyflow_public_media_allowlist',
      'archived_at', now()
    )
where active
  and not (
    lower(coalesce(id, '')) in (
      'openai/gpt-image-2',
      'google/gemini-3-pro-image',
      'google/gemini-3.1-flash-image',
      'bytedance-seed/seedream-5-0-pro',
      'bytedance/seedance-2.0',
      'kwaivgi/kling-v3.0-pro',
      'google/veo-3.1',
      'alibaba/wan-2.7'
    )
    or lower(coalesce(fal_endpoint, '')) like '%nano-banana-pro%'
    or lower(coalesce(fal_endpoint, '')) like '%nano-banana-2%'
    or lower(coalesce(fal_endpoint, '')) like '%seedream/v5/pro%'
    or lower(coalesce(fal_endpoint, '')) like '%gpt-image-2%'
    or lower(coalesce(fal_endpoint, '')) like '%seedance-2.0%'
    or lower(coalesce(fal_endpoint, '')) like '%seedance-2.5%'
    or lower(coalesce(fal_endpoint, '')) like '%gemini-omni-flash%'
    or lower(coalesce(fal_endpoint, '')) like '%kling-video/v3%'
    or lower(coalesce(fal_endpoint, '')) like '%veo3.1%'
    or lower(coalesce(fal_endpoint, '')) like '%wan-2.7%'
  );

-- Refresh known FAL routes with conservative public prices. Live OpenRouter
-- prices are applied by the Edge Function when its catalog confirms a route.
update public.pricing_models
set cost_per_unit_usd = case
      when lower(coalesce(fal_endpoint, '')) like '%nano-banana-pro%' then 0.1500
      when lower(coalesce(fal_endpoint, '')) like '%nano-banana-2%' then 0.0800
      when lower(coalesce(fal_endpoint, '')) like '%seedream/v5/pro%' then 0.0800
      when lower(coalesce(fal_endpoint, '')) like '%gpt-image-2%' then 0.2110
      when lower(coalesce(fal_endpoint, '')) like '%seedance-2.5%' then 0.4730
      when lower(coalesce(fal_endpoint, '')) like '%seedance-2.0%' then 0.3034
      when lower(coalesce(fal_endpoint, '')) like '%gemini-omni-flash%' then 0.1250
      when lower(coalesce(fal_endpoint, '')) like '%kling-video/v3/pro%' then 0.1680
      when lower(coalesce(fal_endpoint, '')) like '%veo3.1%' then 0.4000
      when lower(coalesce(fal_endpoint, '')) like '%wan-2.7%' then 0.1000
      else cost_per_unit_usd
    end,
    cost_usd = case
      when pricing_unit = 'unit' then case
        when lower(coalesce(fal_endpoint, '')) like '%nano-banana-pro%' then 0.1500
        when lower(coalesce(fal_endpoint, '')) like '%nano-banana-2%' then 0.0800
        when lower(coalesce(fal_endpoint, '')) like '%seedream/v5/pro%' then 0.0800
        when lower(coalesce(fal_endpoint, '')) like '%gpt-image-2%' then 0.2110
        else cost_usd
      end
      else cost_per_unit_usd * default_units
    end,
    provider_cost_source = case
      when lower(coalesce(provider, '')) = 'openrouter' then 'openrouter_live_catalog'
      else 'fal_public_catalog_conservative'
    end,
    pricing_checked_at = now(),
    infrastructure_cost_usd = case when pricing_unit = 'second' then 0.015 else 0.006 end,
    storage_cost_usd = 0.002,
    bandwidth_cost_usd = 0.001,
    polling_cost_usd = case when pricing_unit = 'second' then 0.001 else 0 end,
    input_processing_cost_usd = 0.001,
    minimum_margin_ratio = 0.45,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'cost_registry_version', '2026-08-19-media-v2',
      'minimum_margin_ratio', 0.45,
      'payment_reserve_ratio', 0.07,
      'risk_reserve_ratio', 0.10
    )
where active;

-- Recompute the audit snapshot from the freshly assigned unit cost. PostgreSQL
-- evaluates sibling assignments from the previous row value in the same UPDATE.
update public.pricing_models
set cost_usd = cost_per_unit_usd * default_units
where active
  and pricing_unit = 'second';

alter table public.pricing_models
  drop constraint if exists pricing_models_cost_registry_unit_guard;

alter table public.pricing_models
  add constraint pricing_models_cost_registry_unit_guard check (
    (media_type in ('image', 'image_edit') and pricing_unit = 'unit')
    or (media_type not in ('image', 'image_edit'))
  );

create index if not exists pricing_models_cost_registry_active_idx
  on public.pricing_models(active, provider_cost_source, pricing_checked_at desc);
