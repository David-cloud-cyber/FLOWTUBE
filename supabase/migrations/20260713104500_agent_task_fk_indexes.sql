-- Cover agent task foreign keys used by task detail and cleanup queries.
create index if not exists agent_tasks_artifact_id_idx
  on public.agent_tasks(artifact_id) where artifact_id is not null;
create index if not exists agent_tasks_conversation_id_idx
  on public.agent_tasks(conversation_id) where conversation_id is not null;
create index if not exists agent_tasks_generation_id_idx
  on public.agent_tasks(generation_id) where generation_id is not null;
create index if not exists agent_tasks_parent_task_id_idx
  on public.agent_tasks(parent_task_id) where parent_task_id is not null;
