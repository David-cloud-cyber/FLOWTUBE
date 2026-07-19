import React, { useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, CircleAlert, Cloud, Cpu, Plug, RefreshCw, ShieldCheck, Unplug } from 'lucide-react';
import { create } from 'zustand';
import './agentflow-islands.css';

type Connector = { provider: string; status?: string; last_sync_at?: string | null };
type Model = { id?: string; name?: string; active?: boolean };
type Bootstrap = { models?: Model[]; agentModels?: Model[]; providers?: unknown[] };
type IslandState = { actionId: string; setActionId: (id: string) => void };
const useIslandState = create<IslandState>((set) => ({ actionId: '', setActionId: (actionId) => set({ actionId }) }));
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 20_000, refetchOnWindowFocus: false, retry: 1 } } });
const roots = new WeakMap<HTMLElement, ReturnType<typeof ReactDOM.createRoot>>();
let observerStarted = false;

function authToken() { try { const session = JSON.parse(window.localStorage.getItem('huggyflow_session') || '{}'); return session.access_token || window.localStorage.getItem('huggyflow_access_token') || ''; } catch { return window.localStorage.getItem('huggyflow_access_token') || ''; } }
async function api<T>(path: string, options: RequestInit = {}): Promise<T> { const response = await fetch(path, { ...options, headers: { 'content-type':'application/json', authorization:`Bearer ${authToken()}`, ...(options.headers || {}) } }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Action indisponible'); return body as T; }
function formatDate(value?: string | null) { if (!value) return 'Jamais synchronisé'; const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Synchronisation inconnue' : `Synchronisé le ${date.toLocaleDateString('fr-FR')}`; }

function CapabilityIsland() {
  const reduced = useReducedMotion(); const { actionId, setActionId } = useIslandState();
  const query = useQuery({ queryKey:['agentflow','bootstrap'], queryFn:() => api<Bootstrap>('/api/bootstrap') });
  const models = useMemo(() => (query.data?.models || query.data?.agentModels || []).filter((model) => model.active !== false).slice(0, 5), [query.data]);
  const total = (query.data?.models || query.data?.agentModels || []).filter((model) => model.active !== false).length;
  const refresh = async () => { setActionId('capabilities-refresh'); await query.refetch(); setActionId(''); };
  const services = [{ label:'Génération multimédia', detail:`${models.length || 0} modèles immédiatement disponibles`, status:models.length ? 'online' : 'offline', icon:Cpu }, { label:'AgentFlow', detail:'Mémoire, orchestration et contrôle qualité', status:'online', icon:ShieldCheck }, { label:'Connecteurs', detail:`${query.data?.providers?.length || 0} services détectés`, status:query.data?.providers?.length ? 'online' : 'warning', icon:Plug }];
  return <section className="af-island af-mt-3" aria-label="État en direct des capacités"><motion.div initial={reduced ? false : { opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:.22, ease:[.22,1,.36,1] }} className="af-control-card"><div className="af-flex af-items-center af-justify-between af-gap-3 af-mb-3"><div><div className="af-text-[12px] af-font-bold">État en direct</div><div className="af-mt-0.5 af-text-[10px]" style={{ color:'var(--af-muted)' }}>{query.isError ? 'Impossible de joindre le service' : `${total || 0} modèles, crédits et services vérifiés`}</div></div><button className="af-control-button af-inline-flex af-items-center af-gap-1.5" onClick={refresh} disabled={query.isFetching || actionId === 'capabilities-refresh'}><RefreshCw size={12} className={query.isFetching ? 'af-animate-spin' : ''}/>Actualiser</button></div><div className="af-grid af-grid-cols-1 sm:af-grid-cols-3 af-gap-2">{services.map((service) => { const Icon = service.icon; return <div key={service.label} className="af-rounded-[9px] af-p-2.5" style={{ background:'var(--af-panel-soft)' }}><div className="af-flex af-items-center af-gap-1.5"><span className="af-status-dot" data-status={service.status === 'online' ? 'online' : service.status}/><Icon size={12}/><span className="af-text-[10px] af-font-semibold">{service.label}</span></div><div className="af-mt-1.5 af-text-[10px] af-leading-[1.35]" style={{ color:'var(--af-muted)' }}>{service.detail}</div></div>; })}</div><AnimatePresence initial={false}>{!query.isLoading && models.length > 0 && <motion.div initial={reduced ? false : { opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="af-mt-3 af-flex af-flex-wrap af-gap-1.5">{models.map((model) => <span key={model.id || model.name} className="af-inline-flex af-items-center af-gap-1 af-rounded-md af-px-2 af-py-1 af-text-[10px]" style={{ border:'1px solid var(--af-line)', color:'var(--af-muted)' }}><Check size={10} color="var(--af-accent)"/>{model.name || model.id}</span>)}</motion.div>}</AnimatePresence></motion.div></section>;
}

function ConnectorIsland() {
  const reduced = useReducedMotion(); const cache = useQueryClient(); const { actionId, setActionId } = useIslandState(); const query = useQuery({ queryKey:['agentflow','integrations'], queryFn:() => api<{ integrations?: Connector[] }>('/api/integrations') }); const connectors = query.data?.integrations || []; const parentRef = useRef<HTMLDivElement>(null); const virtualizer = useVirtualizer({ count:connectors.length, getScrollElement:() => parentRef.current, estimateSize:() => 56, overscan:3 });
  const action = async (provider:string, nextAction:string) => { const id = `${provider}-${nextAction}`; setActionId(id); try { const result = await api<{ authorizationUrl?:string }>('/api/integrations', { method:'POST', body:JSON.stringify({ action:nextAction, provider }) }); if (result.authorizationUrl) window.location.assign(result.authorizationUrl); await cache.invalidateQueries({ queryKey:['agentflow','integrations'] }); } catch {} finally { setActionId(''); } };
  const status = (connector:Connector) => connector.status === 'connected' ? 'online' : connector.status === 'expired' || connector.status === 'error' ? 'warning' : 'offline';
  return <section className="af-island af-mt-3" aria-label="Connecteurs en direct"><motion.div initial={reduced ? false : { opacity:0, y:6 }} animate={{ opacity:1, y:0 }} transition={{ duration:.22, ease:[.22,1,.36,1] }} className="af-control-card"><div className="af-flex af-items-center af-justify-between af-gap-3 af-mb-2"><div><div className="af-text-[12px] af-font-bold">Connexions actives</div><div className="af-mt-0.5 af-text-[10px]" style={{ color:'var(--af-muted)' }}>{query.isError ? 'Vérification indisponible' : 'Autorisations et synchronisation contrôlées'}</div></div><Cloud size={15} color="var(--af-accent)"/></div>{query.isLoading ? <div className="af-h-12 af-rounded-[9px] af-animate-pulse" style={{ background:'var(--af-panel-soft)' }}/> : connectors.length === 0 ? <div className="af-flex af-items-center af-gap-2 af-py-2 af-text-[11px]" style={{ color:'var(--af-muted)' }}><CircleAlert size={13}/>Aucun connecteur n’est encore disponible.</div> : <div ref={parentRef} className="af-max-h-[224px] af-overflow-auto" style={{ scrollbarWidth:'thin' }}><div style={{ height:`${virtualizer.getTotalSize()}px`, position:'relative' }}>{virtualizer.getVirtualItems().map((row) => { const connector = connectors[row.index]; const connected = connector.status === 'connected'; const nextAction = connected ? 'sync' : 'configure'; const id = `${connector.provider}-${nextAction}`; return <div key={connector.provider} data-index={row.index} ref={virtualizer.measureElement} style={{ position:'absolute', top:0, left:0, width:'100%', transform:`translateY(${row.start}px)` }}><div className="af-flex af-items-center af-justify-between af-gap-3 af-border-b af-py-2.5" style={{ borderColor:'var(--af-line)' }}><div className="af-min-w-0"><div className="af-flex af-items-center af-gap-1.5"><span className="af-status-dot" data-status={status(connector)}/><span className="af-text-[11px] af-font-semibold af-capitalize">{connector.provider.replaceAll('_',' ')}</span></div><div className="af-mt-1 af-text-[10px]" style={{ color:'var(--af-muted)' }}>{formatDate(connector.last_sync_at)}</div></div><div className="af-flex af-gap-1.5"><button className="af-control-button" onClick={() => action(connector.provider,nextAction)} disabled={actionId === id}>{actionId === id ? '...' : connected ? 'Synchroniser' : 'Connecter'}</button>{connected && <button className="af-control-button" onClick={() => action(connector.provider,'disconnect')} title="Déconnecter" disabled={actionId === `${connector.provider}-disconnect`}><Unplug size={12}/></button>}</div></div></div>; })}</div></div>}</motion.div></section>;
}

function mount(container:HTMLElement, component:React.ReactElement) { let root = roots.get(container); if (!root) { root = ReactDOM.createRoot(container); roots.set(container,root); } root.render(<QueryClientProvider client={client}>{component}</QueryClientProvider>); }
function hydrateIslands() { document.querySelectorAll<HTMLElement>('[data-agentflow-island]').forEach((container) => { if (container.dataset.agentflowIsland === 'capabilities') mount(container,<CapabilityIsland/>); if (container.dataset.agentflowIsland === 'connectors') mount(container,<ConnectorIsland/>); }); }
export function startAgentFlowIslands() {
  const start = () => {
    if (observerStarted || !document.body) return;
    observerStarted = true;
    hydrateIslands();
    new MutationObserver(hydrateIslands).observe(document.body, { childList:true, subtree:true });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once:true });
}
