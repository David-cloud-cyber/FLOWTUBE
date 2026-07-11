create index if not exists brand_assets_brand_kit_id_idx
  on public.brand_assets (brand_kit_id);

create index if not exists brand_assets_media_asset_id_idx
  on public.brand_assets (media_asset_id);

create index if not exists brand_assets_user_id_idx
  on public.brand_assets (user_id);

create index if not exists creative_templates_brand_kit_id_idx
  on public.creative_templates (brand_kit_id);

create index if not exists creative_templates_project_id_idx
  on public.creative_templates (project_id);

create index if not exists creative_templates_source_generation_id_idx
  on public.creative_templates (source_generation_id);

create index if not exists export_packages_project_id_idx
  on public.export_packages (project_id);

create index if not exists generation_jobs_user_id_idx
  on public.generation_jobs (user_id);
