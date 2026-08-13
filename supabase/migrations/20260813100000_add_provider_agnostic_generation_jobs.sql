alter table public.generations
  add column if not exists provider_job_id text;

create index if not exists generations_provider_job_id_idx
  on public.generations(provider_job_id)
  where provider_job_id is not null;

comment on column public.generations.provider_job_id is
  'Provider-neutral asynchronous job identifier. fal_job_id remains for backwards compatibility.';
