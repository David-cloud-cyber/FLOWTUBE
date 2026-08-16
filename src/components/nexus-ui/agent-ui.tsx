import React, { useEffect, useId, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import './agent-ui.css';

export type AgentRunStatus = 'queued' | 'working' | 'paused' | 'complete' | 'error' | 'cancelled';
export type AgentActivityKind = 'step' | 'text' | 'search' | 'tool' | 'trace' | 'generation' | 'approval';
export type AgentTaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'failed';
export type AgentMediaStatus = 'queued' | 'generating' | 'refining' | 'complete' | 'error';
export type AgentInteractionMode = 'conversation' | 'creation' | 'approval' | 'result';

export interface AgentActivityItem {
  id: string;
  label: string;
  kind?: AgentActivityKind;
  status?: 'working' | 'complete' | 'error';
  detail?: string;
  tool?: string;
  timestamp?: string;
}

export interface AgentTaskItem {
  id: string;
  title: string;
  status?: AgentTaskStatus;
  progress?: number;
  detail?: string;
}

export interface AgentCitationItem {
  id: string;
  title: string;
  domain?: string;
  url?: string;
}

export interface AgentApproval {
  title: string;
  description?: string;
  status?: 'pending' | 'submitting' | 'approved' | 'rejected' | 'changes-requested';
}

export interface AgentMessagePanelProps {
  interactionMode?: AgentInteractionMode;
  status?: AgentRunStatus;
  phase?: string;
  progress?: number;
  elapsedSeconds?: number;
  activity?: AgentActivityItem[];
  tasks?: AgentTaskItem[];
  citations?: AgentCitationItem[];
  mediaStatus?: AgentMediaStatus;
  mediaLabel?: string;
  approval?: AgentApproval;
  responseText?: string;
  retryLabel?: string;
  onRetry?: () => void;
  onCopy?: () => void | Promise<void>;
  onFeedback?: (value: 'up' | 'down' | null) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onRequestChanges?: () => void;
  className?: string;
}

const phaseLabels: Record<string, string> = {
  analyzing: 'Analyse de la demande',
  routing: 'Choix du meilleur moteur',
  writing: 'Composition de la réponse',
  researching: 'Vérification des sources',
  rendering: 'Génération du rendu',
  assembling: 'Assemblage des éléments',
  finalizing: 'Contrôle qualité',
  complete: 'Résultat prêt',
  cancelled: 'Génération interrompue',
};

function labelForPhase(phase?: string) {
  return phaseLabels[String(phase || 'analyzing').toLowerCase()] || 'AgentFlow travaille sur ta demande';
}

function formatElapsed(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remainder = (safe % 60).toFixed(1);
  return minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function activityIcon(kind?: AgentActivityKind) {
  if (kind === 'search') return <Search aria-hidden="true" />;
  if (kind === 'tool' || kind === 'generation') return <Wrench aria-hidden="true" />;
  if (kind === 'approval') return <ShieldCheck aria-hidden="true" />;
  return <Clock3 aria-hidden="true" />;
}

function StatusMark({ status }: { status: AgentActivityItem['status'] }) {
  if (status === 'complete') return <Check aria-hidden="true" className="hf-agent-status-icon is-complete" />;
  if (status === 'error') return <CircleAlert aria-hidden="true" className="hf-agent-status-icon is-error" />;
  return <span aria-hidden="true" className="hf-agent-status-dot" />;
}

export function AgentProgress({
  label,
  elapsedSeconds,
  progress = 0,
  status = 'working',
}: {
  label?: string;
  elapsedSeconds?: number;
  progress?: number;
  status?: AgentRunStatus;
}) {
  const reduce = useReducedMotion() ?? false;
  const [internalElapsed, setInternalElapsed] = useState(0);
  const cells = Array.from({ length: 9 }, (_, index) => index);
  const active = status === 'working' || status === 'queued' || status === 'paused';
  useEffect(() => {
    if (elapsedSeconds !== undefined || !active) return undefined;
    const startedAt = performance.now();
    const timer = window.setInterval(() => setInternalElapsed((performance.now() - startedAt) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [active, elapsedSeconds]);
  const elapsed = elapsedSeconds ?? internalElapsed;
  const resolvedProgress = Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className="hf-agent-progress" role="group" aria-label={`${label || labelForPhase('analyzing')}, ${Math.round(resolvedProgress)}%`} aria-busy={active}>
      <span className="hf-agent-grid" aria-hidden="true">
        {cells.map((cell) => (
          <motion.span
            key={cell}
            className="hf-agent-grid-cell"
            animate={reduce ? { opacity: 0.62 } : { opacity: [0.28, 1, 0.28], scale: [0.72, 1, 0.72] }}
            transition={reduce ? { duration: 0 } : { duration: 1.45, repeat: Infinity, delay: cell * 0.08, ease: 'easeInOut' }}
          />
        ))}
      </span>
      <span className="hf-agent-progress-copy">
        <strong>{label || labelForPhase('analyzing')}</strong>
        <span>{formatElapsed(elapsed)}</span>
      </span>
      <span className="hf-agent-progress-track" aria-hidden="true">
        <motion.span animate={{ width: `${resolvedProgress}%` }} transition={{ duration: reduce ? 0 : 0.28, ease: 'easeOut' }} />
      </span>
    </div>
  );
}

export function ReasoningText({ phase, active = true, compact = false }: { phase?: string; active?: boolean; compact?: boolean }) {
  const reduce = useReducedMotion() ?? false;
  const phrases = useMemo(() => {
    if (compact) return ['Réflexion en cours'];
    const label = labelForPhase(phase);
    return active ? [label, `${label}…`, 'AgentFlow coordonne les étapes'] : [label];
  }, [active, compact, phase]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || phrases.length < 2) return undefined;
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % phrases.length), 1900);
    return () => window.clearInterval(timer);
  }, [active, phrases]);
  return (
    <span className={`hf-agent-reasoning${compact ? ' is-compact' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      <span className="hf-agent-reasoning-mark" aria-hidden="true" />
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={phrases[index % phrases.length]}
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
        >
          {phrases[index % phrases.length]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ActivityDisclosure({ items }: { items: AgentActivityItem[] }) {
  const reduce = useReducedMotion() ?? false;
  const baseId = useId();
  const contentId = `${baseId}-activity`;
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const completed = items.filter((item) => item.status === 'complete').length;
  return (
    <div className="hf-agent-activity">
      <button type="button" className="hf-agent-disclosure-trigger" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
        <span className="hf-agent-disclosure-leading"><ListChecks aria-hidden="true" /></span>
        <span className="hf-agent-disclosure-title">Activité AgentFlow</span>
        <span className="hf-agent-disclosure-count">{completed}/{items.length}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }}><ChevronDown aria-hidden="true" /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div id={contentId} role="region" aria-label="Activité de l’agent" className="hf-agent-activity-list" initial={reduce ? { opacity: 1 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}>
            {items.map((item) => (
              <div className="hf-agent-activity-row" key={item.id}>
                <span className="hf-agent-activity-kind">{activityIcon(item.kind)}</span>
                <span className="hf-agent-activity-body">
                  <strong>{item.label}</strong>
                  {item.detail ? <span>{item.detail}</span> : null}
                </span>
                <StatusMark status={item.status} />
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TaskList({ tasks }: { tasks: AgentTaskItem[] }) {
  const reduce = useReducedMotion() ?? false;
  const [open, setOpen] = useState(true);
  const baseId = useId();
  const contentId = `${baseId}-plan`;
  if (!tasks.length) return null;
  const completed = tasks.filter((task) => task.status === 'completed').length;
  return (
    <div className="hf-agent-tasks">
      <button type="button" className="hf-agent-disclosure-trigger" aria-expanded={open} aria-controls={contentId} onClick={() => setOpen((value) => !value)}>
        <span className="hf-agent-disclosure-leading"><ListChecks aria-hidden="true" /></span>
        <span className="hf-agent-disclosure-title">Plan d’exécution</span>
        <span className="hf-agent-disclosure-count">{completed}/{tasks.length}</span>
        <ChevronDown aria-hidden="true" className={open ? 'is-open' : ''} />
      </button>
    <AnimatePresence initial={false}>
      {open ? <motion.div id={contentId} role="region" aria-label="Plan d’exécution" className="hf-agent-task-list" initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduce ? undefined : { opacity: 0, height: 0 }} transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <AnimatePresence initial={false} mode="popLayout">
          {tasks.map((task) => {
            const status = task.status || 'pending';
            const progress = Math.max(0, Math.min(100, Number(task.progress) || (status === 'completed' ? 100 : 0)));
            return <motion.div className="hf-agent-task-row" key={task.id} layout initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}>
              <span className={`hf-agent-task-mark is-${status}`} aria-hidden="true">{status === 'completed' ? <Check /> : status === 'failed' ? <X /> : status === 'in-progress' ? <span /> : null}</span>
              <span className="hf-agent-task-body"><strong>{task.title}</strong>{task.detail ? <small>{task.detail}</small> : null}<span className="hf-agent-task-track"><motion.span animate={{ width: `${progress}%` }} transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }} /></span></span>
            </motion.div>;
          })}
        </AnimatePresence>
      </motion.div> : null}
    </AnimatePresence>
    </div>
  );
}

function Citations({ citations }: { citations: AgentCitationItem[] }) {
  const reduce = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const contentId = `${baseId}-sources`;
  if (!citations.length) return null;
  return <div className="hf-agent-citations">
    <button type="button" className="hf-agent-citation-trigger" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls={contentId}>
      <Search aria-hidden="true" /><span>{citations.length} source{citations.length > 1 ? 's' : ''}</span><ChevronDown aria-hidden="true" className={open ? 'is-open' : ''} />
    </button>
    <AnimatePresence initial={false}>
      {open ? <motion.div id={contentId} role="region" aria-label="Sources" className="hf-agent-citation-list" initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={reduce ? undefined : { opacity: 0, height: 0 }} transition={{ duration: reduce ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
        <AnimatePresence initial={false} mode="popLayout">
          {citations.map((citation) => {
            const content = <><span className="hf-agent-favicon" aria-hidden="true">{citation.domain?.slice(0, 1).toUpperCase() || 'W'}</span><span className="hf-agent-citation-text"><strong>{citation.title}</strong><small>{citation.domain || citation.url || 'Source vérifiée'}</small></span><ExternalLink aria-hidden="true" /></>;
            return citation.url ? <motion.a layout key={citation.id} href={citation.url} target="_blank" rel="noreferrer noopener" initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -3 }} transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}>{content}</motion.a> : <motion.div layout key={citation.id} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -3 }} transition={{ duration: reduce ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}>{content}</motion.div>;
          })}
        </AnimatePresence>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

function StreamingResponse({ text, status }: { text: string; status: AgentRunStatus }) {
  const paragraphs = String(text || '').split(/\n{2,}/).filter(Boolean);
  if (!paragraphs.length) return null;
  return <div className="hf-agent-response-text" aria-live={status === 'working' ? 'off' : 'polite'}>
    {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {status === 'working' ? <span className="hf-agent-response-cursor" aria-hidden="true" /> : null}
  </div>;
}

function MediaStatus({ status, label }: { status: AgentMediaStatus; label?: string }) {
  const active = status !== 'complete' && status !== 'error';
  const text = status === 'queued' ? 'En file d’attente' : status === 'generating' ? 'Génération en cours' : status === 'refining' ? 'Amélioration du rendu' : status === 'error' ? 'Génération échouée' : 'Rendu prêt';
  return <div className={`hf-agent-media-status is-${status}`} role="status" aria-busy={active}><span className="hf-agent-media-indicator" aria-hidden="true">{status === 'complete' ? <Check /> : status === 'error' ? <CircleAlert /> : <span />}</span><span><strong>{label || text}</strong><small>{active ? 'Le rendu apparaitra ici sans deplacer la conversation.' : text}</small></span></div>;
}

function ApprovalCard({ approval, onApprove, onReject, onRequestChanges }: { approval: AgentApproval; onApprove?: () => void; onReject?: () => void; onRequestChanges?: () => void }) {
  const status = approval.status || 'pending';
  const interactive = status === 'pending';
  return <div className={`hf-agent-approval is-${status}`}>
    <div className="hf-agent-approval-icon"><ShieldCheck aria-hidden="true" /></div>
    <div className="hf-agent-approval-body"><div className="hf-agent-approval-head"><strong>{approval.title}</strong><span>{status === 'approved' ? 'Approuvé' : status === 'rejected' ? 'Refusé' : status === 'changes-requested' ? 'Modifications demandées' : 'Validation requise'}</span></div>{approval.description ? <p>{approval.description}</p> : null}{interactive ? <div className="hf-agent-approval-actions"><button type="button" onClick={onApprove}>Approuver</button>{onRequestChanges ? <button type="button" className="is-secondary" onClick={onRequestChanges}>Modifier</button> : null}{onReject ? <button type="button" className="is-quiet" onClick={onReject}>Refuser</button> : null}</div> : null}</div>
  </div>;
}

function ResponseActions({ responseText, status, onRetry, onCopy, onFeedback, retryLabel }: Pick<AgentMessagePanelProps, 'responseText' | 'status' | 'onRetry' | 'onCopy' | 'onFeedback' | 'retryLabel'>) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  if (status === 'working' || status === 'queued') return null;
  const copy = async () => { if (onCopy) await onCopy(); else if (responseText && navigator.clipboard) await navigator.clipboard.writeText(responseText); setCopied(true); window.setTimeout(() => setCopied(false), 1500); };
  const react = (value: 'up' | 'down') => { const next = feedback === value ? null : value; setFeedback(next); onFeedback?.(next); };
  return <div className="hf-agent-response-actions"><button type="button" aria-label={copied ? 'Réponse copiée' : 'Copier la réponse'} title={copied ? 'Réponse copiée' : 'Copier la réponse'} onClick={copy}>{copied ? <Check /> : <Copy />}</button>{onRetry ? <button type="button" aria-label={retryLabel || 'Réessayer'} title={retryLabel || 'Réessayer'} onClick={onRetry}><RotateCcw /></button> : null}{status === 'complete' ? <><button type="button" aria-label="Réponse utile" title="Réponse utile" aria-pressed={feedback === 'up'} className={feedback === 'up' ? 'is-active' : ''} onClick={() => react('up')}><ThumbsUp /></button><button type="button" aria-label="Réponse peu utile" title="Réponse peu utile" aria-pressed={feedback === 'down'} className={feedback === 'down' ? 'is-active' : ''} onClick={() => react('down')}><ThumbsDown /></button></> : null}{status === 'error' ? <span className="hf-agent-error-label">Une erreur est survenue</span> : null}</div>;
}

export function AgentMessagePanel({
  interactionMode, status = 'working', phase, progress = 0, elapsedSeconds = 0, activity = [], tasks = [], citations = [], mediaStatus, mediaLabel, approval, responseText, retryLabel, onRetry, onCopy, onFeedback, onPause, onResume, onCancel, onApprove, onReject, onRequestChanges, className,
}: AgentMessagePanelProps) {
  const active = status === 'working' || status === 'queued' || status === 'paused';
  const hasDetails = activity.length || tasks.length || citations.length || approval || mediaStatus;
  const mode = interactionMode || (hasDetails ? 'creation' : 'conversation');
  const compactConversation = mode === 'conversation' && active;
  const hasResponse = Boolean(String(responseText || '').trim());
  if (!active && !hasDetails && !onRetry && !onCopy) return null;
  return <div className={`hf-agent-panel ${active ? 'is-active' : ''} ${className || ''}`}>
    {compactConversation && !hasResponse ? <ReasoningText phase={phase} active compact /> : null}
    {active && !compactConversation ? <AgentProgress label={status === 'paused' ? 'Génération en pause' : labelForPhase(phase)} elapsedSeconds={elapsedSeconds} progress={progress} status={status} /> : null}
    {active && !compactConversation && !hasResponse ? <ReasoningText phase={phase} /> : null}
    {hasResponse ? <StreamingResponse text={responseText || ''} status={status} /> : null}
    <AnimatePresence initial={false} mode="popLayout">
      {!compactConversation && activity.length ? <motion.div key="activity" layout initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}><ActivityDisclosure items={activity} /></motion.div> : null}
      {!compactConversation && tasks.length ? <motion.div key="tasks" layout initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}><TaskList tasks={tasks} /></motion.div> : null}
      {mediaStatus ? <motion.div key="media" layout initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}><MediaStatus status={mediaStatus} label={mediaLabel} /></motion.div> : null}
      {approval ? <motion.div key="approval" layout initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}><ApprovalCard approval={approval} onApprove={onApprove} onReject={onReject} onRequestChanges={onRequestChanges} /></motion.div> : null}
      {citations.length ? <motion.div key="citations" layout initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}><Citations citations={citations} /></motion.div> : null}
    </AnimatePresence>
    {active && (onPause || onResume || onCancel) ? <div className="hf-agent-run-controls">{status === 'paused' && onResume ? <button type="button" onClick={onResume}><Play /> Reprendre</button> : status !== 'paused' && onPause ? <button type="button" onClick={onPause}><Pause /> Pause</button> : null}{onCancel ? <button type="button" className="is-quiet" onClick={onCancel}><X /> Annuler</button> : null}</div> : null}
    <ResponseActions responseText={responseText} status={status} onRetry={onRetry} onCopy={onCopy} onFeedback={onFeedback} retryLabel={retryLabel} />
  </div>;
}
