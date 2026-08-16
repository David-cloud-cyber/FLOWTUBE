export type AgentRunStatus = 'queued' | 'working' | 'paused' | 'complete' | 'error' | 'cancelled';

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
  | 'run.completed';

export interface AgentRunEvent<TPayload = Record<string, unknown>> {
  type: AgentRunEventType;
  runId: string;
  messageId: string;
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

export function reduceAgentRunEvent(state: AgentRunState, event: AgentRunEvent): AgentRunState {
  if (!event || event.runId !== state.runId || event.messageId !== state.messageId) return state;
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
      return { ...next, citations: state.citations.concat([payload]) };
    case 'artifact.progress':
      return { ...next, status: 'working', progress: clampProgress(payload.progress), artifacts: state.artifacts.concat([payload]) };
    case 'artifact.ready':
      return { ...next, artifacts: state.artifacts.concat([payload]) };
    case 'approval.required':
      return { ...next, status: 'paused', approval: payload };
    case 'run.paused':
      return { ...next, status: 'paused' };
    case 'run.resumed':
      return { ...next, status: 'working' };
    case 'run.failed':
      return { ...next, status: 'error', progress: 0 };
    case 'run.cancelled':
      return { ...next, status: 'cancelled', progress: 0 };
    case 'run.completed':
      return { ...next, status: 'complete', progress: 100 };
    default:
      return state;
  }
}

export function splitSseBlocks(buffer: string) {
  const parts = String(buffer || '').split(/\r?\n\r?\n/);
  return { blocks: parts.slice(0, -1), remainder: parts.at(-1) || '' };
}
