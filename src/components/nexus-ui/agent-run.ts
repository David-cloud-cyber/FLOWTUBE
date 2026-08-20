export type AgentRunStatus = 'queued' | 'working' | 'paused' | 'complete' | 'error' | 'cancelled' | 'interrupted';

export type AgentRunEventType =
  | 'run.started'
  | 'plan.updated'
  | 'step.started'
  | 'step.progress'
  | 'assistant.delta'
  | 'citation.added'
  | 'artifact.progress'
  | 'artifact.ready'
  | 'approval.required'
  | 'run.paused'
  | 'run.resumed'
  | 'run.failed'
  | 'run.cancelled'
  | 'run.interrupted'
  | 'run.completed';

export interface AgentRunEvent<TPayload = Record<string, unknown>> {
  type: AgentRunEventType;
  runId: string;
  messageId?: string;
  stepId?: string;
  sequence: number;
  timestamp: string;
  payload: TPayload;
}

export interface AgentRunPlanStep {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  dependsOn?: string[];
  detail?: string;
}

export interface AgentRunState {
  runId: string;
  messageId: string;
  status: AgentRunStatus;
  phase: string;
  progress: number;
  responseText: string;
  plan: AgentRunPlanStep[];
  activities: Array<Record<string, unknown>>;
  citations: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  approval?: Record<string, unknown>;
  costEstimate?: Record<string, unknown>;
  creditsCharged?: number;
  errorMessage?: string;
  sequence: number;
  lastEventId?: string;
}

export function initialAgentRunState(runId = '', messageId = ''): AgentRunState {
  return {
    runId,
    messageId,
    status: 'queued',
    phase: 'analyzing',
    progress: 0,
    responseText: '',
    plan: [],
    activities: [],
    citations: [],
    artifacts: [],
    sequence: 0,
  };
}

function clampProgress(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function upsertById(items: Array<Record<string, unknown>>, value: Record<string, unknown>) {
  const id = String(value.id || value.stepId || value.artifactId || value.url || '');
  if (!id) return items.concat(value);
  const index = items.findIndex((item) => String(item.id || item.stepId || item.artifactId || item.url || '') === id);
  if (index < 0) return items.concat(value);
  return items.map((item, itemIndex) => itemIndex === index ? { ...item, ...value } : item);
}

export function parseSseBlock(block: string): AgentRunEvent | null {
  const lines = String(block || '').split(/\r?\n/);
  let eventType = '';
  let eventId = '';
  const dataLines: string[] = [];
  for (const line of lines) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, '') : '';
    if (field === 'event') eventType = value.trim();
    if (field === 'id') eventId = value.trim();
    if (field === 'data') dataLines.push(value);
  }
  if (!dataLines.length) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(dataLines.join('\n')) as Record<string, unknown>;
  } catch {
    return null;
  }
  const payload = asRecord(parsed.payload || parsed.data || parsed);
  const type = String(parsed.type || eventType || 'message') as AgentRunEventType;
  const sequence = Number(parsed.sequence || parsed.seq || payload.sequence || 0);
  if (!Number.isFinite(sequence) || sequence <= 0) return null;
  const runId = String(parsed.runId || payload.runId || '');
  const messageId = String(parsed.messageId || payload.messageId || '');
  if (!runId) return null;
  return {
    type,
    runId,
    messageId,
    stepId: String(parsed.stepId || payload.stepId || '') || undefined,
    sequence,
    timestamp: String(parsed.timestamp || payload.timestamp || new Date().toISOString()),
    payload: { ...payload, ...(eventId ? { eventId } : {}) },
  };
}

export function reduceAgentRunEvent(state: AgentRunState, event: AgentRunEvent): AgentRunState {
  if (!event || event.runId !== state.runId || (state.messageId && event.messageId && event.messageId !== state.messageId)) return state;
  if (!Number.isFinite(event.sequence) || event.sequence <= state.sequence) return state;

  const payload = asRecord(event.payload);
  const next: AgentRunState = {
    ...state,
    sequence: event.sequence,
    lastEventId: `${event.runId}:${event.sequence}`,
  };

  switch (event.type) {
    case 'run.started':
      return { ...next, status: 'working', phase: String(payload.phase || 'analyzing') };
    case 'plan.updated':
      return { ...next, status: 'working', plan: Array.isArray(payload.steps) ? payload.steps as AgentRunPlanStep[] : state.plan };
    case 'step.started':
      return { ...next, status: 'working', phase: String(payload.phase || payload.label || state.phase) };
    case 'step.progress':
      return { ...next, status: 'working', progress: clampProgress(payload.progress), phase: String(payload.phase || state.phase) };
    case 'assistant.delta':
      return { ...next, status: 'working', responseText: state.responseText + String(payload.delta || payload.text || '') };
    case 'citation.added':
      return { ...next, citations: upsertById(state.citations, payload) };
    case 'artifact.progress':
      return { ...next, status: 'working', progress: clampProgress(payload.progress), artifacts: upsertById(state.artifacts, payload) };
    case 'artifact.ready':
      return { ...next, artifacts: upsertById(state.artifacts, payload) };
    case 'approval.required':
      return { ...next, status: 'paused', approval: payload };
    case 'run.paused':
      return { ...next, status: 'paused' };
    case 'run.resumed':
      return { ...next, status: 'working' };
    case 'run.failed':
      return { ...next, status: 'error', progress: 0, errorMessage: String(payload.message || payload.error || 'La génération a échoué.') };
    case 'run.cancelled':
      return { ...next, status: 'cancelled', progress: 0 };
    case 'run.interrupted':
      return {
        ...next,
        status: 'interrupted',
        progress: 0,
        errorMessage: String(payload.message || payload.error || 'La réponse a été interrompue.'),
      };
    case 'run.completed':
      const hasOutput = Boolean(state.responseText.trim() || state.artifacts.length || payload.text || payload.content || payload.resultUrl || payload.artifact);
      if (['queued', 'pending', 'running'].includes(String(payload.status || '').toLowerCase())) {
        return { ...next, status: 'working', phase: 'rendering' };
      }
      if (payload.resultConfirmed === false) {
        return {
          ...next,
          status: 'interrupted',
          progress: 0,
          errorMessage: 'Le résultat n’a pas été confirmé.',
        };
      }
      if (payload.resultConfirmed !== true && !hasOutput) {
        return {
          ...next,
          status: 'interrupted',
          progress: 0,
          errorMessage: 'Le résultat n’a pas été confirmé.',
        };
      }
      if (!hasOutput) {
        return {
          ...next,
          status: 'interrupted',
          progress: 0,
          errorMessage: 'Le résultat n’a pas été confirmé.',
        };
      }
      return { ...next, status: 'complete', progress: 100 };
    default:
      return state;
  }
}

export function splitSseBlocks(buffer: string) {
  const parts = String(buffer || '').split(/\r?\n(?:\r?\n)+/);
  return { blocks: parts.slice(0, -1), remainder: parts[parts.length - 1] || '' };
}
