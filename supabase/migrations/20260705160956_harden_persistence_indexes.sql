-- Harden production persistence paths by indexing foreign keys used by RLS,
-- project loading, generation polling, billing callbacks, and moderation.

create index if not exists agent_elements_source_generation_id_idx
  on public.agent_elements (source_generation_id)
  where source_generation_id is not null;

create index if not exists agent_skills_project_id_idx
  on public.agent_skills (project_id)
  where project_id is not null;

create index if not exists billing_checkout_sessions_credit_pack_id_idx
  on public.billing_checkout_sessions (credit_pack_id)
  where credit_pack_id is not null;

create index if not exists billing_checkout_sessions_plan_id_idx
  on public.billing_checkout_sessions (plan_id)
  where plan_id is not null;

create index if not exists collection_items_collection_id_idx
  on public.collection_items (collection_id);

create index if not exists collection_items_project_id_idx
  on public.collection_items (project_id)
  where project_id is not null;

create index if not exists conversations_project_id_idx
  on public.conversations (project_id);

create index if not exists credit_transactions_generation_id_idx
  on public.credit_transactions (generation_id)
  where generation_id is not null;

create index if not exists generations_conversation_id_idx
  on public.generations (conversation_id);

create index if not exists generations_message_id_idx
  on public.generations (message_id)
  where message_id is not null;

create index if not exists generations_pricing_model_id_idx
  on public.generations (pricing_model_id)
  where pricing_model_id is not null;

create index if not exists messages_project_id_idx
  on public.messages (project_id);

create index if not exists moderation_events_generation_id_idx
  on public.moderation_events (generation_id)
  where generation_id is not null;

create index if not exists moderation_events_project_id_idx
  on public.moderation_events (project_id)
  where project_id is not null;

create index if not exists payment_events_user_id_idx
  on public.payment_events (user_id)
  where user_id is not null;

create index if not exists pricing_audit_logs_pricing_model_id_idx
  on public.pricing_audit_logs (pricing_model_id)
  where pricing_model_id is not null;

create index if not exists rate_limit_events_user_id_idx
  on public.rate_limit_events (user_id)
  where user_id is not null;

create index if not exists subscriptions_plan_id_idx
  on public.subscriptions (plan_id);
