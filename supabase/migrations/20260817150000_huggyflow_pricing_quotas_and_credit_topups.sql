-- HuggyFlow pricing truth: monthly quotas, XOF top-ups and launch options.
alter table public.pricing_plans
  add column if not exists monthly_price_xof bigint not null default 0,
  add column if not exists annual_price_xof bigint not null default 0,
  add column if not exists daily_image_limit integer not null default 0
    check (daily_image_limit >= 0);

create table if not exists public.pricing_plan_options (
  id text primary key,
  plan_id text not null references public.pricing_plans(id) on delete cascade,
  credits integer not null check (credits > 0),
  monthly_price_xof bigint not null check (monthly_price_xof >= 0),
  annual_price_xof bigint not null check (annual_price_xof >= 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, credits)
);

alter table public.credit_packs
  add column if not exists amount_xof bigint
    check (amount_xof is null or amount_xof >= 100);

/* The remaining statements below are intentionally idempotent. */

/*
alter table public.pricing_plans
  add column if not exists daily_image_limit integer not null default 0
    check (daily_image_limit >= 0);

alter table public.credit_packs
  add column if not exists amount_xof bigint
    check (amount_xof is null or amount_xof >= 100);
*/

update public.pricing_plans
set active = false
where id not in ('free', 'basic', 'pro');

update public.pricing_plans
set display_name = 'Free',
    monthly_price_xof = 0,
    annual_price_xof = 0,
    included_credits = 100,
    daily_video_limit = 0,
    concurrent_video_jobs = 0,
    allowed_media_types = array['image']::text[],
    watermark_required = true,
    media_retention_days = 7,
    priority_queue = false,
    active = true
where id = 'free';

update public.pricing_plans
set display_name = 'Creator',
    monthly_price_xof = 7900,
    annual_price_xof = 82950,
    included_credits = 500,
    daily_video_limit = 2,
    concurrent_video_jobs = 1,
    allowed_media_types = array['image', 'image_edit', 'video']::text[],
    watermark_required = false,
    media_retention_days = 30,
    priority_queue = false,
    active = true
where id = 'basic';

update public.pricing_plans
set display_name = 'Pro',
    monthly_price_xof = 19900,
    annual_price_xof = 208950,
    included_credits = 1500,
    daily_video_limit = 8,
    concurrent_video_jobs = 2,
    allowed_media_types = array['image', 'image_edit', 'video', 'audio']::text[],
    watermark_required = false,
    media_retention_days = 90,
    priority_queue = true,
    active = true
where id = 'pro';

update public.pricing_plans
set daily_image_limit = case id
  when 'free' then 3
  when 'basic' then 10
  when 'pro' then 30
  else daily_image_limit
end
where id in ('free', 'basic', 'pro');

update public.pricing_plans
set annual_price_xof = case id
  when 'basic' then 82950
  when 'pro' then 208950
  else annual_price_xof
end
where id in ('basic', 'pro');

insert into public.pricing_plan_options
  (id, plan_id, credits, monthly_price_xof, annual_price_xof, sort_order, metadata)
values
  ('creator-250', 'basic', 250, 4900, 51450, 5, '{"label":"Creator 250"}'),
  ('creator-500', 'basic', 500, 7900, 82950, 10, '{"label":"Creator 500"}'),
  ('creator-1000', 'basic', 1000, 14900, 156450, 20, '{"label":"Creator 1 000"}'),
  ('creator-2500', 'basic', 2500, 34900, 366450, 30, '{"label":"Creator 2 500"}'),
  ('creator-5000', 'basic', 5000, 64900, 681450, 40, '{"label":"Creator 5 000"}'),
  ('creator-7500', 'basic', 7500, 89900, 943950, 50, '{"label":"Creator 7 500"}'),
  ('pro-750', 'pro', 750, 12900, 135450, 5, '{"label":"Pro 750"}'),
  ('pro-1500', 'pro', 1500, 19900, 208950, 10, '{"label":"Pro 1 500"}'),
  ('pro-3000', 'pro', 3000, 37900, 397950, 20, '{"label":"Pro 3 000"}'),
  ('pro-6000', 'pro', 6000, 71900, 754950, 30, '{"label":"Pro 6 000"}'),
  ('pro-10000', 'pro', 10000, 114900, 1206450, 40, '{"label":"Pro 10 000"}'),
  ('pro-15000', 'pro', 15000, 159900, 1678950, 50, '{"label":"Pro 15 000"}')
on conflict (id) do update set
  plan_id = excluded.plan_id,
  credits = excluded.credits,
  monthly_price_xof = excluded.monthly_price_xof,
  annual_price_xof = excluded.annual_price_xof,
  sort_order = excluded.sort_order,
  active = true,
  metadata = excluded.metadata;

update public.pricing_plan_options
set active = false
where plan_id in ('basic', 'pro')
  and id not in (
    'creator-250', 'creator-500', 'creator-1000', 'creator-2500', 'creator-5000', 'creator-7500',
    'pro-750', 'pro-1500', 'pro-3000', 'pro-6000', 'pro-10000', 'pro-15000'
  );

insert into public.credit_packs
  (id, label, credits, amount_xof, price_usd, floor_credit_usd, active, metadata)
values
  ('topup-5', '5 crédits', 5, 100, 0.17, 0.008, true, '{}'),
  ('topup-10', '10 crédits', 10, 200, 0.33, 0.008, true, '{}'),
  ('topup-25', '25 crédits', 25, 500, 0.83, 0.008, true, '{}'),
  ('topup-50', '50 crédits', 50, 1000, 1.67, 0.008, true, '{}'),
  ('topup-100', '100 crédits', 100, 2000, 3.33, 0.008, true, '{}'),
  ('topup-250', '250 crédits', 250, 5000, 8.33, 0.008, true, '{}')
on conflict (id) do update set
  label = excluded.label,
  credits = excluded.credits,
  amount_xof = excluded.amount_xof,
  price_usd = excluded.price_usd,
  floor_credit_usd = excluded.floor_credit_usd,
  active = true,
  metadata = excluded.metadata;

update public.credit_packs
set active = false
where id not in ('topup-5', 'topup-10', 'topup-25', 'topup-50', 'topup-100', 'topup-250');

create index if not exists pricing_plans_daily_image_limit_idx
  on public.pricing_plans(id, daily_image_limit);

create index if not exists credit_packs_amount_xof_idx
  on public.credit_packs(active, amount_xof);
