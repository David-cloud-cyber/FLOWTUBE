Warning: truncated output (original token count: 171813)
Total output lines: 12040

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { fal } from "npm:@fal-ai/client@1.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://fuvrxobxjcqyevsjsdfd.supabase.co";
const APP_NAME = "HuggyFlow";
const configuredDefaultModel = Deno.env.get("AGENTFLOW_DEFAULT_MODEL") || "";
const DEFAULT_MODEL = [
  "openai/gpt-chat-latest",
  "google/gemini-3.7-flash",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5",
  "deepseek/deepseek-v4-flash-0731",
  "deepseek/deepseek-v4-pro-0813",
  "x-ai/grok-4.6",
  "qwen/qwen3.7-flash",
].includes(configuredDefaultModel) ? configuredDefaultModel : "openai/gpt-chat-latest";
const ANTHROPIC_VERSION = "2023-06-01";
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://www.huggyflow.fun").replace(/\/$/, "");
const APP_RUNTIME_ENV = (Deno.env.get("APP_ENV") || Deno.env.get("NODE_ENV") || "production").toLowerCase();
const TEST_BILLING_ENABLED = (Deno.env.get("HUGGYFLOW_TEST_BILLING_ENABLED") || "false").toLowerCase() === "true"
  && (APP_RUNTIME_ENV !== "production" || (Deno.env.get("HUGGYFLOW_TEST_BILLING_PRODUCTION_ENABLED") || "false").toLowerCase() === "true");
const MEDIA_BUCKET = Deno.env.get("FLOWTUBE_MEDIA_BUCKET") || "flowtube-media";
const CREDIT_FLOOR_USD = 0.008;
const RETAIL_CREDIT_USD = 0.013;
const MEDIA_MARGIN_MULTIPLIER = 3.5;
const MIN_MEDIA_GROSS_MARGIN_RATIO = 0.45;
const PAYMENT_RESERVE_RATIO = Math.max(0, Number(Deno.env.get("FLOWTUBE_PAYMENT_RESERVE_RATIO") || 0.07));
const RISK_RESERVE_RATIO = Math.max(0, Number(Deno.env.get("FLOWTUBE_RISK_RESERVE_RATIO") || 0.1));
const INFRA_TEXT_BASE_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_TEXT_BASE_USD") || 0.0005));
const INFRA_TEXT_TOKEN_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_TEXT_TOKEN_USD") || 0.00000001));
const INFRA_IMAGE_BASE_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_IMAGE_BASE_USD") || 0.003));
const INFRA_VIDEO_BASE_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_VIDEO_BASE_USD") || 0.01));
const INFRA_VIDEO_PER_SECOND_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_VIDEO_PER_SECOND_USD") || 0.002));
const INFRA_MEDIA_STORAGE_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_MEDIA_STORAGE_USD") || 0.002));
const INFRA_MEDIA_BANDWIDTH_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_BANDWIDTH_USD") || 0.001));
const INFRA_MEDIA_POLLING_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_POLLING_USD") || 0.001));
const INFRA_MEDIA_INPUT_USD = Math.max(0, Number(Deno.env.get("FLOWTUBE_INFRA_INPUT_USD") || 0.001));
const UNKNOWN_MODEL_COST_USD = Math.max(0.01, Number(Deno.env.get("FLOWTUBE_UNKNOWN_MODEL_COST_USD") || 0.05));
const MAX_MEDIA_CREDITS_PER_GENERATION = Math.max(1, Number(Deno.env.get("FLOWTUBE_MAX_MEDIA_CREDITS") || 10000));
const QUALITY_MARGIN_MULTIPLIERS: Record<"economy" | "standard" | "premium" | "heavy", number> = {
  economy: 3,
  standard: 3.2,
  premium: 3.5,
  heavy: 4,
};
const EXPENSIVE_CREDIT_THRESHOLD = 200;
const DEFAULT_MONEYFUSION_CHECKOUT_URL = "https://pay.moneyfusion.net/HuggyFlow/72cdb377014bd232/pay/";
const DEFAULT_MONEYFUSION_STATUS_URL = "https://www.pay.moneyfusion.net/paiementNotif/{token}";
const DEFAULT_USD_XOF_RATE = Number(Deno.env.get("MONEYFUSION_USD_XOF_RATE") || Deno.env.get("MONEYFUSION_USD_RATE") || 600);
const DEFAULT_BILLING_CURRENCY = (Deno.env.get("MONEYFUSION_CURRENCY") || "XOF").toUpperCase();
const FAPSHI_BASE_URL = (Deno.env.get("FAPSHI_BASE_URL") || "https://api.fapshi.com").replace(/\/$/, "");
const FAPSHI_DIRECT_PAY_ENABLED = (Deno.env.get("FAPSHI_DIRECT_PAY_ENABLED") || "false").toLowerCase() === "true";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OPENROUTER_ENABLED = (Deno.env.get("OPENROUTER_ENABLED") || "").toLowerCase() === "true" || Boolean(OPENROUTER_API_KEY);
const OPENROUTER_MEDIA_ENABLED = OPENROUTER_ENABLED && (Deno.env.get("OPENROUTER_MEDIA_ENABLED") || "").toLowerCase() === "true";
const OPENROUTER_AGENT_ENABLED = OPENROUTER_ENABLED && (Deno.env.get("OPENROUTER_AGENT_ENABLED") || "true").toLowerCase() !== "false";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_CATALOG_TTL_MS = 10 * 60 * 1000;
const MODEL_POPULARITY_TTL_MS = 10 * 60 * 1000;
const MODEL_POPULARITY_WINDOW_DAYS = 30;
const OPENROUTER_CURATED_AGENT_IDS = [
  "openai/gpt-chat-latest",
  "google/gemini-3.7-flash",
  "anthropic/claude-sonnet-5",
  "anthropic/claude-opus-5",
  "deepseek/deepseek-v4-flash-0731",
  "deepseek/deepseek-v4-pro-0813",
  "x-ai/grok-4.6",
  "qwen/qwen3.7-flash",
  "openai/gpt-5.6-luna",
  "openai/gpt-5.6-terra",
  "openai/gpt-5.6-sol",
  "openai/gpt-5.6-luna-pro",
  "openai/gpt-5.5",
  "anthropic/claude-fable-5",
  "tencent/hy3",
] as const;
const OPENROUTER_CURATED_BATCH_IDS = ["anthropic/claude-fable-5:batch"] as const;
const OPENROUTER_CURATED_IMAGE_IDS = [
  "openai/gpt-image-2",
  "google/gemini-3-pro-image",
  "google/gemini-3.1-flash-image",
  "bytedance-seed/seedream-5-0-pro",
] as const;
const OPENROUTER_CURATED_VIDEO_IDS = [
  "bytedance/seedance-2.0",
  "kwaivgi/kling-v3.0-pro",
  "google/veo-3.1",
  "alibaba/wan-2.7",
] as const;

// Public media policy. Provider routes are resolved below; these are the only
// user-facing families that can be returned by bootstrap or selected manually.
const PUBLIC_MEDIA_FAMILIES = [
  "nano-banana-pro",
  "nano-banana-2",
  "soul-2.0",
  "seedream-5.0",
  "gpt-image-2",
  "seedance-2.0",
  "seedance-2.5",
  "gemini-omni-flash",
  "kling-3.0",
  "veo-3.1",
  "wan-2.7",
] as const;

type PublicMediaFamily = typeof PUBLIC_MEDIA_FAMILIES[number];

const PUBLIC_MEDIA_DEFINITIONS: Record<PublicMediaFamily, {
  name: string;
  type: "image" | "video";
  description: string;
  capabilities: string[];
}> = {
  "nano-banana-pro": { name: "Nano Banana Pro", type: "image", description: "Images premium avec références et édition.", capabilities: ["text-to-image", "image-to-image", "edit", "reference"] },
  "nano-banana-2": { name: "Nano Banana 2", type: "image", description: "Images rapides avec références visuelles.", capabilities: ["text-to-image", "image-to-image", "edit", "reference"] },
  "soul-2.0": { name: "Soul 2.0", type: "image", description: "Modèle image premium pour les créations avancées.", capabilities: ["text-to-image", "reference"] },
  "seedream-5.0": { name: "Seedream 5.0", type: "image", description: "Images détaillées et mises en page complexes.", capabilities: ["text-to-image", "image-to-image", "edit", "reference"] },
  "gpt-image-2": { name: "GPT Image 2", type: "image", description: "Création et édition d’images avec consignes précises.", capabilities: ["text-to-image", "image-to-image", "edit", "reference"] },
  "seedance-2.0": { name: "Seedance 2.0", type: "video", description: "Vidéos cinématiques à partir d’un texte ou d’une image.", capabilities: ["text-to-video", "image-to-video", "reference-to-video", "reference"] },
  "seedance-2.5": { name: "Seedance 2.5", type: "video", description: "Vidéos longues avec références multimodales.", capabilities: ["text-to-video", "image-to-video", "reference-to-video", "reference"] },
  "gemini-omni-flash": { name: "Gemini Omni Flash", type: "video", description: "Vidéos avec mouvement et audio synchronisé.", capabilities: ["text-to-video", "image-to-video", "reference-to-video", "reference"] },
  "kling-3.0": { name: "Kling 3.0", type: "video", description: "Vidéos réalistes et cohérence des personnages.", capabilities: ["text-to-video", "image-to-video", "reference-to-video", "reference"] },
  "veo-3.1": { name: "Veo 3.1", type: "video", description: "Vidéos premium avec audio et références.", capabilities: ["text-to-video", "image-to-video", "reference-to-video", "reference"] },
  "wan-2.7": { name: "Wan 2.7", type: "video", description: "Vidéos rapides pour les formats sociaux.", capabilities: ["text-to-video", "image-to-video", "reference-to-video", "reference"] },
};
const RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_WINDOW_SECONDS") || 60);
const DEFAULT_RATE_LIMIT = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_DEFAULT") || 80);
const GENERATION_RATE_LIMIT = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_GENERATION") || 20);

const AGENT_CREDIT_RATES: Record<string, { credits: number; label: string; margin: "eco" | "standard" | "premium" | "max" }> = {
  "openai/gpt-chat-latest": { credits: 4, label: "Selon les tokens", margin: "standard" },
  "google/gemini-3.7-flash": { credits: 4, label: "Selon les tokens", margin: "standard" },
  "anthropic/claude-sonnet-5": { credits: 4, label: "Selon les tokens", margin: "standard" },
  "anthropic/claude-opus-5": { credits: 12, label: "Selon les tokens", margin: "premium" },
  "deepseek/deepseek-v4-flash-0731": { credits: 2, label: "Selon les tokens", margin: "eco" },
  "deepseek/deepseek-v4-pro-0813": { credits: 8, label: "Selon les tokens", margin: "premium" },
  "x-ai/grok-4.6": { credits: 8, label: "Selon les tokens", margin: "premium" },
  "qwen/qwen3.7-flash": { credits: 2, label: "Selon les tokens", margin: "eco" },
  "openai/gpt-5.6-luna": { credits: 2, label: "Selon les tokens", margin: "eco" },
  "openai/gpt-5.6-terra": { credits: 5, label: "Selon les tokens", margin: "standard" },
  "openai/gpt-5.6-sol": { credits: 8, label: "Selon les tokens", margin: "premium" },
  "openai/gpt-5.6-luna-pro": { credits: 5, label: "Selon les tokens", margin: "premium" },
  "openai/gpt-5.5": { credits: 8, label: "Selon les tokens", margin: "premium" },
  "anthropic/claude-fable-5": { credits: 8, label: "Selon les tokens", margin: "premium" },
  "anthropic/claude-fable-5:batch": { credits: 6, label: "Selon les tokens", margin: "premium" },
  "tencent/hy3": { credits: 2, label: "Selon les tokens", margin: "eco" },
};

const AGENT_TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  "openai/gpt-chat-latest": { input: 2, output: 8 },
  "google/gemini-3.7-flash": { input: 0.5, output: 3 },
  "anthropic/claude-sonnet-5": { input: 3, output: 15 },
  "anthropic/claude-opus-5": { input: 5, output: 25 },
  "deepseek/deepseek-v4-flash-0731": { input: 0.2, output: 1 },
  "deepseek/deepseek-v4-pro-0813": { input: 2, output: 8 },
  "x-ai/grok-4.6": { input: 2, output: 8 },
  "qwen/qwen3.7-flash": { input: 0.2, output: 1 },
  "openai/gpt-5.6-luna": { input: 0.1, output: 0.6 },
  "openai/gpt-5.6-terra": { input: 1, output: 6 },
  "openai/gpt-5.6-sol": { input: 5, output: 30 },
  "openai/gpt-5.6-luna-pro": { input: 0.1, output: 0.6 },
  "openai/gpt-5.5": { input: 5, output: 30 },
  "anthropic/claude-fable-5": { input: 10, output: 50 },
  "anthropic/claude-fable-5:batch": { input: 5, output: 25 },
  "tencent/hy3": { input: 0.132, output: 0.528 },
};

type AgentUsage = { inputTokens?: number; outputTokens?: number };

type ModelCapability =
  | "text"
  | "streaming"
  | "reasoning"
  | "tools"
  | "parallel_tools"
  | "vision"
  | "image"
  | "image_edit"
  | "video"
  | "audio"
  | "documents"
  | "research"
  | "structured_output"
  | "long_context"
  | "batch";

type ModelCapabilityProfile = {
  modelId: string;
  capabilities: ModelCapability[];
  inputModalities: string[];
  outputModalities: string[];
  contextTokens?: number;
  maxOutputTokens?: number;
  confirmedAt: string | null;
  source: "openrouter" | "catalog";
};

const OPENROUTER_CAPABILITIES = new Map<string, ModelCapabilityProfile>();

function hasSupportedParameter(model: OpenRouterRemoteModel, name: string) {
  const parameters = model.supported_parameters;
  if (Array.isArray(parameters)) return parameters.some((value) => String(value).toLowerCase() === name.toLowerCase());
  if (!parameters || typeof parameters !== "object") return false;
  return Object.keys(parameters).some((key) => key.toLowerCase() === name.toLowerCase());
}

function capabilityProfileForOpenRouterModel(model: OpenRouterRemoteModel, confirmedAt: string | null = openRouterCatalogCache.syncedAt): ModelCapabilityProfile {
  const modelId = String(model.id || "");
  const inputModalities = (model.architecture?.input_modalities || []).map(String).map((value) => value.toLowerCase());
  const outputModalities = (model.architecture?.output_modalities || []).map(String).map((value) => value.toLowerCase());
  const capabilities = new Set<ModelCapability>();
  const isBatch = isBatchModel(modelId);
  const isAgent = OPENROUTER_AGENT_IDS.has(modelId) && !isBatch;
  const isImage = outputModalities.includes("image") || OPENROUTER_CURATED_IMAGE_IDS.includes(modelId as typeof OPENROUTER_CURATED_IMAGE_IDS[number]);
  const isVideo = outputModalities.includes("video") || OPENROUTER_CURATED_VIDEO_IDS.includes(modelId as typeof OPENROUTER_CURATED_VIDEO_IDS[number]);
  const isAudio = outputModalities.includes("audio") || outputModalities.includes("speech");

  if (isAgent) {
    capabilities.add("text");
    capabilities.add("streaming");
  } else if (isBatch) {
    capabilities.add("batch");
  }
  if (inputModalities.includes("image") || inputModalities.includes("video")) capabilities.add("vision");
  if (inputModalities.includes("file") || inputModalities.includes("document") || inputModalities.includes("pdf")) capabilities.add("documents");
  if (isImage) capabilities.add("image");
  if (isImage && inputModalities.includes("image")) capabilities.add("image_edit");
  if (isVideo) capabilities.add("video");
  if (isAudio) capabilities.add("audio");
  if (hasSupportedParameter(model, "tools") || hasSupportedParameter(model, "tool_choice")) capabilities.add("tools");
  if (hasSupportedParameter(model, "parallel_tool_calls")) capabilities.add("parallel_tools");
  if (hasSupportedParameter(model, "response_format") || hasSupportedParameter(model, "structured_outputs")) capabilities.add("structured_output");
  if (hasSupportedParameter(model, "reasoning") || /reason|think|o[134]|opus|sol|deepseek/i.test(modelId)) capabilities.add("reasoning");
  const contextTokens = Number((model as OpenRouterRemoteModel & { context_length?: number }).context_length || 0);
  const maxOutputTokens = Number((model as OpenRouterRemoteModel & { max_output_tokens?: number }).max_output_tokens || 0);
  if (contextTokens >= 100_000) capabilities.add("long_context");
  if (hasSupportedParameter(model, "web_search_options") || hasSupportedParameter(model, "search")) capabilities.add("research");

  return {
    modelId,
    capabilities: [...capabilities],
    inputModalities,
    outputModalities,
    ...(contextTokens > 0 ? { contextTokens } : {}),
    ...(maxOutputTokens > 0 ? { maxOutputTokens } : {}),
    confirmedAt,
    source: "openrouter",
  };
}

function rebuildOpenRouterCapabilityRegistry() {
  OPENROUTER_CAPABILITIES.clear();
  const confirmedAt = openRouterCatalogCache.syncedAt;
  for (const model of [...openRouterCatalogCache.agent, ...openRouterCatalogCache.batch, ...openRouterCatalogCache.image, ...openRouterCatalogCache.video]) {
    const profile = capabilityProfileForOpenRouterModel(model, confirmedAt);
    OPENROUTER_CAPABILITIES.set(profile.modelId, profile);
  }
}

function modelCapabilityProfile(modelId: string) {
  return OPENROUTER_CAPABILITIES.get(internalModelId(modelId));
}

function modelHasCapability(modelId: string, capability: ModelCapability) {
  return Boolean(modelCapabilityProfile(modelId)?.capabilities.includes(capability));
}

function capabilityLabel(capability: ModelCapability) {
  const labels: Record<ModelCapability, string> = {
    text: "Texte",
    streaming: "Streaming",
    reasoning: "Raisonnement",
    tools: "Outils",
    parallel_tools: "Outils paralleles",
    vision: "Vision",
    image: "Image",
    image_edit: "Edition image",
    video: "Video",
    audio: "Audio",
    documents: "Documents",
    research: "Recherche",
    structured_output: "Sortie structuree",
    long_context: "Contexte long",
    batch: "Traitement en lot",
  };
  return labels[capability];
}

const OPENROUTER_LIVE_PRICES: Record<string, { input: number; output: number }> = {};
const OPENROUTER_PRICE_REFRESHED_AT: Record<string, number> = {};
const OPENROUTER_AGENT_IDS = new Set<string>(OPENROUTER_CURATED_AGENT_IDS);
const OPENROUTER_BATCH_IDS = new Set<string>(OPENROUTER_CURATED_BATCH_IDS);
const OPENROUTER_STATIC_FALLBACK_PRICES: Record<string, { input: number; output: number }> = {};
const PUBLIC_MODEL_IDS = new Map<string, string>();

function publicModelKey(modelId: string) {
  const value = String(modelId || "");
  if (value === "auto") return "auto";
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `model_${(hash >>> 0).toString(36)}`;
}

function rememberPublicModel(modelId: string) {
  const key = publicModelKey(modelId);
  PUBLIC_MODEL_IDS.set(key, modelId);
  return key;
}

function internalModelId(value: unknown) {
  const raw = String(value || "").trim();
  return PUBLIC_MODEL_IDS.get(raw) || raw;
}

for (const modelId of [...OPENROUTER_CURATED_AGENT_IDS, ...OPENROUTER_CURATED_BATCH_IDS, ...OPENROUTER_CURATED_IMAGE_IDS, ...OPENROUTER_CURATED_VIDEO_IDS]) {
  PUBLIC_MODEL_IDS.set(publicModelKey(modelId), modelId);
}

function isBatchModel(modelId: string) {
  return OPENROUTER_BATCH_IDS.has(modelId) || modelId.endsWith(":batch");
}

type OpenRouterRemoteModel = {
  id?: string;
  name?: string;
  description?: string;
  pricing?: { prompt?: string | number; completion?: string | number; image?: string | number; request?: string | number } | null;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] } | null;
  supported_parameters?: Record<string, unknown> | string[] | null;
  context_length?: number;
  max_output_tokens?: number;
  pricing_skus?: Record<string, string | number> | null;
  supported_durations?: number[] | null;
  supported_resolutions?: string[] | null;
  supported_aspect_ratios?: string[] | null;
  supported_frame_images?: string[] | null;
};

type OpenRouterCatalog = {
  agent: OpenRouterRemoteModel[];
  batch: OpenRouterRemoteModel[];
  image: OpenRouterRemoteModel[];
  video: OpenRouterRemoteModel[];
  syncedAt: string | null;
  live: boolean;
};

type ModelPopularityCache = {
  counts: Map<string, number>;
  syncedAt: string | null;
  windowDays: number;
};

let openRouterCatalogCache: OpenRouterCatalog = {
  agent: [],
  batch: [],
  image: [],
  video: [],
  syncedAt: null,
  live: false,
};

let modelPopularityCache: ModelPopularityCache = {
  counts: new Map(),
  syncedAt: null,
  windowDays: MODEL_POPULARITY_WINDOW_DAYS,
};

function openRouterHeaders() {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "HTTP-Referer": APP_BASE_URL,
    "X-Title": APP_NAME,
    Accept: "application/json",
  };
}

async function openRouterList(path: string): Promise<OpenRouterRemoteModel[]> {
  if (!OPENROUTER_API_KEY) return [];
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, { headers: openRouterHeaders() });
    if (!response.ok) return [];
    const body = await response.json() as { data?: OpenRouterRemoteModel[] };
    return Array.isArray(body.data) ? body.data : [];
  } catch (_error) {
    return [];
  }
}

async function refreshOpenRouterCatalog(force = false) {
  if (!OPENROUTER_ENABLED || !OPENROUTER_API_KEY) return openRouterCatalogCache;
  const refreshedAt = openRouterCatalogCache.syncedAt ? Date.parse(openRouterCatalogCache.syncedAt) : 0;
  if (!force && refreshedAt && Date.now() - refreshedAt < OPENROUTER_CATALOG_TTL_MS) return openRouterCatalogCache;
  const [allModels, imageModels, videoModels] = await Promise.all([
    openRouterList("/models"),
    openRouterList("/images/models"),
    openRouterList("/videos/models"),
  ]);
  const byId = (items: OpenRouterRemoteModel[], ids: readonly string[]) => {
    const allowed = new Set(ids);
    return items.filter((item) => allowed.has(String(item.id || "")));
  };
  const agent = byId(allModels, OPENROUTER_CURATED_AGENT_IDS);
  const batch = byId(allModels, OPENROUTER_CURATED_BATCH_IDS);
  const image = byId(imageModels, OPENROUTER_CURATED_IMAGE_IDS);
  const video = byId(videoModels, OPENROUTER_CURATED_VIDEO_IDS);
  const live = agent.length + batch.length + image.length + video.length > 0;
  openRouterCatalogCache = { agent, batch, image, video, syncedAt: new Date().toISOString(), live };
  rebuildOpenRouterCapabilityRegistry();
  for (const model of agent) {
    const input = Number(model.pricing?.prompt);
    const output = Number(model.pricing?.completion);
    if (Number.isFinite(input) && Number.isFinite(output)) {
      OPENROUTER_LIVE_PRICES[String(model.id)] = { input: input * 1_000_000, output: output * 1_000_000 };
      OPENROUTER_PRICE_REFRESHED_AT[String(model.id)] = Date.now();
    }
  }
  for (const model of batch) {
    const input = Number(model.pricing?.prompt);
    const output = Number(model.pricing?.completion);
    if (Number.isFinite(input) && Number.isFinite(output)) {
      OPENROUTER_LIVE_PRICES[String(model.id)] = { input: input * 1_000_000, output: output * 1_000_000 };
      OPENROUTER_PRICE_REFRESHED_AT[String(model.id)] = Date.now();
    }
  }
  return openRouterCatalogCache;
}

async function refreshModelPopularity(supabase: ReturnType<typeof adminClient>, force = false) {
  const refreshedAt = modelPopularityCache.syncedAt ? Date.parse(modelPopularityCache.syncedAt) : 0;
  if (!force && refreshedAt && Date.now() - refreshedAt < MODEL_POPULARITY_TTL_MS) return modelPopularityCache;

  const since = new Date(Date.now() - MODEL_POPULARITY_WINDOW_DAYS * 86400000).toISOString();
  const [generationsResult, agentUsageResult] = await Promise.all([
    supabase.from("generations")
      .select("model_id,status,created_at")
      .gte("created_at", since)
      .in("status", ["pending", "running", "completed"])
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase.from("pricing_audit_logs")
      .select("metadata,status,created_at")
      .eq("status", "completed")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  const counts = new Map<string, number>();
  const addUsage = (value: unknown) => {
    const modelId = internalModelId(value);
    if (!modelId || isBatchModel(modelId)) return;
    counts.set(modelId, (counts.get(modelId) || 0) + 1);
  };

  for (const row of generationsResult.data || []) addUsage(row.model_id);
  for (const row of agentUsageResult.data || []) {
    const metadata = row.metadata && typeof row.metadata === "object"
      ? row.metadata as Record<string, unknown>
      : {};
    addUsage(metadata.model_id);
  }

  modelPopularityCache = {
    counts,
    syncedAt: new Date().toISOString(),
    windowDays: MODEL_POPULARITY_WINDOW_DAYS,
  };
  return modelPopularityCache;
}

function isOpenRouterAgentModel(modelId: string) {
  return OPENROUTER_AGENT_IDS.has(modelId);
}

function isFreeOpenRouterAgentModel(modelId: string) {
  return modelId.endsWith(":free") && OPENROUTER_AGENT_IDS.has(modelId);
}

function agentTokenPriceForModel(modelId: string) {
  const raw = internalModelId(modelId);
  const resolved = isBatchModel(raw) ? raw : resolveAgentModelId(raw);
  if (isFreeOpenRouterAgentModel(resolved)) return { input: 0, output: 0 };
  if (OPENROUTER_LIVE_PRICES[resolved]) return OPENROUTER_LIVE_PRICES[resolved];
  if (OPENROUTER_STATIC_FALLBACK_PRICES[resolved]) return OPENROUTER_STATIC_FALLBACK_PRICES[resolved];
  if (AGENT_TOKEN_PRICES[resolved]) return AGENT_TOKEN_PRICES[resolved];
  if (isOpenRouterAgentModel(resolved)) return { input: 10, output: 40 };
  return AGENT_TOKEN_PRICES[DEFAULT_MODEL] || AGENT_TOKEN_PRICES["claude-sonnet-4-6"];
}

async function refreshOpenRouterPrice(modelId: string) {
  const resolved = resolveAgentModelId(modelId);
  if (!isOpenRouterAgentModel(resolved) || isFreeOpenRouterAgentModel(resolved)) return agentTokenPriceForModel(resolved);
  const refreshedAt = OPENROUTER_PRICE_REFRESHED_AT[resolved] || 0;
  if (OPENROUTER_LIVE_PRICES[resolved] && Date.now() - refreshedAt < 10 * 60 * 1000) return OPENROUTER_LIVE_PRICES[resolved];
  if (!OPENROUTER_API_KEY) return agentTokenPriceForModel(resolved);
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, { headers: openRouterHeaders() });
    if (response.ok) {
      const body = await response.json() as { data?: Array<{ id?: string; pricing?: { prompt?: string | number; completion?: string | number } }> };
      const found = body.data?.find((item) => item.id === resolved);
      const input = Number(found?.pricing?.prompt);
      const output = Number(found?.pricing?.completion);
      if (Number.isFinite(input) && Number.isFinite(output)) {
        OPENROUTER_LIVE_PRICES[resolved] = { input: input * 1_000_000, output: output * 1_000_000 };
        OPENROUTER_PRICE_REFRESHED_AT[resolved] = Date.now();
      }
    }
  } catch (_error) {
    // Le fallback conservateur protege la marge si le catalogue est indisponible.
  }
  return agentTokenPriceForModel(resolved);
}

function agentInfrastructureCostUsd(inputTokens: number, outputTokens: number) {
  return Number((INFRA_TEXT_BASE_USD + (inputTokens + outputTokens) * INFRA_TEXT_TOKEN_USD).toFixed(6));
}

function protectedOperatingCostUsd(providerCostUsd: number, infrastructureCostUsd: number) {
  const base = Math.max(0, providerCostUsd) + Math.max(0, infrastructureCostUsd);
  return Number((base * (1 + PAYMENT_RESERVE_RATIO + RISK_RESERVE_RATIO)).toFixed(6));
}

function agentCreditsForUsage(modelId: string, usage: AgentUsage, multiplier = 1) {
  if (isFreeOpenRouterAgentModel(resolveAgentModelId(modelId))) {
    return { credits: 0, providerCostUsd: 0, infrastructureCostUsd: 0, protectedCostUsd: 0, inputTokens: Math.max(0, Number(usage.inputTokens || 0)), outputTokens: Math.max(0, Number(usage.outputTokens || 0)) };
  }
  const inputTokens = Math.max(0, Number(usage.inputTokens || 0));
  const outputTokens = Math.max(0, Number(usage.outputTokens || 0));
  const price = agentTokenPriceForModel(modelId);
  const providerCostUsd = Number(((inputTokens * price.input + outputTokens * price.output) / 1_000_000).toFixed(6));
  const infrastructureCostUsd = agentInfrastructureCostUsd(inputTokens, outputTokens);
  const protectedCostUsd = Math.max(protectedOperatingCostUsd(providerCostUsd, infrastructureCostUsd), 0.0005);
  const credits = Math.max(1, Math.ceil((protectedCostUsd * agentMarginMultiplierForModel(modelId) * Math.max(1, multiplier)) / CREDIT_FLOOR_USD));
  return { credits, providerCostUsd, infrastructureCostUsd, protectedCostUsd, inputTokens, outputTokens };
}

function estimatedAgentCreditsForPayload(modelId: string, payload: Record<string, unknown>, multiplier = 1) {
  const serialized = JSON.stringify(payload || {});
  const inputTokens = Math.max(1, Math.ceil((serialized.length / 3) * 1.15));
  const outputTokens = Math.max(1, Number(payload.max_tokens || 1200));
  return agentCreditsForUsage(modelId, { inputTokens, outputTokens }, multiplier).credits;
}

function agentCreditRateForModel(modelId: string) {
  const raw = internalModelId(modelId);
  const resolved = isBatchModel(raw) ? raw : resolveAgentModelId(raw);
  if (AGENT_CREDIT_RATES[resolved]) return AGENT_CREDIT_RATES[resolved];
  if (/opus|pro/i.test(resolved)) return { credits: 12, label: "12 cr", margin: "premium" as const };
  if (/haiku/i.test(resolved)) return { credits: 1, label: "1 cr", margin: "eco" as const };
  return { credits: 4, label: "4 cr", margin: "standard" as const };
}

function agentMarginMultiplierForModel(modelId: string) {
  const margin = agentCreditRateForModel(modelId).margin;
  if (margin === "max") return QUALITY_MARGIN_MULTIPLIERS.heavy;
  if (margin === "premium") return QUALITY_MARGIN_MULTIPLIERS.premium;
  if (margin === "eco") return QUALITY_MARGIN_MULTIPLIERS.economy;
  return QUALITY_MARGIN_MULTIPLIERS.standard;
}

function safeModelName(modelId: string, remoteName?: string) {
  const fallback = modelId.split("/").pop()?.replace(/[-_]+/g, " ") || "Modele";
  return String(remoteName || fallback)
    .replace(/^[^:]{2,24}:\s*/i, "")
    .replace(/\b(openrouter|openai|anthropic|google|deepseek|qwen|tencent|mistral|meta|microsoft|x-ai|xai)\b/ig, "")
    .replace(/\s{2,}/g, " ")
    .trim() || fallback;
}

function publicModelDescription(capabilities: string[], tier: string) {
  if (capabilities.includes("vision")) return tier === "premium" ? "Analyse les references et les briefs complexes." : "Comprend les images et les consignes detaillees.";
  if (capabilities.includes("reasoning")) return tier === "premium" ? "Raisonnement approfondi pour les workflows exigeants." : "Reponse rapide pour les workflows du quotidien.";
  return "Modele polyvalent pour les demandes HuggyFlow.";
}

function publicAgentModels() {
  const popularity = modelPopularityCache.counts;
  const remote = openRouterCatalogCache.agent
    .filter((item) => !isBatchModel(String(item.id || "")))
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const countA = popularity.get(String(a.item.id || "")) || 0;
      const countB = popularity.get(String(b.item.id || "")) || 0;
      return countB - countA || a.index - b.index;
    })
    .map(({ item }) => item);
  const confirmedCapabilities = [...new Set(remote.flatMap((item) => capabilityProfileForOpenRouterModel(item).capabilities))];
  const models = [{ id: "auto", modelKey: "auto", name: "Auto", description: "Choisit automatiquement la configuration la plus adaptee a ta demande.", tier: "balanced", capabilities: confirmedCapabilities }, ...remote.map((item) => {
    const id = String(item.id || "");
    const key = rememberPublicModel(id);
    const profile = capabilityProfileForOpenRouterModel(item);
    const capabilities = profile.capabilities;
    const tier = /opus|pro|sol|sora/i.test(id) ? "premium" : /flash|mini|luna/i.test(id) ? "fast" : "balanced";
    return { id: key, modelKey: key, name: safeModelName(id, item.name).replace(/openrouter/ig, "").trim() || "Modele", description: publicModelDescription(capabilities, tier), tier, capabilities };
  })];
  return models.map((model) => {
    const internalId = model.id === "auto" ? "auto" : internalModelId(model.modelKey);
    const sampleCredits = model.id === "auto" ? 0 : agentCreditsForUsage(internalId, { inputTokens: 2000, outputTokens: 800 }).credits;
    return {
      ...model,
      creditsPerMessage: sampleCredits,
      creditsLabel: model.id === "auto" ? "Selon la tache" : (isFreeOpenRouterAgentModel(internalId) ? "Gratuit" : `Environ ${sampleCredits} cr`),
      free: model.id !== "auto" && isFreeOpenRouterAgentModel(internalId),
      freeUntil: null,
      current: model.id !== "auto" && internalId === DEFAULT_MODEL,
      available: model.id === "auto" || remote.some((item) => item.id === internalId),
    };
  });
}

function publicBatchModels() {
  return openRouterCatalogCache.batch.map((item) => {
    const id = String(item.id || "");
    const modelKey = rememberPublicModel(id);
    const profile = capabilityProfileForOpenRouterModel(item);
    const credits = agentCreditsForUsage(id, { inputTokens: 2000, outputTokens: 800 }).credits;
    return {
      modelKey,
      name: safeModelName(id, item.name).replace(/openrouter/ig, "").trim() || "Modele batch",
      description: "Traitement en lot pour les taches longues et planifiees.",
      capabilities: profile.capabilities,
      tier: "premium",
      available: true,
      creditsLabel: `Environ ${credits} cr par tache`,
      batchOnly: true,
    };
  });
}

function cleanAgentDisplayText(text: string) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\u0000/g, "")
    .replace(/\n{4,}/g, "\n\n\n");
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function activeDefaultAgentModel() {
  const confirmed = openRouterCatalogCache.agent.map((item) => String(item.id || "")).filter(Boolean);
  return confirmed.includes(DEFAULT_MODEL) ? DEFAULT_MODEL : confirmed[0] || DEFAULT_MODEL;
}

function resolveAgentModelId(value: unknown) {
  const raw = internalModelId(value);
  if (!raw || raw === "auto" || raw === "huggy-auto") return activeDefaultAgentModel();
  if (isBatchModel(raw)) return activeDefaultAgentModel();
  if (OPENROUTER_AGENT_ENABLED && OPENROUTER_AGENT_IDS.has(raw)) {
    return openRouterCatalogCache.agent.some((item) => item.id === raw) ? raw : activeDefaultAgentModel();
  }
  if (!OPENROUTER_AGENT_ENABLED && /^claude-[a-z0-9][a-z0-9._-]*$/i.test(raw)) return raw;
  return activeDefaultAgentModel();
}

function agentModelFromBody(body: Record<string, unknown>) {
  return resolveAgentModelId(body.agentModelId || body.agent_model_id || body.anthropicModel || body.anthropic_model);
}

function requestedAgentModelValue(body: Record<string, unknown>) {
  return body.agentModelId || body.agent_model_id || body.anthropicModel || body.anthropic_model || "auto";
}

type OrchestrationIntent = "conversation" | "analysis" | "research" | "document" | "media" | "workflow";
type OrchestrationComplexity = "simple" | "standard" | "complex";

type OrchestrationDecision = {
  intent: OrchestrationIntent;
  complexity: OrchestrationComplexity;
  requiresProjectContext: boolean;
  usesTools: boolean;
  usesAgentLoop: boolean;
  publicSummary: string;
};

function isProjectContinuationPrompt(prompt: string) {
  const text = stripAccents(String(prompt || "").toLowerCase());
  return /\b(continue|suite|reprends|reprendre|ce projet|ce brief|ce rendu|cette image|cette video|la derniere|le dernier|precedent|precedente|meme style|meme personnage|pareil|comme avant|refais|remix|variante|modifie|ajuste)\b/.test(text);
}

function orchestrateRequest(
  prompt: string,
  body: Record<string, unknown>,
  attachments: ReturnType<typeof normalizeRequestAttachments>,
): OrchestrationDecision {
  const text = stripAccents(String(prompt || "").trim().toLowerCase());
  const requestedIntent = String(body.intent || "auto").toLowerCase();
  const requestedMode = String(body.mode || "").toLowerCase();
  const media = shouldGenerateMedia(prompt, requestedMode, String(body.modelId || "auto"), requestedIntent);
  const research = isResearchRequest(prompt) || body.useModelResearch === true || body.use_model_research === true;
  const document = requestedMode === "document" || /\b(pdf|document|rapport|tableau|csv|presentation|presentation)\b/.test(text);
  const explicitTools = Boolean(body.tools || body.toolChoice || body.tool_choice);
  const multiStep = /\b(planifie|workflow|campagne|plusieurs|serie|série|lot|etape|étape|de la recherche|puis |ensuite |publie|publier|connecteur)\b/.test(text);
  const analytical = /\b(analyse|audit|strategie|strat\w+gie|compare|raisonne|complexe|deep research|recherche)\b/.test(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  let complexityScore = 0;
  if (wordCount >= 35) complexityScore += 1;
  if (attachments.length) complexityScore += 1;
  if (analytical) complexityScore += 1;
  if (multiStep) complexityScore += 2;
  if (explicitTools || research) complexityScore += 2;
  if (media && /\b(video|audio|lipsync|batch|lot)\b/.test(text)) complexityScore += 2;
  const complexity: OrchestrationComplexity = complexityScore >= 3 ? "complex" : complexityScore >= 1 ? "standard" : "simple";
  const intent: OrchestrationIntent = media
    ? "media"
    : research
      ? "research"
      : document
        ? "document"
        : (multiStep || explicitTools)
          ? "workflow"
          : analytical
            ? "analysis"
            : "conversation";
  const requiresProjectContext = attachments.length > 0 || isProjectContinuationPrompt(prompt) || /\b(mon projet|ma marque|nos creations|nos créations|historique|galerie)\b/.test(text);
  const usesTools = explicitTools || research || intent === "workflow";
  const usesAgentLoop = agentLoopEnabled() && !media && usesTools;
  const publicSummary = intent === "media"
    ? "Configuration adaptée au rendu demandé."
    : intent === "research"
      ? "Recherche et vérification adaptées à la demande."
      : usesAgentLoop
        ? "Plan de travail adapté à cette demande."
        : "Réponse directe adaptée à votre demande.";
  return { intent, complexity, requiresProjectContext, usesTools, usesAgentLoop, publicSummary };
}

function requestedAgentCapabilities(
  prompt: string,
  body: Record<string, unknown>,
  decision: Pick<OrchestrationDecision, "complexity" | "usesTools">,
): ModelCapability[] {
  const required = new Set<ModelCapability>(["text"]);
  const attachments = normalizeRequestAttachments(body.attachments);
  const attachmentText = attachments.map((item) => `${item.name || ""} ${item.kind || ""} ${item.contentType || ""} ${item.url || ""}`).join(" ").toLowerCase();
  if (attachments.length || body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url) {
    required.add(/pdf|document|docx|txt|csv|spreadsheet|file/.test(attachmentText) ? "documents" : "vision");
  }
  if (body.outputFormat === "json" || body.output_format === "json" || body.responseFormat === "json" || body.response_format === "json" || body.structuredOutput || body.structured_output) required.add("structured_output");
  if (body.tools || body.toolChoice || body.tool_choice || decision.usesTools) required.add("tools");
  if (body.useModelResearch === true || body.use_model_research === true) required.add("research");
  if (decision.complexity === "complex" || /raisonne|analyse en profondeur|planifie|strategie|strat[eé]gie|complexe|deep research|think|reason/i.test(stripAccents(prompt))) required.add("reasoning");
  return [...required];
}

function selectAgentModelForRequest(
  body: Record<string, unknown>,
  prompt: string,
  required: ModelCapability[],
  complexity: OrchestrationComplexity,
) {
  const requested = String(requestedAgentModelValue(body) || "auto").trim();
  const isAuto = requested === "" || requested.toLowerCase() === "auto" || requested.toLowerCase() === "huggy-auto";
  const confirmed = openRouterCatalogCache.agent.filter((item) => {
    const id = String(item.id || "");
    const profile = capabilityProfileForOpenRouterModel(item);
    return id && !isBatchModel(id) && required.every((capability) => profile.capabilities.includes(capability));
  });
  if (!OPENROUTER_AGENT_ENABLED || !OPENROUTER_API_KEY) return agentModelFromBody(body);
  if (!isAuto) {
    const modelId = internalModelId(requested);
    const model = openRouterCatalogCache.agent.find((item) => String(item.id || "") === modelId);
    if (!model || isBatchModel(modelId)) throw new FlowtubeError(400, "Ce modele n'est pas disponible pour cette demande.", { code: "MODEL_UNAVAILABLE" });
    const profile = capabilityProfileForOpenRouterModel(model);
    const missing = required.filter((capability) => !profile.capabilities.includes(capability));
    if (missing.length) {
      throw new FlowtubeError(400, "Ce modele ne prend pas en charge cette capacite. Choisis Auto ou un modele compatible.", { code: "MODEL_CAPABILITY_UNAVAILABLE", capabilities: missing });
    }
    return modelId;
  }
  if (!confirmed.length) {
    throw new FlowtubeError(503, "Aucun modele compatible n'est disponible pour cette demande.", { code: "NO_COMPATIBLE_MODEL" });
  }
  const popularity = modelPopularityCache.counts;
  const normalizedPrompt = stripAccents(prompt.toLowerCase());
  return confirmed
    .map((item, index) => {
      const id = String(item.id || "");
      const profile = capabilityProfileForOpenRouterModel(item);
      const price = agentTokenPriceForModel(id);
      const display = `${id} ${String(item.name || "")}`.toLowerCase();
      const popularityScore = Math.min(12, popularity.get(id) || 0) * 3;
      const tokenCostScore = Math.min(18, price.input + price.output * 0.2);
      let score = popularityScore - tokenCostScore;
      if (complexity === "simple" && /flash|mini|fast|haiku/.test(display)) score += 16;
      if (complexity === "complex" && /opus|pro|reason|thinking|gpt-5|gemini.*pro/.test(display)) score += 18;
      if (complexity === "complex" && /flash|mini|haiku/.test(display)) score -= 8;
      if (profile.capabilities.includes("reasoning") && /raisonne|strategie|complexe|deep|planifie/.test(normalizedPrompt)) score += 15;
      if (profile.capabilities.includes("vision") && required.includes("vision")) score += 12;
      if (profile.capabilities.includes("tools") && required.includes("tools")) score += 10;
      if (profile.capabilities.includes("structured_output") && required.includes("structured_output")) score += 8;
      return { id, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)[0].id;
}

function assertAgentCapability(modelId: string, capability: ModelCapability) {
  if (!isOpenRouterAgentModel(modelId)) return;
  if (modelHasCapability(modelId, capability)) return;
  throw new FlowtubeError(400, `La capacite ${capabilityLabel(capability).toLowerCase()} n'est pas disponible pour ce modele.`, { code: "MODEL_CAPABILITY_UNAVAILABLE", capability });
}

function agentModelFallbacks(preferred?: string) {
  const resolved = resolveAgentModelId(preferred);
  if (!resolved) return [];
  if (!isOpenRouterAgentModel(resolved)) return [resolved];
  const source = openRouterCatalogCache.agent.find((item) => String(item.id || "") === resolved);
  const sourceProfile = source ? capabilityProfileForOpenRouterModel(source) : null;
  const required = (sourceProfile?.capabilities || []).filter((capability) =>
    ["vision", "documents", "tools", "reasoning"].includes(capability)
  );
  const alternates = openRouterCatalogCache.agent
    .filter((item) => {
      const id = String(item.id || "");
      if (!id || id === resolved || isBatchModel(id)) return false;
      const profile = capabilityProfileForOpenRouterModel(item);
      return required.every((capability) => profile.capabilities.includes(capability));
    })
    .map((item) => String(item.id || ""))
    .sort((left, right) => {
      const popularityDelta = (modelPopularityCache.counts.get(right) || 0) - (modelPopularityCache.counts.get(left) || 0);
      if (popularityDelta) return popularityDelta;
      const leftPrice = agentTokenPriceForModel(left);
      const rightPrice = agentTokenPriceForModel(right);
      return (leftPrice.input + leftPrice.output) - (rightPrice.input + rightPrice.output);
    });
  return [resolved, ...alternates.slice(0, 2)];
}

function shouldFallbackAnthropic(status: number) {
  // Certains modeles peuvent etre indisponibles selon workspace/data-retention.
  // On tente alors un modele de repli sans exposer l'erreur technique a l'utilisateur.
  return [400, 403, 404, 429, 529].includes(status);
}

type AgentBillingContext = {
  supabase: ReturnType<typeof adminClient>;
  userId: string;
  reason: string;
  multiplier?: number;
  send?: (event: string, payload: unknown) => void;
  idempotencyKey?: string;
};

function agentCreditsForTurn(modelId: string, multiplier = 1) {
  if (isFreeOpenRouterAgentModel(resolveAgentModelId(modelId))) return 0;
  return agentCreditsForUsage(modelId, { inputTokens: 2000, outputTokens: 800 }, multiplier).credits;
}

async function ensureAgentCreditsAvailable(billing: AgentBillingContext | undefined, modelId: string, requiredOverride?: number) {
  if (!billing) return;
  const creditsRequired = requiredOverride ?? agentCreditsForTurn(modelId, billing.multiplier);
  if (creditsRequired <= 0) return;
  const { data: profile, error } = await billing.supabase.from("profiles").select("credits,credits_max").eq("id", billing.userId).single();
  if (error) throw new FlowtubeError(500, "Impossible de verifier ton solde de credits.");
  const creditsAvailable = Number(profile?.credits || 0);
  if (creditsAvailable < creditsRequired) {
    throw new FlowtubeError(402, `Solde insuffisant: ${creditsRequired} credits requis, ${creditsAvailable} disponibles.`, {
      code: "INSUFFICIENT_AGENT_CREDITS",
      creditsRequired,
      creditsAvailable,
      modelId,
    });
  }
}

async function chargeAgentCredits(billing: AgentBillingContext | undefined, modelId: string, usage?: AgentUsage) {
  if (!billing) return { charged: 0, balance: undefined as number | undefined };
  const rate = agentCreditRateForModel(modelId);
  const fallbackUsage = agentCreditsForUsage(modelId, { inputTokens: 2000, outputTokens: 800 }, billing.multiplier);
  const usagePricing = usage
    ? agentCreditsForUsage(modelId, usage, billing.multiplier)
    : fallbackUsage;
  const credits = usagePricing.credits;
  if (credits <= 0) return { charged: 0, balance: undefined as number | undefined };
  const idempotencyKey = String(billing.idempotencyKey || `${billing.userId}:${billing.reason}:${crypto.randomUUID()}`).slice(0, 180);
  const metadata = {
    provider: isOpenRouterAgentModel(modelId) ? "openrouter" : "anthropic",
    model_id: modelId,
    credit_rate_label: rate.label,
    cost_class: rate.margin,
    reason: billing.reason,
    multiplier: Math.max(1, billing.multiplier || 1),
    input_tokens: usagePricing.inputTokens,
    output_tokens: usagePricing.outputTokens,
    infrastructure_cost_usd: usagePricing.infrastructureCostUsd,
    protected_cost_usd: usagePricing.protectedCostUsd,
    billing_mode: usage ? "actual_tokens" : "estimated_tokens",
  };
  const { data: atomicCharge, error: atomicChargeError } = await billing.supabase.rpc("charge_agent_credits", {
    p_user_id: billing.userId,
    p_credits: credits,
    p_idempotency_key: idempotencyKey,
    p_metadata: metadata,
  });
  if (!atomicChargeError && Array.isArray(atomicCharge) && atomicCharge[0]) {
    const result = atomicCharge[0] as Record<string, unknown>;
    const balanceAfter = Number(result.balance_after || 0);
    if (result.charged === false && Number(result.available || 0) < credits) {
      throw new FlowtubeError(402, "Solde de credits insuffisant pour continuer.", {
        code: "INSUFFICIENT_AGENT_CREDITS",
        creditsRequired: credits,
        creditsAvailable: Number(result.available || 0),
        modelId,
      });
    }
    if (result.charged === false) return { charged: 0, balance: balanceAfter };
    await billing.supabase.from("pricing_audit_logs").insert({
      user_id: billing.userId,
      credits_charged: credits,
      credit_floor_usd: CREDIT_FLOOR_USD,
      retail_credit_usd: RETAIL_CREDIT_USD,
      provider_cost_usd: usagePricing.providerCostUsd,
      infrastructure_cost_usd: usagePricing.infrastructureCostUsd,
      protected_cost_usd: usagePricing.protectedCostUsd,
      payment_reserve_ratio: PAYMENT_RESERVE_RATIO,
      risk_reserve_ratio: RISK_RESERVE_RATIO,
      status: "completed",
      metadata: { ...metadata, idempotency_key: idempotencyKey, margin_multiplier: agentMarginMultiplierForModel(modelId) },
    });
    if (billing.send) billing.send("credits", {
      credits: balanceAfter,
      creditsMax: Number(result.credits_max || 100),
    });
    return { charged: credits, balance: balanceAfter };
  }
  const { data: profile, error } = await billing.supabase.from("profiles").select("credits,credits_max").eq("id", billing.userId).single();
  if (error) throw new FlowtubeError(500, "Impossible de verifier ton solde de credits.");
  const creditsAvailable = Number(profile?.credits || 0);
  if (creditsAvailable < credits) {
    throw new FlowtubeError(402, `Solde insuffisant: ${credits} credits requis, ${creditsAvailable} disponibles.`, {
      code: "INSUFFICIENT_AGENT_CREDITS",
      creditsRequired: credits,
      creditsAvailable,
      modelId,
    });
  }
  const nextCredits = Math.max(0, creditsAvailable - credits);
  const { data: updated, error: updateError } = await billing.supabase.from("profiles")
    .update({ credits: nextCredits })
    .eq("id", billing.userId)
    .gte("credits", credits)
    .select("credits,credits_max")
    .maybeSingle();
  if (updateError || !updated) {
    throw new FlowtubeError(402, "Solde de credits insuffisant pour continuer.", {
      code: "INSUFFICIENT_AGENT_CREDITS",
      creditsRequired: credits,
      creditsAvailable,
      modelId,
    });
  }
  const balanceAfter = Number(updated.credits || nextCredits);
  const agentMarginMultiplier = agentMarginMultiplierForModel(modelId);
  await billing.supabase.from("credit_transactions").insert({
    user_id: billing.userId,
    amount: -credits,
    reason: "agent_message",
    balance_after: balanceAfter,
    metadata: { ...metadata, idempotency_key: idempotencyKey },
  });
  await billing.supabase.from("pricing_audit_logs").insert({
    user_id: billing.userId,
    credits_charged: credits,
    credit_floor_usd: CREDIT_FLOOR_USD,
    retail_credit_usd: RETAIL_CREDIT_USD,
    provider_cost_usd: usagePricing.providerCostUsd,
    infrastructure_cost_usd: usagePricing.infrastructureCostUsd,
    protected_cost_usd: usagePricing.protectedCostUsd,
    payment_reserve_ratio: PAYMENT_RESERVE_RATIO,
    risk_reserve_ratio: RISK_RESERVE_RATIO,
    status: "completed",
    metadata: {
      kind: "agent_message",
      provider: isOpenRouterAgentModel(modelId) ? "openrouter" : "anthropic",
      model_id: modelId,
      credit_rate_label: rate.label,
      cost_class: rate.margin,
      reason: billing.reason,
      margin_multiplier: agentMarginMultiplier,
      input_tokens: usagePricing.inputTokens,
      output_tokens: usagePricing.outputTokens,
      infrastructure_cost_usd: usagePricing.infrastructureCostUsd,
      protected_cost_usd: usagePricing.protectedCostUsd,
      billing_mode: usage ? "actual_tokens" : "estimated_tokens",
    },
  });
  if (billing.send) billing.send("credits", { credits: balanceAfter, creditsMax: Number(updated.credits_max || profile?.credits_max || 100) });
  return { charged: credits, balance: balanceAfter };
}

function agentBilling(ctx: Omit<AgentBillingContext, "reason" | "idempotencyKey">, reason: string, multiplier = 1, idempotencyKey?: string): AgentBillingContext {
  return { ...ctx, reason, multiplier, idempotencyKey };
}

function openRouterContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content || "");
  return content.map((part) => {
    if (!part || typeof part !== "object") return part;
    const item = part as Record<string, unknown>;
    if (item.type === "text") return { type: "text", text: String(item.text || "") };
    if (item.type === "image" && item.source && typeof item.source === "object") {
      const source = item.source as Record<string, unknown>;
      if (source.type === "url" && source.url) return { type: "image_url", image_url: { url: String(source.url) } };
      if (source.type === "base64" && source.data) return { type: "image_url", image_url: { url: `data:${String(source.media_type || "image/png")};base64,${String(source.data)}` } };
    }
    return { type: "text", text: String(item.text || "") };
  }).filter(Boolean);
}

function openRouterTools(tools: unknown) {
  if (!Array.isArray(tools)) return undefined;
  return tools.map((tool) => {
    const item = tool as Record<string, unknown>;
    return {
      type: "function",
      function: {
        name: String(item.name || "tool"),
        description: String(item.description || ""),
        parameters: item.input_schema || item.parameters || { type: "object", properties: {} },
      },
    };
  });
}

function openRouterPayload(payload: Record<string, unknown>, modelId: string) {
  const sourceMessages = Array.isArray(payload.messages) ? payload.messages : [];
  const messages = sourceMessages.map((message) => {
    const item = message as Record<string, unknown>;
    return {
      role: String(item.role || "user"),
      content: openRouterContent(item.content),
      ...(item.name ? { name: String(item.name) } : {}),
      ...(item.tool_call_id ? { tool_call_id: String(item.tool_call_id) } : {}),
      ...(item.tool_calls ? { tool_calls: item.tool_calls } : {}),
    };
  });
  if (payload.system) messages.unshift({ role: "system", content: openRouterContent(payload.system) });
  const request: Record<string, unknown> = {
    model: modelId,
    messages,
    max_tokens: Number(payload.max_tokens || 1200),
    stream: Boolean(payload.stream),
  };
  for (const key of ["temperature", "top_p", "presence_penalty", "frequency_penalty", "seed"]) {
    if (payload[key] !== undefined) request[key] = payload[key];
  }
  const tools = openRouterTools(payload.tools);
  if (tools?.length) request.tools = tools;
  if (payload.tool_choice !== undefined) request.tool_choice = payload.tool_choice;
  const profile = modelCapabilityProfile(modelId);
  if (payload.response_format !== undefined && profile?.capabilities.includes("structured_output")) request.response_format = payload.response_format;
  if (payload.reasoning !== undefined && profile?.capabilities.includes("reasoning")) request.reasoning = payload.reasoning;
  if (payload.parallel_tool_calls !== undefined && profile?.capabilities.includes("parallel_tools")) request.parallel_tool_calls = payload.parallel_tool_calls;
  if (request.stream) request.stream_options = { include_usage: true };
  return request;
}

function openRouterUsage(value: unknown): AgentUsage {
  const usage = (value || {}) as Record<string, unknown>;
  return {
    inputTokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    outputTokens: Number(usage.completion_tokens || usage.output_tokens || 0),
  };
}

function openRouterAnthropicResponse(body: Record<string, unknown>) {
  const choice = ((body.choices as unknown[]) || [])[0] as Record<string, unknown> | undefined;
  const message = (choice?.message || {}) as Record<string, unknown>;
  const content: Array<Record<string, unknown>> = [];
  if (typeof message.content === "string" && message.content) content.push({ type: "text", text: message.content });
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  for (const call of toolCalls) {
    const item = call as Record<string, unknown>;
    const fn = (item.function || {}) as Record<string, unknown>;
    let input: unknown = {};
    try { input = JSON.parse(String(fn.arguments || "{}")); } catch (_error) { input = { raw: String(fn.arguments || "") }; }
    content.push({ type: "tool_use", id: String(item.id || crypto.randomUUID()), name: String(fn.name || "tool"), input });
  }
  const finishReason = String(choice?.finish_reason || "stop");
  return {
    id: String(body.id || crypto.randomUUID()),
    type: "message",
    role: "assistant",
    model: "selected",
    content,
    stop_reason: finishReason === "tool_calls" ? "tool_use" : "end_turn",
    stop_sequence: null,
    usage: openRouterUsage(body.usage),
  };
}

function openRouterStreamResponse(raw: string, modelId: string) {
  const textParts: string[] = [];
  const toolCalls = new Map<number, { id: string; name: string; args: string }>();
  let usage: AgentUsage = {};
  for (const block of raw.split(/\r?\n\r?\n/)) {
    const dataLines = block.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (!dataLines.length) continue;
    const value = dataLines.join("\n").trim();
    if (!value || value === "[DONE]") continue;
    try {
      const event = JSON.parse(value) as Record<string, unknown>;
      if (event.usage) usage = openRouterUsage(event.usage);
      const choice = ((event.choices as unknown[]) || [])[0] as Record<string, unknown> | undefined;
      const delta = (choice?.delta || {}) as Record<string, unknown>;
      if (typeof delta.content === "string" && delta.content) textParts.push(delta.content);
      const deltas = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
      for (const rawCall of deltas) {
        const call = rawCall as Record<string, unknown>;
        const index = Number(call.index || 0);
        const current = toolCalls.get(index) || { id: String(call.id || crypto.randomUUID()), name: "", args: "" };
        const fn = (call.function || {}) as Record<string, unknown>;
        current.name += String(fn.name || "");
        current.args += String(fn.arguments || "");
        if (call.id) current.id = String(call.id);
        toolCalls.set(index, current);
      }
    } catch (_error) { /* fragment provider ignore */ }
  }
  const encoder = new TextEncoder();
  const chunks: string[] = [
    `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: crypto.randomUUID(), type: "message", role: "assistant", content: [], model: "selected" } })}\n\n`,
  ];
  let blockIndex = 0;
  if (textParts.length) {
    chunks.push(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: blockIndex, content_block: { type: "text", text: "" } })}\n\n`);
    for (const text of textParts) chunks.push(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: blockIndex, delta: { type: "text_delta", text } })}\n\n`);
    chunks.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: blockIndex })}\n\n`);
    blockIndex += 1;
  }
  for (const call of toolCalls.values()) {
    chunks.push(`event: content_block_start\ndata: ${JSON.stringify({ type: "content_block_start", index: blockIndex, content_block: { type: "tool_use", id: call.id, name: call.name, input: {} } })}\n\n`);
    if (call.args) chunks.push(`event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: blockIndex, delta: { type: "input_json_delta", partial_json: call.args } })}\n\n`);
    chunks.push(`event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: blockIndex })}\n\n`);
    blockIndex += 1;
  }
  chunks.push(`event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: toolCalls.size ? "tool_use" : "end_turn" }, usage })}\n\n`);
  chunks.push(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`);
  return { response: new Response(chunks.join(""), { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8" } }), usage };
}

function openRouterLiveStreamResponse(body: ReadableStream<Uint8Array>, modelId: string, billing?: AgentBillingContext) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const reader = body.getReader();
      let buffer = "";
      let blockIndex = 0;
      let textBlockOpen = false;
      let finished = false;
      let providerFinished = false;
      let billingPromise: Promise<unknown> | null = null;
      const toolBlocks = new Map<number, { blockIndex: number; id: string }>();
      let usage: AgentUsage = {};
      const emit = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      };
      emit("message_start", { type: "message_start", message: { id: crypto.randomUUID(), type: "message", role: "assistant", content: [], model: "selected" } });

      const handleData = (value: string) => {
        const trimmed = value.trim();
        if (!trimmed || trimmed === "[DONE]" || finished) return;
        try {
          const event = JSON.parse(trimmed) as Record<string, unknown>;
          if (event.usage) usage = openRouterUsage(event.usage);
          if (providerFinished) return;
          const choice = ((event.choices as unknown[]) || [])[0] as Record<string, unknown> | undefined;
          const delta = (choice?.delta || {}) as Record<string, unknown>;
          const content = typeof delta.content === "string" ? delta.content : "";
          if (content) {
            if (!textBlockOpen) {
              textBlockOpen = true;
              emit("content_block_start", { type: "content_block_start", index: blockIndex, content_block: { type: "text", text: "" } });
            }
            emit("content_block_delta", { type: "content_block_delta", index: blockIndex, delta: { type: "text_delta", text: content } });
          }
          const deltas = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
          for (const rawCall of deltas) {
            const call = rawCall as Record<string, unknown>;
            const index = Number(call.index || 0);
            const fn = (call.function || {}) as Record<string, unknown>;
            let tool = toolBlocks.get(index);
            if (!tool) {
              tool = { blockIndex: blockIndex + (textBlockOpen ? 1 : 0) + toolBlocks.size, id: String(call.id || crypto.randomUUID()) };
              toolBlocks.set(index, tool);
              emit("content_block_start", { type: "content_block_start", index: tool.blockIndex, content_block: { type: "tool_use", id: tool.id, name: String(fn.name || "tool"), input: {} } });
            }
            const partial = String(fn.arguments || "");
            if (partial) emit("content_block_delta", { type: "content_block_delta", index: tool.blockIndex, delta: { type: "input_json_delta", partial_json: partial } });
          }
          if (choice?.finish_reason === "stop" || choice?.finish_reason === "tool_calls") providerFinished = true;
        } catch (_error) {
          // Les fragments ou evenements inconnus du fournisseur sont ignores sans exposer de details internes.
        }
      };

      const pump = async () => {
        try {
          while (!finished) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buffer += decoder.decode(chunk.value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() || "";
            for (const frame of frames) {
              const data = frame.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
              handleData(data);
            }
          }
          buffer += decoder.decode();
          if (buffer.trim() && !finished) {
            const data = buffer.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
            handleData(data);
          }
          if (!finished) {
            finished = true;
            if (textBlockOpen) emit("content_block_stop", { type: "content_block_stop", index: blockIndex });
            for (const tool of toolBlocks.values()) emit("content_block_stop", { type: "content_block_stop", index: tool.blockIndex });
            emit("message_delta", { type: "message_delta", delta: { stop_reason: toolBlocks.size ? "tool_use" : "end_turn" }, usage });
            emit("message_stop", { type: "message_stop" });
            billingPromise = chargeAgentCredits(billing, modelId, usage);
          }
          if (billingPromise) await billingPromise;
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      };
      void pump();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}

function anthropicStreamUsage(raw: string): AgentUsage {
  let usage: AgentUsage = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    try {
      const event = JSON.parse(line.slice(5).trim()) as Record<string, unknown>;
      if (event.usage) usage = openRouterUsage(event.usage);
      if (event.message && typeof event.message === "object") {
        const message = event.message as Record<string, unknown>;
        if (message.usage) usage = openRouterUsage(message.usage);
      }
    } catch (_error) { /* frame partial ou ping */ }
  }
  return usage;
}

async function openRouterMessages(payload: Record<string, unknown>, preferredModel: string, billing?: AgentBillingContext) {
  const model = resolveAgentModelId(preferredModel);
  if (isBatchModel(internalModelId(preferredModel))) {
    throw new FlowtubeError(400, "Ce mode est reserve aux traitements en lot.", { code: "BATCH_MODEL_NOT_INTERACTIVE" });
  }
  if (!OPENROUTER_AGENT_ENABLED || !OPENROUTER_API_KEY) {
    throw new FlowtubeError(503, "Le modele selectionne est momentanement indisponible.", { code: "MODEL_NOT_CONFIGURED", modelId: model });
  }
  assertAgentCapability(model, "text");
  if (payload.stream) assertAgentCapability(model, "streaming");
  const hasImageContent = JSON.stringify(payload.messages || []).includes('"image_url"');
  if (hasImageContent) assertAgentCapability(model, "vision");
  if (Array.isArray(payload.tools) && payload.tools.length) assertAgentCapability(model, "tools");
  if (payload.response_format !== undefined || payload.structured_output || payload.structuredOutput) assertAgentCapability(model, "structured_output");
  if (payload.reasoning !== undefined || payload.reasoning_effort !== undefined) assertAgentCapability(model, "reasoning");
  if (payload.parallel_tool_calls === true) assertAgentCapability(model, "parallel_tools");
  await refreshOpenRouterPrice(model);
  await ensureAgentCreditsAvailable(billing, model, estimatedAgentCreditsForPayload(model, payload, billing?.multiplier));
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": APP_BASE_URL,
      "X-Title": APP_NAME,
    },
    body: JSON.stringify(openRouterPayload(payload, model)),
  });
  if (!response.ok) {
    const raw = await response.text();
    const providerStatus = response.status;
    const status = [401, 402, 429].includes(providerStatus) || providerStatus >= 500 ? providerStatus : 502;
    const code = providerStatus === 401 ? "OPENROUTER_UNAUTHORIZED" : providerStatus === 402 ? "OPENROUTER_PAYMENT_REQUIRED" : providerStatus === 429 ? "OPENROUTER_RATE_LIMITED" : "OPENROUTER_ERROR";
    throw new FlowtubeError(status, providerStatus === 402 ? "Cette generation ne peut pas etre lancee pour le moment." : "Le modele selectionne n'est pas disponible pour le moment.", { code, modelId: model, providerStatus });
  }
  if (Boolean(payload.stream)) {
    if (!response.body) throw new FlowtubeError(502, "La reponse du modele est indisponible.", { code: "EMPTY_MODEL_STREAM" });
    return { response: openRouterLiveStreamResponse(response.body, model, billing), model };
  }
  const raw = await response.text();
  const normalized = openRouterAnthropicResponse(JSON.parse(raw) as Record<string, unknown>);
  await chargeAgentCredits(billing, model, normalized.usage);
  return { response: new Response(JSON.stringify(normalized), { status: 200, headers: { "Content-Type": "application/json" } }), model };
}

async function anthropicMessages(payload: Record<string, unknown>, preferredModel?: string, billing?: AgentBillingContext) {
  const requestedModel = resolveAgentModelId(preferredModel);
  if (isOpenRouterAgentModel(requestedModel)) {
    let lastError: unknown;
    for (const model of agentModelFallbacks(requestedModel)) {
      try {
        return await openRouterMessages(payload, model, billing);
      } catch (err) {
        lastError = err;
        if (!(err instanceof FlowtubeError) || !shouldFallbackAnthropic(Number(err.payload?.providerStatus || err.status || 0))) throw err;
      }
    }
    throw lastError instanceof Error ? lastError : new FlowtubeError(503, "Le service de réponse est momentanément indisponible.", { code: "NO_COMPATIBLE_MODEL" });
  }
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY missing");
  let lastStatus = 0;
  let lastText = "";
  const models = agentModelFallbacks(preferredModel);
  for (const model of models) {
    await ensureAgentCreditsAvailable(billing, model, estimatedAgentCreditsForPayload(model, payload, billing?.multiplier));
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ ...payload, model }),
    });
    if (response.ok) {
      const raw = await response.text();
      let usage: AgentUsage | undefined;
      if (Boolean(payload.stream)) {
        usage = anthropicStreamUsage(raw);
      } else {
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const rawUsage = (parsed.usage || {}) as Record<string, unknown>;
          usage = {
            inputTokens: Number(rawUsage.input_tokens || 0),
            outputTokens: Number(rawUsage.output_tokens || 0),
          };
        } catch (_err) {
          usage = undefined;
        }
      }
      await chargeAgentCredits(billing, model, usage);
      return {
        response: new Response(raw, { status: response.status, headers: Boolean(payload.stream) ? { "Content-Type": "text/event-stream; charset=utf-8" } : response.headers }),
        model,
      };
    }
    lastStatus = response.status;
    lastText = await response.text().catch(() => "");
    if (!shouldFallbackAnthropic(response.status)) break;
  }
  throw new Error(`anthropic ${lastStatus}${lastText ? `: ${lastText.slice(0, 300)}` : ""}`);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flowtube-secret, x-huggyflow-secret, x-flowtube-admin-secret, x-huggyflow-admin-secret, stripe-signature, x-moneyfusion-secret, x-moneyfusion-signature, x-wh-secret, x-fapshi-secret, x-flowtube-provider-secret, x-fal-webhook-secret",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

type PricingModel = {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
  provider?: "fal" | "openrouter";
  pricingUnit: "unit" | "second" | "thousand_chars";
  costPerUnitUsd: number;
  defaultUnits: number;
  minimumUnits: number;
  maximumUnits?: number;
  creditFloorUsd: number;
  retailCreditUsd: number;
  marginMultiplier: number;
  requiresConfirmation: boolean;
  premium: boolean;
  metadata: Record<string, unknown>;
};

type ModelOverride = Partial<PricingModel> & {
  label?: string;
  capabilities?: string[];
  qualityTier?: string;
  inputProfile?: string;
  family?: string;
};

type PricingQuote = {
  credits: number;
  units: number;
  providerCostUsd: number;
  infrastructureCostUsd: number;
  protectedCostUsd: number;
  revenueFloorUsd: number;
  revenueRetailUsd: number;
  grossMarginFloorUsd: number;
  grossMarginRetailUsd: number;
  grossMarginFloorRatio: number;
  grossMarginRetailRatio: number;
  minimumMarginRatio: number;
  marginMultiplier: number;
  profitable: boolean;
  requiresConfirmation: boolean;
};

type PlanLimits = {
  id: string;
  displayName: string;
  includedCredits: number;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  monthlyPriceXof: number;
  annualPriceXof: number;
  pricingVersion: string;
  monthlyMessageLimit: number;
  dailyMessageLimit: number;
  dailyImageLimit: number;
  dailyVideoLimit: number;
  concurrentImageJobs: number;
  concurrentVideoJobs: number;
  allowedMediaTypes: string[];
  watermarkRequired: boolean;
  mediaRetentionDays: number;
  storageGb: number;
  maxUploadMb: number;
  seatLimit: number;
  supportLevel: string;
  priorityQueue: boolean;
  stripeMonthlyPriceId?: string;
  stripeAnnualPriceId?: string;
  metadata: Record<string, unknown>;
};

class FlowtubeError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.payload = { error: { message }, ...payload };
  }
}

function publicErrorMessage(message: string, fallback = "Action indisponible pour le moment. Reessaie dans quelques instants.") {
  const raw = String(message || "").trim();
  if (!raw) return fallback;
  if (/fal\.ai|fal-ai|openrouter|endpoint|provider|fournisseur|FAL_KEY|OPENROUTER_API_KEY|anthropic|supabase|service key|api key|secret|server|internal|configuration|variable|stack trace/i.test(raw)) {
    return fallback;
  }
  return raw;
}

function publicErrorPayload(err: FlowtubeError) {
  const payload: Record<string, unknown> = {
    error: {
      ...((err.payload.error as Record<string, unknown>) || {}),
      message: publicErrorMessage(err.message),
    },
  };
  const publicCodes = new Set([
    "INSUFFICIENT_AGENT_CREDITS",
    "INSUFFICIENT_CREDITS",
    "CONFIRMATION_REQUIRED",
    "MARGIN_GUARD",
    "RATE_LIMITED",
    "BATCH_LIMIT_REACHED",
    "MEDIA_CONSENT_REQUIRED",
    "STREAM_INTERRUPTED",
  ]);
  for (const key of ["code", "creditsRequired", "creditsAvailable", "requiresConfirmation", "requiresConsent", "partial", "planId", "packId"]) {
    if (key === "code" && !publicCodes.has(String(err.payload[key] || ""))) continue;
    if (err.payload[key] !== undefined) payload[key] = err.payload[key];
  }
  return payload;
}

const FAL_ENDPOINTS = [
  "bytedance/seedance-2.0/image-to-video",
  "bytedance/seedance-2.0/reference-to-video",
  "bytedance/seedance-2.0/text-to-video",
  "bytedance/seedance-2.5/image-to-video",
  "bytedance/seedance-2.5/reference-to-video",
  "bytedance/seedance-2.5/text-to-video",
  "bytedance/seedream/v5/pro/text-to-image",
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/4k/image-to-video",
  "fal-ai/kling-video/v3/4k/text-to-video",
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/image-to-video",
  "fal-ai/veo3.1/first-last-frame-to-video",
  "fal-ai/veo3.1/reference-to-video",
  "fal-ai/veo3.1/fast",
  "fal-ai/veo3.1/fast/image-to-video",
  "fal-ai/veo3.1/fast/first-last-frame-to-video",
  "fal-ai/veo3.1/extend-video",
  "fal-ai/veo3.1/fast/extend-video",
  "fal-ai/nano-banana-pro/edit",
  "fal-ai/nano-banana-pro",
  "openai/gpt-image-2/edit",
  "openai/gpt-image-2",
  "fal-ai/flux-2-pro",
  "fal-ai/flux-2-pro/edit",
  "fal-ai/recraft/v3/text-to-image",
  "fal-ai/recraft/v3/image-to-image",
  "fal-ai/elevenlabs/tts/eleven-v3",
  "fal-ai/elevenlabs/tts/turbo-v2.5",
  "fal-ai/elevenlabs/tts/multilingual-v2",
  "fal-ai/elevenlabs/text-to-dialogue/eleven-v3",
  "fal-ai/elevenlabs/music",
  "fal-ai/elevenlabs/speech-to-text/scribe-v2",
  "fal-ai/elevenlabs/voice-changer",
  "fal-ai/elevenlabs/dubbing",
  "google/gemini-omni-flash",
  "google/gemini-omni-flash/image-to-video",
  "google/gemini-omni-flash/edit",
  "google/gemini-omni-flash/reference-to-video",
  "fal-ai/sora-2/text-to-video",
  "fal-ai/sora-2/text-to-video/pro",
  "fal-ai/sora-2/image-to-video",
  "fal-ai/sora-2/video-to-video/remix",
  "fal-ai/topaz/upscale/image",
  "fal-ai/topaz/upscale/video",
];

const FAL_ENDPOINT_OVERRIDES: Record<string, ModelOverride> = {
  "fal-ai/nano-banana-pro/edit": { id: "nano-pro-edit", label: "Nano Banana Pro Edit", costPerUnitUsd: 0.15, qualityTier: "premium", metadata: { huggyflow_family: "nano-banana-pro" } },
  "fal-ai/nano-banana-pro": { id: "nano", label: "Nano Banana Pro", costPerUnitUsd: 0.15, qualityTier: "premium", metadata: { huggyflow_family: "nano-banana-pro" } },
  "fal-ai/nano-banana-2": { id: "nano2", label: "Nano Banana 2", costPerUnitUsd: 0.08, qualityTier: "premium" },
  "fal-ai/nano-banana-2/edit": { id: "nano2-edit", label: "Nano Banana 2 Edit", costPerUnitUsd: 0.08, qualityTier: "premium" },
  "fal-ai/flux/schnell": { id: "flux", label: "Flux Schnell", costPerUnitUsd: 0.04, qualityTier: "standard" },
  "fal-ai/bytedance/seedream/v4.5/edit": { id: "seedream-45-edit", label: "Seedream 4.5 Edit", costPerUnitUsd: 0.04, qualityTier: "standard" },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": { id: "seedream-45", label: "Seedream 4.5", costPerUnitUsd: 0.04, qualityTier: "standard" },
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": { id: "seedream-lite", label: "Seedream 5.0 Lite", costPerUnitUsd: 0.04, qualityTier: "economy" },
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": { id: "kling", label: "Kling 2.5 Turbo Pro", costPerUnitUsd: 0.12, qualityTier: "premium", maximumUnits: 15 },
  "fal-ai/bytedance/seedance/v1/lite/text-to-video": { id: "seedance", label: "Seedance 1.0 Lite", costPerUnitUsd: 0.08, qualityTier: "standard", maximumUnits: 15 },
  "fal-ai/veo3": { id: "veoq", label: "Veo 3.1 Quality", costPerUnitUsd: 0.4, qualityTier: "premium", maximumUnits: 8 },
  "fal-ai/veo3/fast": { id: "veol", label: "Veo 3.1 Fast", costPerUnitUsd: 0.15, qualityTier: "standard", maximumUnits: 8 },
  "fal-ai/veo3.1": { id: "veo31", label: "Veo 3.1", costPerUnitUsd: 0.4, pricingUnit: "second", qualityTier: "premium", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1" } },
  "fal-ai/veo3.1/image-to-video": { id: "veo31-i2v", label: "Veo 3.1 I2V", costPerUnitUsd: 0.4, pricingUnit: "second", qualityTier: "premium", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1" } },
  "fal-ai/veo3.1/first-last-frame-to-video": { id: "veo31-first-last", label: "Veo 3.1 First/Last Frame", costPerUnitUsd: 0.4, pricingUnit: "second", qualityTier: "premium", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1" } },
  "fal-ai/veo3.1/reference-to-video": { id: "veo31-reference", label: "Veo 3.1 Reference", costPerUnitUsd: 0.4, pricingUnit: "second", qualityTier: "premium", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1", reference_lock: true } },
  "fal-ai/veo3.1/fast": { id: "veo31-fast", label: "Veo 3.1 Fast", costPerUnitUsd: 0.15, pricingUnit: "second", qualityTier: "standard", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1" } },
  "fal-ai/veo3.1/fast/image-to-video": { id: "veo31-fast-i2v", label: "Veo 3.1 Fast I2V", costPerUnitUsd: 0.15, pricingUnit: "second", qualityTier: "standard", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1" } },
  "fal-ai/veo3.1/fast/first-last-frame-to-video": { id: "veo31-fast-first-last", label: "Veo 3.1 Fast First/Last Frame", costPerUnitUsd: 0.15, pricingUnit: "second", qualityTier: "standard", maximumUnits: 8, metadata: { huggyflow_family: "veo-3.1" } },
  "openai/gpt-image-2/edit": { id: "gpt-image-2-edit", label: "GPT Image 2 Edit", costPerUnitUsd: 0.219, qualityTier: "premium", metadata: { default_quality: "high", pricing_source: "fal.ai high 1024x1024 edit", huggyflow_family: "gpt-image-2" } },
  "openai/gpt-image-2": { id: "gpt-image-2", label: "GPT Image 2", costPerUnitUsd: 0.211, qualityTier: "premium", metadata: { default_quality: "high", pricing_source: "fal.ai high 1024x1024", huggyflow_family: "gpt-image-2" } },
  "fal-ai/recraft/v3/text-to-image": { id: "recraft-v3", label: "Recraft V3", costPerUnitUsd: 0.04, qualityTier: "premium", metadata: { huggyflow_family: "recraft-v3", vector_and_brand_style: true } },
  "fal-ai/recraft/v3/image-to-image": { id: "recraft-v3-edit", label: "Recraft V3 Edit", costPerUnitUsd: 0.04, qualityTier: "premium", metadata: { huggyflow_family: "recraft-v3", vector_and_brand_style: true } },
  "fal-ai/elevenlabs/tts/eleven-v3": { id: "eleven-v3-tts", label: "ElevenLabs Eleven V3", costPerUnitUsd: 0.1, pricingUnit: "thousand_chars", defaultUnits: 1, minimumUnits: 1, maximumUnits: 20, qualityTier: "premium", metadata: { huggyflow_family: "elevenlabs-v3" } },
  "fal-ai/elevenlabs/tts/turbo-v2.5": { id: "eleven-turbo-v25", label: "ElevenLabs Turbo v2.5", costPerUnitUsd: 0.05, pricingUnit: "thousand_chars", defaultUnits: 1, minimumUnits: 1, maximumUnits: 20, qualityTier: "standard", metadata: { huggyflow_family: "elevenlabs-v3" } },
  "fal-ai/elevenlabs/tts/multilingual-v2": { id: "eleven-multilingual-v2", label: "ElevenLabs Multilingual v2", costPerUnitUsd: 0.1, pricingUnit: "thousand_chars", defaultUnits: 1, minimumUnits: 1, maximumUnits: 20, qualityTier: "premium", metadata: { huggyflow_family: "elevenlabs-v3" } },
  "fal-ai/elevenlabs/speech-to-text/scribe-v2": { id: "eleven-scribe-v2", label: "ElevenLabs Scribe V2", costPerUnitUsd: 0.01, pricingUnit: "second", defaultUnits: 60, minimumUnits: 1, maximumUnits: 3600, qualityTier: "premium", metadata: { huggyflow_family: "elevenlabs-v3" } },
  "fal-ai/gemini-3.1-flash-image-preview": { id: "gemini-flash-image", label: "Gemini 3.1 Flash Image", costPerUnitUsd: 0.08, qualityTier: "standard" },
  "fal-ai/gemini-3.1-flash-image-preview/edit": { id: "gemini-flash-image-edit", label: "Gemini 3.1 Flash Image Edit", costPerUnitUsd: 0.08, qualityTier: "standard" },
  "fal-ai/minimax/speech-2.8-hd": { id: "minimax-tts", label: "MiniMax Speech 2.8 HD", costPerUnitUsd: 0.1, pricingUnit: "thousand_chars", maximumUnits: 20, qualityTier: "premium" },
  "fal-ai/minimax/speech-2.8-turbo": { id: "minimax-tts-turbo", label: "MiniMax Speech 2.8 Turbo", costPerUnitUsd: 0.06, pricingUnit: "thousand_chars", maximumUnits: 20, qualityTier: "standard" },
  "fal-ai/minimax/voice-clone": { id: "minimax-voice-clone", label: "MiniMax Voice Clone", costPerUnitUsd: 1.5, qualityTier: "premium", maximumUnits: 1 },
  "fal-ai/gemini-3.1-flash-tts": { id: "gemini-flash-tts", label: "Gemini 3.1 Flash TTS", costPerUnitUsd: 0.15, pricingUnit: "thousand_chars", maximumUnits: 20, qualityTier: "standard" },
  "fal-ai/lyria3/pro": { id: "lyria3-pro", label: "Lyria 3 Pro", costPerUnitUsd: 0.08, pricingUnit: "unit", defaultUnits: 1, minimumUnits: 1, maximumUnits: 1, qualityTier: "premium" },
  "sonilo/v1.1/text-to-music": { id: "sonilo-music", label: "Sonilo 1.1 Music", costPerUnitUsd: 0.08, pricingUnit: "second", defaultUnits: 30, minimumUnits: 10, maximumUnits: 120, qualityTier: "standard" },
  "alibaba/happy-horse/v1.1/image-to-video": { label: "Happy Horse I2V", costPerUnitUsd: 0.18, pricingUnit: "second", qualityTier: "premium" },
  "alibaba/happy-horse/v1.1/reference-to-video": { label: "Happy Horse Reference", costPerUnitUsd: 0.18, pricingUnit: "second", qualityTier: "premium" },
  "alibaba/happy-horse/v1.1/text-to-video": { label: "Happy Horse T2V", costPerUnitUsd: 0.18, pricingUnit: "second", qualityTier: "premium" },
  "bytedance/seedance-2.0/image-to-video": { label: "Seedance 2 I2V", costPerUnitUsd: 0.3034, pricingUnit: "second", qualityTier: "premium" },
  "bytedance/seedance-2.0/reference-to-video": { label: "Seedance 2 Reference", costPerUnitUsd: 0.3034, pricingUnit: "second", qualityTier: "premium" },
  "bytedance/seedance-2.0/text-to-video": { label: "Seedance 2 T2V", costPerUnitUsd: 0.3034, pricingUnit: "second", qualityTier: "premium" },
  "bytedance/seedance-2.0/fast/image-to-video": { label: "Seedance 2 Fast I2V", costPerUnitUsd: 0.2419, pricingUnit: "second", qualityTier: "standard" },
  "bytedance/seedance-2.0/fast/reference-to-video": { label: "Seedance 2 Fast Reference", costPerUnitUsd: 0.2419, pricingUnit: "second", qualityTier: "standard" },
  "bytedance/seedance-2.0/fast/text-to-video": { label: "Seedance 2 Fast T2V", costPerUnitUsd: 0.2419, pricingUnit: "second", qualityTier: "standard" },
  "bytedance/seedance-2.0/mini/image-to-video": { label: "Seedance 2 Mini I2V", costPerUnitUsd: 0.0721, pricingUnit: "second", qualityTier: "economy" },
  "bytedance/seedance-2.0/mini/reference-to-video": { label: "Seedance 2 Mini Reference", costPerUnitUsd: 0.0928, pricingUnit: "second", qualityTier: "economy" },
  "bytedance/seedance-2.0/mini/text-to-video": { label: "Seedance 2 Mini T2V", costPerUnitUsd: 0.0721, pricingUnit: "second", qualityTier: "economy" },
  "bytedance/seedance-2.5/image-to-video": { label: "Seedance 2.5 I2V", costPerUnitUsd: 0.473, pricingUnit: "second", qualityTier: "premium", maximumUnits: 30, metadata: { huggyflow_family: "seedance-2.5", pricing_source: "fal_public_720p_ceiling" } },
  "bytedance/seedance-2.5/reference-to-video": { label: "Seedance 2.5 Reference", costPerUnitUsd: 0.473, pricingUnit: "second", qualityTier: "premium", maximumUnits: 30, metadata: { huggyflow_family: "seedance-2.5", pricing_source: "fal_public_720p_ceiling", reference_lock: true } },
  "bytedance/seedance-2.5/text-to-video": { label: "Seedance 2.5 T2V", costPerUnitUsd: 0.473, pricingUnit: "second", qualityTier: "premium", maximumUnits: 30, metadata: { huggyflow_family: "seedance-2.5", pricing_source: "fal_public_720p_ceiling" } },
  "bytedance/seedream/v5/pro/text-to-image": { label: "Seedream 5.0", costPerUnitUsd: 0.08, pricingUnit: "unit", qualityTier: "premium", maximumUnits: 1, metadata: { huggyflow_family: "seedream-5.0", pricing_source: "fal_public_catalog_conservative" } },
  "fal-ai/kling-video/v3/4k/image-to-video": { label: "Kling 3 4K I2V", costPerUnitUsd: 0.42, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/kling-video/v3/4k/text-to-video": { label: "Kling 3 4K T2V", costPerUnitUsd: 0.42, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/kling-video/v3/pro/image-to-video": { label: "Kling 3 Pro I2V", costPerUnitUsd: 0.168, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/kling-video/v3/pro/text-to-video": { label: "Kling 3 Pro T2V", costPerUnitUsd: 0.168, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/kling-video/v3/standard/image-to-video": { label: "Kling 3 Standard I2V", costPerUnitUsd: 0.126, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/kling-video/v3/standard/text-to-video": { label: "Kling 3 Standard T2V", costPerUnitUsd: 0.126, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/veo3.1/extend-video": { label: "Veo 3.1 Extend", costPerUnitUsd: 0.4, pricingUnit: "second", qualityTier: "premium", maximumUnits: 8 },
  "fal-ai/veo3.1/fast/extend-video": { label: "Veo 3.1 Fast Extend", costPerUnitUsd: 0.15, pricingUnit: "second", qualityTier: "standard", maximumUnits: 8 },
  "fal-ai/veo3.1/lite/first-last-frame-to-video": { label: "Veo 3.1 Lite First Last", costPerUnitUsd: 0.05, pricingUnit: "second", qualityTier: "economy", maximumUnits: 8 },
  "fal-ai/veo3.1/lite/image-to-video": { label: "Veo 3.1 Lite I2V", costPerUnitUsd: 0.05, pricingUnit: "second", qualityTier: "economy", maximumUnits: 8 },
  "luma/agent/ray/v3.2/text-to-video": { label: "Ray 3.2 T2V", costPerUnitUsd: 0.2, pricingUnit: "second", qualityTier: "premium" },
  "luma/agent/ray/v3.2/image-to-video": { label: "Ray 3.2 I2V", costPerUnitUsd: 0.06, pricingUnit: "second", qualityTier: "standard" },
  "luma/agent/ray/v3.2/reframe": { label: "Ray 3.2 Reframe", costPerUnitUsd: 0.12, pricingUnit: "second", qualityTier: "standard" },
  "luma/agent/ray/v3.2/video-to-video": { label: "Ray 3.2 Video Remix", costPerUnitUsd: 0.216, pricingUnit: "second", qualityTier: "premium" },
  "xai/grok-imagine-video/v1.5/image-to-video": { label: "Grok Video I2V", costPerUnitUsd: 0.14, pricingUnit: "second", qualityTier: "standard" },
  "xai/grok-imagine-video/reference-to-video": { label: "Grok Video Reference", costPerUnitUsd: 0.07, pricingUnit: "second", qualityTier: "standard" },
  "xai/grok-imagine-video/extend-video": { label: "Grok Video Extend", costPerUnitUsd: 0.08, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/pixverse/v6/image-to-video": { label: "PixVerse 6 I2V", costPerUnitUsd: 0.06, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/creatify/aurora": { label: "Creatify Aurora", costPerUnitUsd: 0.14, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/bytedance/omnihuman/v1.5": { label: "OmniHuman 1.5", costPerUnitUsd: 0.16, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/heygen/avatar3/digital-twin": { label: "HeyGen Avatar 3 Twin", costPerUnitUsd: 0.034, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/heygen/avatar4/digital-twin": { label: "HeyGen Avatar 4 Twin", costPerUnitUsd: 0.1, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/heygen/avatar4/image-to-video": { label: "HeyGen Avatar 4 I2V", costPerUnitUsd: 0.1, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/heygen/avatar5/digital-twin": { label: "HeyGen Avatar 5 Twin", costPerUnitUsd: 0.1, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/heygen/v2/translate/precision": { label: "HeyGen Translate Precision", costPerUnitUsd: 0.1, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/heygen/v2/translate/speed": { label: "HeyGen Translate Speed", costPerUnitUsd: 0.05, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/heygen/v2/video-agent": { label: "HeyGen Video Agent 2", costPerUnitUsd: 0.034, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/heygen/v3/lipsync/precision": { label: "HeyGen Lipsync Precision", costPerUnitUsd: 0.1, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/heygen/v3/lipsync/speed": { label: "HeyGen Lipsync Speed", costPerUnitUsd: 0.05, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/heygen/v3/video-agent": { label: "HeyGen Video Agent 3", costPerUnitUsd: 0.034, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/sync-lipsync/v3": { label: "Sync Lipsync 3", costPerUnitUsd: 0.1333, pricingUnit: "second", qualityTier: "premium" },
  "fal-ai/sync-lipsync/v3/image-to-video": { label: "Sync Lipsync 3 I2V", costPerUnitUsd: 0.1333, pricingUnit: "second", qualityTier: "premium" },
  "veed/avatars/audio-to-video": { label: "VEED Avatar Audio", costPerUnitUsd: 0.005, pricingUnit: "second", qualityTier: "economy" },
  "veed/avatars/text-to-video": { label: "VEED Avatar Text", costPerUnitUsd: 0.0059, pricingUnit: "second", qualityTier: "economy" },
  "veed/fabric-1.0": { label: "VEED Fabric", capabilities: ["text-to-video"], costPerUnitUsd: 0.08, pricingUnit: "second", qualityTier: "standard" },
  "veed/fabric-1.0/text": { label: "VEED Fabric Text", capabilities: ["text-to-video"], costPerUnitUsd: 0.08, pricingUnit: "second", qualityTier: "standard" },
  "veed/subtitles": { label: "VEED Subtitles", costPerUnitUsd: 0.0017, pricingUnit: "second", qualityTier: "economy" },
  "veed/video-background-removal": { label: "VEED BG Removal", capabilities: ["video-to-video", "remove-background"], costPerUnitUsd: 0.0225, pricingUnit: "second", qualityTier: "standard" },
  "veed/video-background-removal/fast": { label: "VEED BG Removal Fast", capabilities: ["video-to-video", "remove-background"], costPerUnitUsd: 0.012, pricingUnit: "second", qualityTier: "economy" },
  "veed/video-background-removal/green-screen": { label: "VEED Green Screen", capabilities: ["video-to-video", "remove-background"], costPerUnitUsd: 0.025, pricingUnit: "second", qualityTier: "standard" },
  "fal-ai/elevenlabs/dubbing": { label: "ElevenLabs Dubbing", costPerUnitUsd: 0.015, pricingUnit: "second", defaultUnits: 60, minimumUnits: 1, maximumUnits: 600, qualityTier: "premium" },
  "fal-ai/elevenlabs/music": { label: "ElevenLabs Music", costPerUnitUsd: 0.0134, pricingUnit: "second", defaultUnits: 60, minimumUnits: 1, maximumUnits: 300, qualityTier: "premium" },
  "fal-ai/elevenlabs/text-to-dialogue/eleven-v3": { label: "ElevenLabs Dialogue", costPerUnitUsd: 0.1, pricingUnit: "thousand_chars", defaultUnits: 1, minimumUnits: 1, maximumUnits: 20, qualityTier: "premium" },
  "fal-ai/elevenlabs/voice-changer": { label: "ElevenLabs Voice Changer", costPerUnitUsd: 0.005, pricingUnit: "second", defaultUnits: 60, minimumUnits: 1, maximumUnits: 600, qualityTier: "standard" },
  "fal-ai/bria/background/remove": { label: "Bria Background Remove", costPerUnitUsd: 0.018, qualityTier: "standard" },
  "fal-ai/topaz/upscale/image": { id: "topaz-image-upscale", label: "Topaz Image Upscale", costPerUnitUsd: 0.004, qualityTier: "standard", metadata: { huggyflow_family: "topaz-upscale" } },
  "fal-ai/topaz/upscale/video": { id: "topaz-video-upscale", label: "Topaz Video Upscale", costPerUnitUsd: 0.02, pricingUnit: "second", qualityTier: "standard", metadata: { huggyflow_family: "topaz-upscale" } },
  "fal-ai/sora-2/text-to-video": { id: "sora-2", label: "Sora 2", costPerUnitUsd: 0.1, pricingUnit: "second", maximumUnits: 20, qualityTier: "premium", metadata: { huggyflow_family: "sora-2" } },
  "fal-ai/sora-2/text-to-video/pro": { id: "sora-2-pro", label: "Sora 2 Pro", costPerUnitUsd: 0.2, pricingUnit: "second", maximumUnits: 20, qualityTier: "premium", metadata: { huggyflow_family: "sora-2" } },
  "fal-ai/sora-2/image-to-video": { id: "sora-2-i2v", label: "Sora 2 Image to Video", costPerUnitUsd: 0.1, pricingUnit: "second", maximumUnits: 20, qualityTier: "premium", metadata: { huggyflow_family: "sora-2" } },
  "fal-ai/sora-2/video-to-video/remix": { id: "sora-2-remix", label: "Sora 2 Remix", costPerUnitUsd: 0.1, pricingUnit: "second", maximumUnits: 20, qualityTier: "premium", metadata: { huggyflow_family: "sora-2" } },
  "google/gemini-omni-flash": { id: "gemini-omni-flash", label: "Gemini Omni Flash", type: "video", capabilities: ["text-to-video"], costPerUnitUsd: 0.125, pricingUnit: "second", defaultUnits: 8, minimumUnits: 3, maximumUnits: 10, qualityTier: "premium", metadata: { huggyflow_family: "gemini-omni-flash" } },
  "google/gemini-omni-flash/image-to-video": { id: "gemini-omni-flash-i2v", label: "Gemini Omni Flash I2V", type: "video", capabilities: ["image-to-video"], costPerUnitUsd: 0.13, pricingUnit: "second", defaultUnits: 8, minimumUnits: 3, maximumUnits: 10, qualityTier: "premium", metadata: { huggyflow_family: "gemini-omni-flash" } },
  "google/gemini-omni-flash/edit": { id: "gemini-omni-flash-edit", label: "Gemini Omni Flash Edit", type: "video_edit", capabilities: ["video-to-video", "edit"], costPerUnitUsd: 0.13, pricingUnit: "second", defaultUnits: 8, minimumUnits: 3, maximumUnits: 10, qualityTier: "premium", metadata: { huggyflow_family: "gemini-omni-flash", runway_equivalent: true } },
  "google/gemini-omni-flash/reference-to-video": { id: "gemini-omni-flash-reference", label: "Gemini Omni Flash Reference", type: "video", capabilities: ["reference-to-video"], costPerUnitUsd: 0.13, pricingUnit: "second", defaultUnits: 8, minimumUnits: 3, maximumUnits: 10, qualityTier: "premium", metadata: { huggyflow_family: "gemini-omni-flash", reference_lock: true } },
  "fal-ai/seedvr/upscale/image": { label: "SeedVR Image Upscale", costPerUnitUsd: 0.004, qualityTier: "economy" },
  "xai/grok-imagine-image/edit": { label: "Grok Image Edit", costPerUnitUsd: 0.022, qualityTier: "standard" },
};

function idFromEndpoint(endpoint: string) {
  return endpoint.replace(/^fal-ai\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function labelFromEndpoint(endpoint: string) {
  const clean = endpoint.replace(/^fal-ai\//, "").replace(/\//g, " ");
  return clean.split(/[-_\s]+/).filter(Boolean).map((part) => {
    if (/^(ai|api|tts|hd|v\d+|3d|4k)$/i.test(part)) return part.toUpperCase();
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(" ");
}

function capabilitiesForEndpoint(endpoint: string) {
  const e = endpoint.toLowerCase();
  const caps = new Set<string>();
  if (e.includes("text-to-image") || e.includes("gpt-image") || e.includes("nano-banana") || e.includes("flux") || e.includes("krea") || e.includes("gemini-omni-flash")) caps.add("text-to-image");
  if (e.includes("image-to-image") || e.includes("redux")) caps.add("image-to-image");
  if (e.includes("/edit") || e.includes("fibo-edit") || e.includes("outpaint") || e.includes("background") || e.includes("remove-background")) caps.add("edit");
  if (e.includes("outpaint")) caps.add("outpaint");
  if (e.includes("remove-background") || e.includes("background/remove")) caps.add("remove-background");
  if (e === "fal-ai/veo3" || e === "fal-ai/veo3/fast") caps.add("text-to-video");
  if (e.includes("text-to-video") || e.includes("video-agent") || e.includes("avatars/text-to-video")) caps.add("text-to-video");
  if (e.includes("image-to-video") || e.includes("omnihuman")) caps.add("image-to-video");
  if (e.includes("reference-to-video")) caps.add("reference-to-video");
  if (e.includes("first-last-frame")) caps.add("first-last-frame-to-video");
  if (e.includes("extend-video")) caps.add("extend-video");
  if (e.includes("video-to-video") || e.includes("reframe")) caps.add("video-to-video");
  if (e.includes("upscale/image")) caps.add("image-upscale");
  if (e.includes("upscale/video")) caps.add("video-upscale");
  if (e.includes("lipsync")) caps.add("lipsync");
  if (e.includes("voice-clone") || e.includes("digital-twin")) caps.add("voice-clone");
  if (e.includes("speech") || e.includes("tts") || e.includes("text-to-dialogue")) caps.add("tts");
  if (e.includes("speech-to-text")) caps.add("speech-to-text");
  if (e.includes("music") || e.includes("lyria") || e.includes("text-to-music")) caps.add("music");
  if (e.includes("dubbing") || e.includes("translate")) caps.add("dubbing");
  if (e.includes("voice-changer")) caps.add("voice-change");
  if (e.includes("avatar") || e.includes("heygen") || e.includes("omnihuman")) caps.add("avatar");
  if (e.includes("subtitles")) caps.add("subtitles");
  if (!caps.size) caps.add("text-to-image");
  return Array.from(caps);
}

function mediaTypeForCapabilities(caps: string[]) {
  if (caps.includes("lipsync")) return "lipsync";
  if (caps.includes("voice-clone")) return "voice_clone";
  if (caps.some((cap) => ["tts", "music", "speech-to-text", "dubbing", "voice-change"].includes(cap))) return "audio";
  if (caps.some((cap) => ["edit", "outpaint", "remove-background", "image-upscale", "image-to-image"].includes(cap)) && !caps.some((cap) => cap.includes("video"))) return "image_edit";
  if (caps.some((cap) => ["video-upscale", "video-to-video", "subtitles"].includes(cap))) return "video_edit";
  if (caps.some((cap) => cap.includes("video") || cap === "avatar")) return "video";
  return "image";
}

function actionForCapabilities(type: string, caps: string[]) {
  if (caps.includes("remove-background")) return "remove_background";
  if (caps.includes("image-to-image") || caps.includes("edit") || caps.includes("outpaint")) return "edit_image";
  if (caps.includes("image-upscale")) return "upscale_image";
  if (caps.includes("text-to-image")) return "generate_image";
  if (caps.includes("text-to-video")) return "generate_video";
  if (caps.includes("image-to-video")) return "image_to_video";
  if (caps.includes("reference-to-video")) return "reference_to_video";
  if (caps.includes("extend-video")) return "extend_video";
  if (caps.includes("video-to-video")) return "video_to_video";
  if (caps.includes("video-upscale")) return "upscale_video";
  if (caps.includes("lipsync")) return "lipsync";
  if (caps.includes("voice-clone")) return "clone_voice";
  if (caps.includes("music")) return "generate_music";
  if (caps.includes("speech-to-text")) return "speech_to_text";
  if (caps.includes("tts")) return "generate_voice";
  if (caps.includes("dubbing")) return "dubbing";
  if (caps.includes("subtitles")) return "subtitles";
  if (type === "audio") return "generate_audio";
  return "generate";
}

function qualityTierForEndpoint(endpoint: string) {
  const e = endpoint.toLowerCase();
  if (e.includes("4k") || e.includes("pro") || e.includes("quality") || e.includes("max") || e.includes("v3/pro") || e.includes("gpt-image-2") || e.includes("nano-banana-pro")) return "premium";
  if (e.includes("mini") || e.includes("schnell") || e.includes("lite") || e.includes("fast") || e.includes("turbo")) return "economy";
  return "standard";
}

function marginClassForModel(type: string, qualityTier: string, endpoint = ""): "economy" | "standard" | "premium" | "heavy" {
  const e = endpoint.toLowerCase();
  if (
    e.includes("4k")
    || e.includes("sora")
    || e.includes("veo3")
    || (e.includes("seedance-2.0") && !e.includes("/fast/") && !e.includes("/mini/"))
    || e.includes("sync-lipsync")
    || e.includes("voice-clone")
    || e.includes("digital-twin")
    || type === "voice_clone"
  ) return "heavy";
  if (qualityTier === "premium" || type === "lipsync") return "premium";
  if (qualityTier === "economy") return "economy";
  return "standard";
}

function marginMultiplierForEndpoint(type: string, qualityTier: string, endpoint: string) {
  return QUALITY_MARGIN_MULTIPLIERS[marginClassForModel(type, qualityTier, endpoint)] || MEDIA_MARGIN_MULTIPLIER;
}

function ratioFromAmounts(revenueUsd: number, providerCostUsd: number) {
  if (revenueUsd <= 0) return -1;
  return Number(((revenueUsd - providerCostUsd) / revenueUsd).toFixed(4));
}

function minimumMarginRatioForModel(model: PricingModel) {
  const configured = Number((model.metadata || {}).minimum_margin_ratio || 0);
  return configured > 0 ? configured : MIN_MEDIA_GROSS_MARGIN_RATIO;
}

function pricingUnitForEndpoint(type: string, caps: string[]) {
  if (type === "video" || type === "video_edit" || type === "lipsync" || caps.includes("music")) return "second";
  if (type === "audio" && (caps.includes("tts") || caps.includes("dubbing") || caps.includes("speech-to-text"))) return "thousand_chars";
  return "unit";
}

function costForEndpoint(endpoint: string, type: string, caps: string[]) {
  const e = endpoint.toLowerCase();
  if (e.includes("kling-video/v3/4k")) return 0.42;
  if (e.includes("4k")) return 0.42;
  if (e.includes("veo3.1/lite")) return 0.05;
  if (e.includes("veo3.1/fast") || e.includes("veo3/fast")) return 0.15;
  if (e.includes("veo3.1") || e.includes("veo3")) return 0.4;
  if (e.includes("kling-video/v3/pro")) return 0.168;
  if (e.includes("kling-video/v3/standard")) return 0.126;
  if (e.includes("seedance-2.0/mini/reference")) return 0.0928;
  if (e.includes("seedance-2.0/mini")) return 0.0721;
  if (e.includes("seedance-2.0/fast")) return 0.2419;
  if (e.includes("seedance-2.0")) return 0.3034;
  if (e.includes("ray/v3.2/text-to-video")) return 0.2;
  if (e.includes("ray/v3.2/image-to-video")) return 0.06;
  if (e.includes("ray/v3.2/reframe")) return 0.12;
  if (e.includes("ray/v3.2/video-to-video")) return 0.216;
  if (e.includes("grok-imagine-video/v1.5")) return 0.14;
  if (e.includes("grok-imagine-video/reference")) return 0.07;
  if (e.includes("grok-imagine-video/extend")) return 0.08;
  if (e.includes("happy-horse")) return 0.18;
  if (e.includes("pixverse")) return 0.06;
  if (e.includes("omnihuman")) return 0.16;
  if (e.includes("heygen/v3/lipsync/precision")) return 0.1;
  if (e.includes("heygen/v3/lipsync/speed")) return 0.05;
  if (e.includes("heygen") && e.includes("video-agent")) return 0.034;
  if (e.includes("heygen") && e.includes("speed")) return 0.05;
  if (e.includes("avatar") || e.includes("heygen")) return 0.1;
  if (e.includes("sync-lipsync")) return 0.1333;
  if (e.includes("creatify/aurora")) return 0.14;
  if (e.includes("gemini-omni-flash/image-to-video")) return 0.13;
  if (type === "video" || type === "video_edit" || type === "lipsync") return 0.1;
  if (e.includes("voice-clone") || e.includes("digital-twin")) return 1.5;
  if (e.includes("elevenlabs/music")) return 0.0134;
  if (e.includes("elevenlabs/dubbing")) return 0.015;
  if (e.includes("elevenlabs/voice-changer")) return 0.005;
  if (e.includes("elevenlabs/text-to-dialogue")) return 0.1;
  if (caps.includes("music")) return 0.08;
  if (type === "audio") return 0.05;
  if (e.includes("gpt-image-2/edit")) return 0.219;
  if (e.includes("gpt-image-2")) return 0.211;
  if (e.includes("nano-banana-pro")) return 0.15;
  if (e.includes("nano-banana-2")) return 0.08;
  if (e.includes("flux-2-pro")) return 0.06;
  if (e.includes("flux/dev")) return 0.04;
  if (e.includes("flux/schnell")) return 0.04;
  if (e.includes("seedream")) return 0.04;
  if (e.includes("bria/background/remove")) return 0.018;
  if (e.includes("remove-background") || e.includes("background/remove")) return 0.01;
  return 0.04;
}

function defaultUnitsForEndpoint(type: string, caps: string[]) {
  if (type === "video" || type === "video_edit" || type === "lipsync") return 5;
  if (caps.includes("music")) return 30;
  return 1;
}

function maximumUnitsForEndpoint(type: string, caps: string[], endpoint: string) {
  const e = endpoint.toLowerCase();
  if (e.includes("veo3")) return 8;
  if (caps.includes("music")) return 120;
  if (type === "video" || type === "video_edit") return e.includes("4k") ? 10 : 15;
  if (type === "lipsync") return 60;
  if (type === "audio") return 20;
  return undefined;
}

function inputProfileForCapabilities(caps: string[]) {
  if (caps.includes("first-last-frame-to-video")) return "first_last_frame";
  if (caps.includes("reference-to-video")) return "reference_video";
  if (caps.includes("image-to-video")) return "image_video";
  if (caps.includes("extend-video") || caps.includes("video-to-video")) return "video_reference";
  if (caps.includes("image-to-image") || caps.includes("edit") || caps.includes("outpaint") || caps.includes("remove-background") || caps.includes("image-upscale")) return "image_edit";
  if (caps.includes("lipsync")) return "lipsync";
  if (caps.includes("tts") || caps.includes("music")) return "audio_prompt";
  return "text_prompt";
}

type HuggyflowPriorityRoute = {
  family: string;
  label: string;
  aliases: string[];
  referenceStrategy?: string;
};

function priorityRouteForEndpoint(endpoint: string): HuggyflowPriorityRoute | null {
  const e = endpoint.toLowerCase();
  if (e.startsWith("bytedance/seedance-2.0/")) return { family: "seedance-2.0", label: "Seedance 2.0", aliases: ["seedance", "video", "cinematic"], referenceStrategy: "reference_images_and_frames" };
  if (e.startsWith("bytedance/seedance-2.5/")) return { family: "seedance-2.5", label: "Seedance 2.5", aliases: ["seedance", "video", "character", "reference"], referenceStrategy: "reference_images_video_audio" };
  if (e.startsWith("fal-ai/kling-video/v3/")) return { family: "kling-3.0", label: "Kling 3.0", aliases: ["kling", "video", "character"], referenceStrategy: "element_reference" };
  if (e.startsWith("fal-ai/veo3.1")) return { family: "veo-3.1", label: "Veo 3.1", aliases: ["veo", "cinematic", "audio"], referenceStrategy: "reference_images_and_frames" };
  if (e.includes("seedream/v5")) return { family: "seedream-5.0", label: "Seedream 5.0", aliases: ["seedream", "image", "layout", "reference"], referenceStrategy: "reference_images" };
  if (e.includes("nano-banana-pro")) return { family: "nano-banana-pro", label: "Nano Banana Pro", aliases: ["nano", "image", "text", "character"], referenceStrategy: "reference_images" };
  if (e.includes("gpt-image-2")) return { family: "gpt-image-2", label: "GPT Image 2", aliases: ["gpt image", "image", "text", "edit"], referenceStrategy: "reference_images" };
  if (e.startsWith("fal-ai/recraft/v3/")) return { family: "recraft-v3", label: "Recraft V3", aliases: ["recraft", "vector", "brand style", "typography"], referenceStrategy: "reference_images" };
  if (e.includes("flux-2-pro")) return { family: "flux-2-pro", label: "FLUX.2 Pro", aliases: ["flux", "style transfer", "image", "edit"], referenceStrategy: "reference_images" };
  if (e.includes("elevenlabs/")) return { family: "elevenlabs-v3", label: "ElevenLabs Eleven V3", aliases: ["voice", "audio", "tts", "dubbing"], referenceStrategy: "voice_reference" };
  if (e.startsWith("google/gemini-omni-flash")) return { family: "gemini-omni-flash", label: "Gemini Omni Flash", aliases: ["omni", "video", "transform", "style", "reference"], referenceStrategy: "reference_images_and_video" };
  if (e.startsWith("fal-ai/sora-2/")) return { family: "sora-2", label: "Sora 2", aliases: ["sora", "premium", "cinematic", "video"], referenceStrategy: "reference_images_and_video" };
  if (e.startsWith("fal-ai/topaz/upscale/")) return { family: "topaz-upscale", label: "Topaz Upscale", aliases: ["topaz", "upscale", "finish", "resolution"], referenceStrategy: "source_asset" };
  return null;
}

function safeLogMessage(value: unknown) {
  return String(value instanceof Error ? value.message : value || "unknown error")
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/sk-[a-z0-9_-]+/gi, "[redacted]")
    .replace(/(api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function safeErrorDiagnostic(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    code: safeLogMessage(source.code || (value instanceof FlowtubeError ? value.payload.code : "UNHANDLED_ERROR")),
    message: safeLogMessage(source.message || value),
    details: safeLogMessage(source.details || ""),
    hint: safeLogMessage(source.hint || ""),
  };
}

function falModel(endpoint: string, override: ModelOverride = {}): PricingModel {
  const caps = override.capabilities || capabilitiesForEndpoint(endpoint);
  const type = override.type || mediaTypeForCapabilities(caps);
  const qualityTier = override.qualityTier || qualityTierForEndpoint(endpoint);
  const pricingUnit = override.pricingUnit || pricingUnitForEndpoint(type, caps);
  const cost = override.costPerUnitUsd || costForEndpoint(endpoint, type, caps);
  const defaultUnits = override.defaultUnits || defaultUnitsForEndpoint(type, caps);
  const premium = override.premium ?? qualityTier === "premium";
  const marginClass = marginClassForModel(type, qualityTier, endpoint);
  const marginMultiplier = override.marginMultiplier || marginMultiplierForEndpoint(type, qualityTier, endpoint);
  return {
    id: override.id || idFromEndpoint(endpoint),
    name: override.name || override.label || labelFromEndpoint(endpoint),
    type,
    endpoint,
    pricingUnit,
    costPerUnitUsd: cost,
    defaultUnits,
    minimumUnits: override.minimumUnits || (pricingUnit === "second" ? Math.min(defaultUnits, 5) : 1),
    maximumUnits: override.maximumUnits || maximumUnitsForEndpoint(type, caps, endpoint),
    creditFloorUsd: override.creditFloorUsd || CREDIT_FLOOR_USD,
    retailCreditUsd: override.retailCreditUsd || RETAIL_CREDIT_USD,
    marginMultiplier,
    requiresConfirmation: override.requiresConfirmation ?? (type !== "image" && type !== "image_edit" || premium || cost >= 0.08),
    premium,
    metadata: {
      provider: "fal.ai",
      endpoint,
      capabilities: caps,
      input_profile: override.inputProfile || inputProfileForCapabilities(caps),
      quality_tier: qualityTier,
      margin_class: marginClass,
      target_margin_ratio: Number(((marginMultiplier - 1) / marginMultiplier).toFixed(3)),
      minimum_margin_ratio: MIN_MEDIA_GROSS_MARGIN_RATIO,
      provider_cost_source: override.metadata?.pricing_source || "fal_catalog_conservative",
      pricing_checked_at: override.metadata?.pricing_checked_at || "2026-08-19",
      infrastructure_cost_usd: pricingUnit === "second" ? INFRA_VIDEO_BASE_USD : INFRA_IMAGE_BASE_USD,
      storage_cost_usd: INFRA_MEDIA_STORAGE_USD,
      bandwidth_cost_usd: INFRA_MEDIA_BANDWIDTH_USD,
      polling_cost_usd: pricingUnit === "second" ? INFRA_MEDIA_POLLING_USD : 0,
      input_processing_cost_usd: INFRA_MEDIA_INPUT_USD,
      family: override.family || endpoint.split("/")[0],
      fal_only: true,
      cost_estimate: true,
      ...(priorityRouteForEndpoint(endpoint) ? {
        huggyflow_priority: true,
        huggyflow_family: priorityRouteForEndpoint(endpoint)!.family,
        huggyflow_route_label: priorityRouteForEndpoint(endpoint)!.label,
        routing_aliases: priorityRouteForEndpoint(endpoint)!.aliases,
        reference_strategy: priorityRouteForEndpoint(endpoint)!.referenceStrategy || "project_memory",
      } : {}),
      ...(override.metadata || {}),
    },
  };
}

// The override manifest is also the verified pricing/capability manifest. Keeping
// its endpoints in the registry activates the audio, avatar, lipsync, upscale,
// editing and alternate video families that are not part of the short default list.
const modelRegistry: PricingModel[] = Array.from(new Set([
  ...FAL_ENDPOINTS,
  ...Object.keys(FAL_ENDPOINT_OVERRIDES),
])).map((endpoint) => falModel(endpoint, FAL_ENDPOINT_OVERRIDES[endpoint]));

function openRouterMediaCapabilities(remote: OpenRouterRemoteModel | undefined, type: "image" | "video") {
  const inputModalities = (remote?.architecture?.input_modalities || []).map((value) => String(value).toLowerCase());
  const supportedFrameImages = Array.isArray(remote?.supported_frame_images) && remote.supported_frame_images.length > 0;
  const capabilities = new Set<string>([type === "video" ? "text-to-video" : "text-to-image"]);
  if (type === "image" && inputModalities.includes("image")) {
    capabilities.add("image-to-image");
    capabilities.add("edit");
    capabilities.add("reference");
  }
  if (type === "video" && inputModalities.includes("image")) {
    capabilities.add("image-to-video");
    capabilities.add("reference-to-video");
    capabilities.add("reference");
  }
  if (type === "video" && (inputModalities.includes("video") || supportedFrameImages)) {
    capabilities.add("video-to-video");
    capabilities.add("reference-to-video");
    capabilities.add("reference");
  }
  if (type === "video" && supportedFrameImages) capabilities.add("first-last-frame-to-video");
  return [...capabilities];
}

function openRouterMediaModel(id: string, type: "image" | "video", remote?: OpenRouterRemoteModel): PricingModel {
  const video = type === "video";
  const premium = /pro|4k|sora|veo|seedance-2\.5/i.test(id);
  const skuValues = Object.entries(remote?.pricing_skus || {})
    .map(([key, value]) => ({ key: key.toLowerCase(), value: Number(value) }))
    .filter((item) => Number.isFinite(item.value) && item.value > 0);
  const sku = skuValues.find((item) => video
    ? /duration_seconds(?!.*without_audio)/.test(item.key)
    : /(^|[._-])image([._-]|$)|image_generation|request/.test(item.key));
  const requestPrice = Number(remote?.pricing?.request);
  // Image token prices are not per-image prices. Never interpret them as a
  // generation unit or an image can inherit an absurd video-like charge.
  const imagePrice = Number(remote?.pricing?.image);
  const liveCost = sku?.value || (Number.isFinite(video ? requestPrice : imagePrice) ? (video ? requestPrice : imagePrice) : 0);
  const costPerUnitUsd = liveCost > 0
    ? liveCost
    : video
      ? (id.includes("veo") ? 0.4 : id.includes("sora") ? 0.5 : UNKNOWN_MODEL_COST_USD)
      : (id.includes("gpt-image") ? 0.22 : UNKNOWN_MODEL_COST_USD);
  const name = String(remote?.name || id);
  const capabilities = openRouterMediaCapabilities(remote, type);
  return {
    id,
    name,
    type,
    endpoint: `openrouter/${id}`,
    provider: "openrouter",
    pricingUnit: video ? "second" : "unit",
    costPerUnitUsd,
    defaultUnits: video ? Number(remote?.supported_durations?.[0] || 5) : 1,
    minimumUnits: video ? 1 : 1,
    maximumUnits: video ? 15 : 1,
    creditFloorUsd: CREDIT_FLOOR_USD,
    retailCreditUsd: RETAIL_CREDIT_USD,
    marginMultiplier: premium ? QUALITY_MARGIN_MULTIPLIERS.premium : MEDIA_MARGIN_MULTIPLIER,
    requiresConfirmation: video || premium || costPerUnitUsd >= 0.08,
    premium,
    metadata: {
      provider: "openrouter",
      capabilities,
      input_profile: video ? "reference_video" : "image_edit",
      quality_tier: premium ? "premium" : "standard",
      huggyflow_priority: true,
      huggyflow_family: id.split("/").slice(-1)[0],
      huggyflow_route_label: name,
      reference_strategy: "reference_images_and_frames",
      live_catalog: true,
      supported_parameters: remote?.supported_parameters || {},
      pricing_skus: remote?.pricing_skus || {},
      supported_durations: remote?.supported_durations || [],
      supported_resolutions: remote?.supported_resolutions || [],
      supported_aspect_ratios: remote?.supported_aspect_ratios || [],
      supported_frame_images: remote?.supported_frame_images || [],
      architecture: remote?.architecture || null,
      pricing_source: "openrouter",
      price_confidence: liveCost > 0 ? "live" : "conservative_estimate",
      pricing_unit_guard: video ? "second" : "unit",
    },
  };
}

const OPENROUTER_MEDIA_REGISTRY: PricingModel[] = [
  ...OPENROUTER_CURATED_IMAGE_IDS.map((id) => openRouterMediaModel(id, "image")),
  ...OPENROUTER_CURATED_VIDEO_IDS.map((id) => openRouterMediaModel(id, "video")),
];

function falMediaConfigured() {
  return Boolean(String(Deno.env.get("FAL_KEY") || "").trim());
}

function enabledModelRegistry() {
  const falModels = falMediaConfigured() ? modelRegistry.filter(isPublicMediaModel) : [];
  if (!OPENROUTER_MEDIA_ENABLED || !openRouterCatalogCache.live) return falModels;
  const liveIds = new Set([
    ...openRouterCatalogCache.image.map((model) => String(model.id || "")),
    ...openRouterCatalogCache.video.map((model) => String(model.id || "")),
  ]);
  return [...falModels, ...OPENROUTER_MEDIA_REGISTRY.filter((model) => liveIds.has(model.id) && isPublicMediaModel(model))];
}

const FEATURED_MODEL_IDS: string[] = [];

function isHuggyflowPriorityModel(model: PricingModel) {
  return Boolean(model.endpoint && (model.metadata?.huggyflow_priority || priorityRouteForEndpoint(String(model.endpoint))));
}

function priorityModelCatalog(catalog: PricingModel[]) {
  return [...catalog].sort((a, b) => {
      const priorityA = isHuggyflowPriorityModel(a) ? 0 : 1;
      const priorityB = isHuggyflowPriorityModel(b) ? 0 : 1;
      if (priorityA !== priorityB) return priorityA - priorityB;
      const familyA = String(a.metadata?.huggyflow_family || "");
      const familyB = String(b.metadata?.huggyflow_family || "");
      return familyA.localeCompare(familyB) || String(a.name).localeCompare(String(b.name));
    });
}

function priorityRoutePlan(model: PricingModel, type: string, prompt: string, body: Record<string, unknown> = {}) {
  const route = priorityRouteForEndpoint(String(model.endpoint || ""));
  const referenceUrls = stringArray(body.referenceUrls || body.reference_urls || body.referenceImageUrls || body.reference_image_urls);
  const hasReference = Boolean(
    body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url
    || body.firstFrameUrl || body.first_frame_url || body.lastFrameUrl || body.last_frame_url
    || referenceUrls.length,
  );
  return {
    planner: "creative-planner",
    router: "model-router",
    orchestrator: "task-orchestrator",
    qualityGate: "quality-control",
    selectedFamily: route?.family || "huggyflow-priority",
    selectedModel: model.name,
    mediaType: type,
    intentSignals: prompt.slice(0, 500),
    referenceLock: hasReference,
    referenceStrategy: route?.referenceStrategy || "project_memory",
    stages: ["intent", "plan", "route", hasReference ? "preserve_references" : "prepare_inputs", "generate", "quality_check", "deliver"],
    fallbackPolicy: "same_priority_family_or_next_priority_family",
  };
}

const MODEL_SHORT_NAMES: Record<string, string> = {
  "gpt-image-2": "GPT Image 2",
  "gpt-image-2-edit": "GPT Image Edit",
  "nano": "Nano Pro",
  "nano2": "Nano 2",
  "nano2-edit": "Nano Edit",
  "flux": "Flux Fast",
  "flux-2-pro": "Flux 2 Pro",
  "flux-2-pro-edit": "Flux 2 Edit",
  "seedream-lite": "Seedream Lite",
  "veoq": "Veo 3",
  "veol": "Veo 3 Fast",
  "kling-video-v3-pro-text-to-video": "Kling 3 Pro",
  "kling-video-v3-pro-image-to-video": "Kling 3 Pro I2V",
  "kling-video-v3-4k-text-to-video": "Kling 3 4K",
  "kling-video-v3-4k-image-to-video": "Kling 3 4K I2V",
  "kling-video-v3-standard-text-to-video": "Kling 3 Std",
  "kling-video-v3-standard-image-to-video": "Kling 3 Std I2V",
  "bytedance-seedance-2-0-text-to-video": "Seedance 2",
  "bytedance-seedance-2-0-image-to-video": "Seedance 2 I2V",
  "bytedance-seedance-2-0-fast-text-to-video": "Seedance Fast",
  "bytedance-seedance-2-0-mini-text-to-video": "Seedance Mini",
  "pixverse-v6-image-to-video": "PixVerse 6",
  "luma-agent-ray-v3-2-text-to-video": "Ray 3.2",
  "luma-agent-ray-v3-2-image-to-video": "Ray 3.2 I2V",
  "luma-agent-ray-v3-2-video-to-video": "Ray Remix",
  "minimax-tts": "MiniMax Voice",
  "minimax-tts-turbo": "MiniMax Turbo",
  "gemini-flash-tts": "Gemini TTS",
  "lyria3-pro": "Lyria Music",
  "sonilo-music": "Sonilo Music",
  "heygen-v3-lipsync-precision": "HeyGen Lipsync",
  "sync-lipsync-v3": "Sync Lipsync",
  "minimax-voice-clone": "Voice Clone",
};

function compactModelName(model: PricingModel) {
  if (MODEL_SHORT_NAMES[model.id]) return MODEL_SHORT_NAMES[model.id];
  const endpoint = String(model.endpoint || "").toLowerCase();
  const caps = modelCapabilities(model);
  if (endpoint.includes("seedance-2.0")) return `Seedance 2 ${caps.includes("image-to-video") ? "I2V" : caps.includes("reference-to-video") ? "Ref" : caps.includes("fast") ? "Fast" : ""}`.trim();
  if (endpoint.includes("kling-video/v3")) return `Kling 3 ${endpoint.includes("4k") ? "4K" : endpoint.includes("pro") ? "Pro" : "Std"}`;
  if (endpoint.includes("nano-banana")) return caps.includes("edit") ? "Nano Edit" : "Nano";
  if (endpoint.includes("gemini")) return caps.includes("edit") ? "Gemini Edit" : "Gemini";
  if (endpoint.includes("flux")) return endpoint.includes("edit") ? "Flux Edit" : "Flux";
  if (endpoint.includes("veo3")) return endpoint.includes("fast") || endpoint.includes("lite") ? "Veo Fast" : "Veo";
  const cleaned = model.name.replace(/^Fal Ai\s+/i, "").replace(/\b(Text|Image|Reference|Video|To)\b/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 24 ? `${cleaned.slice(0, 23).trim()}...` : cleaned;
}

function modelUiBadge(model: PricingModel) {
  const tier = String((model.metadata || {}).quality_tier || "");
  if (tier === "premium" || model.premium) return "PRO";
  if (/fast|turbo|lite|mini|schnell/i.test(String(model.endpoint || ""))) return "FAST";
  return "";
}

function modelUiRank(model: PricingModel) {
  const featured = FEATURED_MODEL_IDS.indexOf(model.id);
  if (featured >= 0) return featured;
  const typeOrder: Record<string, number> = { image: 20, image_edit: 30, video: 40, video_edit: 50, audio: 60, lipsync: 70, voice_clone: 80 };
  const tier = String((model.metadata || {}).quality_tier || "standard");
  return (typeOrder[model.type] || 99) + (tier === "premium" ? 0 : tier === "standard" ? 4 : 8);
}

const PRICING_MARGIN_METADATA = {
  checkout: true,
  infra_reserve_percent: 10,
  payment_reserve_percent: 7,
  minimum_net_credit_usd: CREDIT_FLOOR_USD,
  minimum_gross_margin_ratio: MIN_MEDIA_GROSS_MARGIN_RATIO,
  target_margin_multipliers: QUALITY_MARGIN_MULTIPLIERS,
  margin_rule: "credits priced after AI cost, storage, bandwidth, payments, and support reserve",
  model_policy: "HuggyFlow auto-routes every request to the best available backend model for the task",
};

function planMeta(extra: Record<string, unknown> = {}) {
  return { ...PRICING_MARGIN_METADATA, ...extra };
}

const FREE_FALLBACK_PLAN: PlanLimits = {
  id: "free",
  displayName: "Free",
  includedCredits: 100,
  monthlyPriceUsd: 0,
  annualPriceUsd: 0,
  monthlyPriceXof: 0,
  annualPriceXof: 0,
  pricingVersion: "2026-07-launch-v1",
  monthlyMessageLimit: 60,
  dailyMessageLimit: 10,
  dailyImageLimit: 3,
  dailyVideoLimit: 0,
  concurrentImageJobs: 1,
  concurrentVideoJobs: 0,
  allowedMediaTypes: ["image"],
  watermarkRequired: true,
  mediaRetentionDays: 7,
  storageGb: 1,
  maxUploadMb: 25,
  seatLimit: 1,
  supportLevel: "community",
  priorityQueue: false,
  metadata: planMeta({ checkout: false }),
};

function serviceKey() {
  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (rawSecretKeys) {
    try {
      const parsed = JSON.parse(rawSecretKeys);
      const keyName = String(parsed.default || Object.values(parsed)[0] || "");
      return Deno.env.get(keyName) || keyName;
    } catch (_err) {
      // Fall back to legacy env below.
    }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function adminClient() {
  return createClient(SUPABASE_URL, serviceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return String(parsed.default || Object.values(parsed)[0] || "");
    } catch (_err) {
      // Fall back below.
    }
  }
  return Deno.env.get("SUPABASE_ANON_KEY") || serviceKey();
}

function publicClient() {
  return createClient(SUPABASE_URL, publishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function unauthorized() {
  return json({ error: { message: "Unauthorized Edge Function request" } }, 401);
}

function checkSecret(req: Request) {
  const required = Deno.env.get("FLOWTUBE_EDGE_SECRET");
  if (!required) return null;
  const provided = req.headers.get("x-flowtube-secret") || req.headers.get("x-huggyflow-secret");
  return provided === required ? null : unauthorized();
}

async function bodyJson(req: Request) {
  try {
    return await req.json();
  } catch (_err) {
    return {};
  }
}

async function bodyText(req: Request) {
  try {
    return await req.text();
  } catch (_err) {
    return "";
  }
}

function requestIp(req: Request) {
  return req.headers.get("cf-connecting-ip")
    || req.headers.get("x-real-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "0.0.0.0";
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bearerToken(req: Request) {
  const header = req.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

async function supabaseAuthFetch(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("apikey", publishableKey());
  headers.set("authorization", `Bearer ${token}`);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${SUPABASE_URL}/auth/v1${path}`, { ...init, headers });
}

async function mfaRoute(req: Request) {
  const token = bearerToken(req);
  if (!token) throw new FlowtubeError(401, "Connecte-toi pour gérer la double authentification.", { code: "AUTH_REQUIRED" });
  const body = await bodyJson(req);
  const action = String(body.action || "status");
  if (req.method === "GET" || action === "status") {
    const response = await supabaseAuthFetch("/factors", token);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new FlowtubeError(response.status, "Impossible de lire l’état MFA.", { code: "MFA_STATUS_FAILED" });
    const factors = Array.isArray(payload) ? payload : (Array.isArray(payload.factors) ? payload.factors : []);
    return json({ enabled: factors.some((factor: Record<string, unknown>) => factor.status === "verified" && factor.factor_type === "totp"), factors: factors.map((factor: Record<string, unknown>) => ({ id: factor.id, type: factor.factor_type, status: factor.status, friendlyName: factor.friendly_name })) });
  }
  if (action === "enroll") {
    const response = await supabaseAuthFetch("/factors", token, { method: "POST", body: JSON.stringify({ factor_type: "totp", friendly_name: compactText(body.friendlyName || "AgentFlow", 40) }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new FlowtubeError(response.status, String(payload.msg || payload.message || "Impossible de démarrer l’activation MFA."), { code: "MFA_ENROLL_FAILED" });
    return json({ factor: { id: payload.id, type: payload.factor_type, status: payload.status, qrCode: payload.totp?.qr_code || null, secret: payload.totp?.secret || null, uri: payload.totp?.uri || null } });
  }
  if (action === "challenge") {
    const factorId = String(body.factorId || "");
    if (!isUuid(factorId)) throw new FlowtubeError(400, "Facteur MFA invalide.", { code: "MFA_FACTOR_REQUIRED" });
    const response = await supabaseAuthFetch(`/factors/${factorId}/challenge`, token, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new FlowtubeError(response.status, "Impossible de créer le challenge MFA.", { code: "MFA_CHALLENGE_FAILED" });
    return json({ challengeId: payload.id });
  }
  if (action === "verify") {
    const factorId = String(body.factorId || "");
    const challengeId = String(body.challengeId || "");
    const code = String(body.code || "").replace(/\s/g, "");
    if (!isUuid(factorId) || !isUuid(challengeId) || !/^\d{6}$/.test(code)) throw new FlowtubeError(400, "Code MFA invalide.", { code: "MFA_CODE_INVALID" });
    const response = await supabaseAuthFetch(`/factors/${factorId}/verify`, token, { method: "POST", body: JSON.stringify({ challenge_id: challengeId, code }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new FlowtubeError(response.status, "Le code MFA est incorrect ou expiré.", { code: "MFA_VERIFY_FAILED" });
    const authAdmin = adminClient();
    const { data: userData } = await authAdmin.auth.getUser(token);
    const recoveryCodes = userData.user?.id ? await issueMfaRecoveryCodes(authAdmin, String(userData.user.id)) : [];
    return json({ verified: true, factor: { id: factorId, status: "verified" }, session: payload, recoveryCodes });
  }
  if (action === "recovery_codes") {
    const authAdmin = adminClient();
    const { data: userData } = await authAdmin.auth.getUser(token);
    if (!userData.user?.id) throw new FlowtubeError(401, "Session MFA invalide.", { code: "MFA_AUTH_REQUIRED" });
    const factorsResponse = await supabaseAuthFetch("/factors", token);
    const factorsPayload = await factorsResponse.json().catch(() => []);
    const factors = Array.isArray(factorsPayload) ? factorsPayload : (Array.isArray(factorsPayload.factors) ? factorsPayload.factors : []);
    if (!factors.some((factor: Record<string, unknown>) => factor.status === "verified" && factor.factor_type === "totp")) throw new FlowtubeError(400, "Active d abord la double authentification.", { code: "MFA_NOT_ENABLED" });
    return json({ recoveryCodes: await issueMfaRecoveryCodes(authAdmin, String(userData.user.id)) });
  }
  if (action === "unenroll") {
    const factorId = String(body.factorId || "");
    if (!isUuid(factorId)) throw new FlowtubeError(400, "Facteur MFA invalide.", { code: "MFA_FACTOR_REQUIRED" });
    const response = await supabaseAuthFetch(`/factors/${factorId}`, token, { method: "DELETE" });
    if (!response.ok) throw new FlowtubeError(response.status, "Impossible de désactiver la double authentification.", { code: "MFA_UNENROLL_FAILED" });
    return json({ enabled: false });
  }
  throw new FlowtubeError(400, "Action MFA inconnue.", { code: "MFA_ACTION_INVALID" });
}

async function issueMfaRecoveryCodes(supabase: ReturnType<typeof adminClient>, userId: string) {
  await supabase.from("mfa_recovery_codes").delete().eq("user_id", userId);
  const codes: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    const raw = `${randomToken(4).slice(0, 4)}-${randomToken(4).slice(0, 4)}`.toUpperCase();
    codes.push(raw);
    await supabase.from("mfa_recovery_codes").insert({ user_id: userId, code_hash: await sha256Hex(raw) });
  }
  return codes;
}

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function enforceRateLimit(req: Request, supabase: ReturnType<typeof adminClient>, route: string, userId?: string, limit = DEFAULT_RATE_LIMIT) {
  const ipHash = await sha256Hex(`${requestIp(req)}:${Deno.env.get("FLOWTUBE_RATE_LIMIT_SALT") || "flowtube"}`);
  const windowStart = new Date(Math.floor(Date.now() / (RATE_LIMIT_WINDOW_SECONDS * 1000)) * RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  await supabase.from("rate_limit_events").insert({
    user_id: userId || null,
    ip_hash: ipHash,
    route,
    window_start: windowStart,
    metadata: { method: req.method },
  });
  const { count } = await supabase.from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("route", route)
    .eq("window_start", windowStart)
    .eq("ip_hash", ipHash);
  if ((count || 0) > limit) {
    throw new FlowtubeError(429, "Trop de requetes. Reessaie dans quelques instants.", { code: "RATE_LIMITED" });
  }
}

async function optionalUserIdFromRequest(req: Request, supabase: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (token && !token.startsWith("hf_")) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user?.id) {
      await assertSecuritySessionActive(req, supabase, data.user.id, token);
      return data.user.id;
    }
  }
  const apiUserId = await userIdFromApiKey(req, supabase, token);
  if (apiUserId) return apiUserId;
  return null;
}

async function userIdFromApiKey(req: Request, supabase: ReturnType<typeof adminClient>, bearerToken = "") {
  const raw = String(req.headers.get("x-huggyflow-api-key") || req.headers.get("x-api-key") || bearerToken || "").trim();
  if (!raw || !raw.startsWith("hf_")) return null;
  const keyHash = await sha256Hex(raw);
  const { data } = await supabase.from("api_keys")
    .select("id,user_id,scopes,expires_at,daily_limit")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data?.user_id) return null;
  if (data.expires_at && new Date(String(data.expires_at)).getTime() <= Date.now()) return null;
  const { count: usageToday } = await supabase.from("api_key_usage")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", data.id)
    .gte("created_at", dayStartIso());
  if ((usageToday || 0) >= Number(data.daily_limit || 1000)) {
    throw new FlowtubeError(429, "La limite quotidienne de cette cle API est atteinte.", { code: "API_KEY_DAILY_LIMIT" });
  }
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  await supabase.from("api_key_usage").insert({
    api_key_id: data.id,
    user_id: data.user_id,
    route: new URL(req.url).pathname,
    method: req.method,
    status_code: 200,
  });
  await supabase.from("app_events").insert({
    user_id: data.user_id,
    event_name: "api_key_used",
    metadata: { route: new URL(req.url).pathname, method: req.method, key_id: data.id },
  });
  return String(data.user_id);
}

async function userIdFromRequest(req: Request, supabase: ReturnType<typeof adminClient>) {
  const userId = await optionalUserIdFromRequest(req, supabase);
  if (userId) {
    await enforceApiKeyScope(req, supabase);
    return userId;
  }
  throw new FlowtubeError(401, "Connecte-toi a Huggyflow pour continuer.", { code: "AUTH_REQUIRED" });
}

function apiScopeForRequest(req: Request) {
  const parts = new URL(req.url).pathname.split("/").filter(Boolean);
  const first = parts[parts.indexOf("flowtube-api") + 1] || parts[0] || "";
  if (first === "chat") return "chat";
  if (first === "generate" || first === "upload") return "generate";
  if (["projects", "profile", "memory", "artifacts", "generations", "agent-tasks", "background-tasks", "skills", "skill-evals", "stats", "usage", "security", "pricing"].includes(first)) return "read";
  if (first === "exports" || first === "publish") return "publish";
  if (first === "team") return "team";
  return null;
}

async function enforceApiKeyScope(req: Request, supabase: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const raw = String(req.headers.get("x-huggyflow-api-key") || req.headers.get("x-api-key") || bearer).trim();
  if (!raw.startsWith("hf_")) return;
  const required = apiScopeForRequest(req);
  if (!required) return;
  const keyHash = await sha256Hex(raw);
  const { data } = await supabase.from("api_keys").select("scopes,expires_at,revoked_at").eq("key_hash", keyHash).maybeSingle();
  const scopes = Array.isArray(data?.scopes) ? data.scopes.map((scope: unknown) => String(scope)) : [];
  const expired = Boolean(data?.expires_at && new Date(String(data.expires_at)).getTime() <= Date.now());
  if (data?.revoked_at || expired || !scopes.includes(required)) {
    throw new FlowtubeError(403, `Cette cle API ne possede pas la permission ${required}.`, { code: "API_SCOPE_REQUIRED", required });
  }
}

async function authenticatedUserIdFromRequest(req: Request, supabase: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user?.id) {
      await assertSecuritySessionActive(req, supabase, data.user.id, token);
      return data.user.id;
    }
  }
  throw new FlowtubeError(401, "Connecte-toi pour continuer cette action.", { code: "AUTH_REQUIRED" });
}

function testBillingAllowlist() {
  const ids = String(Deno.env.get("HUGGYFLOW_TEST_ACCOUNT_IDS") || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  const emails = String(Deno.env.get("HUGGYFLOW_TEST_ACCOUNT_EMAILS") || "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return { ids, emails };
}

async function assertTestBillingAccess(req: Request, supabase: ReturnType<typeof adminClient>) {
  if (!TEST_BILLING_ENABLED) {
    throw new FlowtubeError(404, "Cette action n’est pas disponible.", { code: "NOT_FOUND" });
  }
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const { ids, emails } = testBillingAllowlist();
  if (APP_RUNTIME_ENV === "production" && !ids.length && !emails.length) {
    throw new FlowtubeError(404, "Cette action n’est pas disponible.", { code: "NOT_FOUND" });
  }
  if (!ids.length && !emails.length) return userId;
  const { data: profile } = await supabase.from("profiles").select("id,email,billing_email").eq("id", userId).maybeSingle();
  const accountEmail = String(profile?.email || profile?.billing_email || "").toLowerCase();
  if (!ids.includes(userId) && (!accountEmail || !emails.includes(accountEmail))) {
    throw new FlowtubeError(404, "Cette action n’est pas disponible.", { code: "NOT_FOUND" });
  }
  return userId;
}

async function activeTestGrant(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await supabase.from("billing_test_grants")
    .select("id,user_id,plan_id,granted_credits,status,created_at,revoked_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data || null;
}

function publicTestGrant(grant: Record<string, unknown> | null) {
  if (!grant) return { active: false, planId: null, credits: 0, status: "inactive" };
  return {
    active: String(grant.status || "") === "active",
    planId: grant.plan_id ? String(grant.plan_id) : null,
    credits: Number(grant.granted_credits || 0),
    status: String(grant.status || "inactive"),
  };
}

async function testGrantStatus(req: Request) {
  const supabase = adminClient();
  const userId = await assertTestBillingAccess(req, supabase);
  const grant = await activeTestGrant(supabase, userId);
  return json({ enabled: true, ...publicTestGrant(grant), canRevoke: Boolean(grant) });
}

async function activateTestGrant(req: Request) {
  const supabase = adminClient();
  const userId = await assertTestBillingAccess(req, supabase);
  const body = await bodyJson(req);
  const planId = String(body.planId || "pro").toLowerCase();
  const credits = Number(body.credits || 1500);
  if (planId !== "pro" || credits !== 1500) {
    throw new FlowtubeError(400, "Cette offre de test n’est pas disponible.", { code: "TEST_PLAN_UNAVAILABLE" });
  }
  const idempotencyKey = String(body.idempotencyKey || `test:${userId}:pro:1500`).trim().slice(0, 120);
  const { data, error } = await supabase.rpc("activate_billing_test_grant", {
    p_user_id: userId,
    p_plan_id: "pro",
    p_credit_option_id: String(body.creditOptionId || "pro-1500").slice(0, 120),
    p_granted_credits: 1500,
    p_idempotency_key: idempotencyKey,
  });
  if (error) {
    const code = String(error.message || "");
    if (code.includes("paid_account_not_eligible")) {
      throw new FlowtubeError(409, "Ce compte possède déjà une offre active.", { code: "TEST_ACCOUNT_NOT_ELIGIBLE" });
    }
    if (code.includes("test_grant_already_active")) {
      throw new FlowtubeError(409, "L’accès de test est déjà actif.", { code: "TEST_GRANT_ACTIVE" });
    }
    throw new FlowtubeError(503, "L’accès de test est momentanément indisponible.", { code: "TEST_GRANT_UNAVAILABLE" });
  }
  const result = Array.isArray(data) ? data[0] : data;
  return json({ enabled: true, active: true, planId: "pro", credits: Number(result?.credits || 1500), status: "active", canRevoke: true });
}

async function revokeTestGrant(req: Request) {
  const supabase = adminClient();
  const userId = await assertTestBillingAccess(req, supabase);
  const { data, error } = await supabase.rpc("revoke_billing_test_grant", { p_user_id: userId });
  if (error) throw new FlowtubeError(503, "La révocation est momentanément indisponible.", { code: "TEST_GRANT_UNAVAILABLE" });
  const result = Array.isArray(data) ? data[0] : data;
  return json({ enabled: true, active: false, planId: result?.plan_id || "free", credits: Number(result?.credits || 0), status: "revoked", canRevoke: false });
}

function normalizePricingModel(row: Record<string, unknown>): PricingModel {
  const type = String(row.media_type || row.type || "image");
  const endpoint = row.fal_endpoint ? String(row.fal_endpoint) : undefined;
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  const provider: PricingModel["provider"] = String(row.provider || metadata.provider || "fal").toLowerCase() === "openrouter" ? "openrouter" : "fal";
  const qualityTier = String(metadata.quality_tier || row.quality_tier || qualityTierForEndpoint(endpoint || String(row.id || "")));
  const marginClass = marginClassForModel(type, qualityTier, endpoint || String(row.id || ""));
  const marginMultiplier = Number(row.margin_multiplier || QUALITY_MARGIN_MULTIPLIERS[marginClass] || MEDIA_MARGIN_MULTIPLIER);
  return {
    id: String(row.id),
    name: String(row.label || row.name || row.id),
    type,
    endpoint,
    provider,
    pricingUnit: String(row.pricing_unit || "unit") as PricingModel["pricingUnit"],
    costPerUnitUsd: Number(row.cost_per_unit_usd || row.costUsd || 0.04),
    defaultUnits: Number(row.default_units || row.duration || 1),
    minimumUnits: Number(row.minimum_units || 1),
    maximumUnits: row.maximum_units ? Number(row.maximum_units) : undefined,
    creditFloorUsd: Number(row.credit_floor_usd || CREDIT_FLOOR_USD),
    retailCreditUsd: Number(row.retail_credit_usd || RETAIL_CREDIT_USD),
    marginMultiplier,
    requiresConfirmation: Boolean(row.requires_confirmation),
    premium: Boolean(row.premium),
    metadata: {
      quality_tier: qualityTier,
      margin_class: marginClass,
      target_margin_ratio: Number(((marginMultiplier - 1) / marginMultiplier).toFixed(3)),
      minimum_margin_ratio: Number(metadata.minimum_margin_ratio || MIN_MEDIA_GROSS_MARGIN_RATIO),
      provider_cost_source: row.provider_cost_source || metadata.provider_cost_source || "legacy",
      pricing_checked_at: row.pricing_checked_at || metadata.pricing_checked_at || null,
      infrastructure_cost_usd: Number(row.infrastructure_cost_usd || metadata.infrastructure_cost_usd || 0),
      storage_cost_usd: Number(row.storage_cost_usd || metadata.storage_cost_usd || 0),
      bandwidth_cost_usd: Number(row.bandwidth_cost_usd || metadata.bandwidth_cost_usd || 0),
      polling_cost_usd: Number(row.polling_cost_usd || metadata.polling_cost_usd || 0),
      input_processing_cost_usd: Number(row.input_processing_cost_usd || metadata.input_processing_cost_usd || 0),
      ...metadata,
    },
  };
}

function sanitizePricingModel(model: PricingModel): PricingModel | null {
  const endpoint = String(model.endpoint || model.id || "").toLowerCase();
  const capabilities = modelCapabilities(model);
  const hasVideoCapability = capabilities.some((capability) =>
    capability.includes("video") || capability === "avatar" || capability === "lipsync"
  );
  const hasAudioCapability = capabilities.some((capability) =>
    ["tts", "speech-to-text", "music", "dubbing", "voice-change"].includes(capability)
  );
  const endpointLooksVideo = /video|veo|kling|seedance|sora|gemini-omni-flash/.test(endpoint);
  const endpointLooksAudio = /audio|tts|speech|dialogue|dubbing|voice|music|scribe|text-to-speech/.test(endpoint);
  const isImageType = model.type === "image" || model.type === "image_edit";
  const hasSecondPricing = model.pricingUnit === "second";

  // Still images are priced per creation. If an old registry/database row
  // labels a duration-priced endpoint as an image, repair the classification
  // before routing, quoting, or exposing it to the client.
  if (isImageType && (hasVideoCapability || endpointLooksVideo)) {
    const nextType: PricingModel["type"] = capabilities.includes("lipsync")
      ? "lipsync"
      : capabilities.some((capability) => ["video-upscale", "video-to-video", "subtitles"].includes(capability))
        ? "video_edit"
        : "video";
    let nextCapabilities = capabilities.filter((capability) => capability !== "text-to-image");
    if (!nextCapabilities.some((capability) => capability.includes("video") || capability === "avatar" || capability === "lipsync")) {
      nextCapabilities = ["text-to-video"];
    }
    return {
      ...model,
      type: nextType,
      pricingUnit: "second",
      metadata: {
        ...(model.metadata || {}),
        capabilities: [...new Set(nextCapabilities)],
        classification_guard: "duration_priced_media_is_video",
      },
    };
  }

  // The same guard applies to legacy audio rows that were imported as images.
  // Audio is priced by characters or duration, never as an image creation.
  if (isImageType && !endpointLooksVideo && (hasAudioCapability || endpointLooksAudio)) {
    const nextCapabilities = capabilities.filter((capability) => capability !== "text-to-image");
    return {
      ...model,
      type: "audio",
      pricingUnit: capabilities.includes("music") || /music|audio-to/i.test(endpoint) ? "second" : "thousand_chars",
      metadata: {
        ...(model.metadata || {}),
        capabilities: [...new Set(nextCapabilities.length ? nextCapabilities : ["tts"])],
        classification_guard: "audio_media_is_not_image",
      },
    };
  }

  // Fail closed for any remaining mismatch. It is safer to hide an invalid
  // row than to present the wrong media type or charge the wrong unit.
  if ((model.type === "image" || model.type === "image_edit") && hasSecondPricing) return null;
  if (["video", "video_edit", "lipsync"].includes(model.type) && model.pricingUnit !== "second") return null;
  if (isImageType && hasVideoCapability) return null;
  return model;
}

function sanitizePricingCatalog(catalog: PricingModel[]) {
  const safe: PricingModel[] = [];
  for (const model of catalog) {
    const sanitized = sanitizePricingModel(model);
    if (!sanitized) continue;
    const quote = quoteFor(sanitized);
    if (!Number.isFinite(quote.credits) || !quote.profitable) continue;
    safe.push(sanitized);
  }
  return priorityModelCatalog(safe);
}

async function pricingCatalog(supabase: ReturnType<typeof adminClient>) {
  const openRouterCatalog = await refreshOpenRouterCatalog();
  await refreshModelPopularity(supabase);
  const liveMediaIds = new Set([
    ...openRouterCatalog.image.map((model) => String(model.id || "")),
    ...openRouterCatalog.video.map((model) => String(model.id || "")),
  ]);
  const remoteById = new Map([
    ...openRouterCatalog.image.map((model) => [String(model.id || ""), model] as const),
    ...openRouterCatalog.video.map((model) => [String(model.id || ""), model] as const),
  ]);
  const baseRegistry = enabledModelRegistry()
    .filter((model) => model.provider !== "openrouter" || liveMediaIds.has(model.id))
    .map((model) => model.provider === "openrouter" ? openRouterMediaModel(model.id, model.type === "video" ? "video" : "image", remoteById.get(model.id)) : model);
  const { data, error } = await supabase.from("pricing_models").select("*").eq("active", true);
  if (!error && data?.length) {
    const dbModels = data.map(normalizePricingModel).filter(isPublicMediaModel);
    const dbById = new Map(dbModels.map((model) => [model.id, model]));
    const merged = baseRegistry.map((registryModel) => {
      const dbModel = dbById.get(registryModel.id);
      if (!dbModel) return registryModel;
      dbById.delete(registryModel.id);
      return {
        ...registryModel,
        // The provider route is authoritative for cost and billing unit. The
        // database may add labels, margin policy and audit metadata, but it
        // must not reintroduce stale prices or turn seconds into image units.
        ...dbModel,
        name: dbModel.name || registryModel.name,
        endpoint: dbModel.endpoint || registryModel.endpoint,
        provider: registryModel.provider,
        costPerUnitUsd: registryModel.costPerUnitUsd,
        pricingUnit: registryModel.pricingUnit,
        metadata: {
          ...registryModel.metadata,
          ...(dbModel.metadata || {}),
          provider: registryModel.provider || "fal.ai",
          ...(registryModel.provider === "openrouter" ? { openrouter_only: true } : { fal_only: true }),
          pricing_source: "supabase_pricing_models",
        },
      };
    });
    for (const model of dbById.values()) {
      const isOpenRouterModel = model.provider === "openrouter";
      const isLiveOpenRouterModel = liveMediaIds.has(model.id);
      if (model.endpoint && (isOpenRouterModel ? isLiveOpenRouterModel : falMediaConfigured())) merged.push({
        ...model,
        metadata: { ...(model.metadata || {}), provider: model.provider || "fal.ai", ...(model.provider === "openrouter" ? { openrouter_only: true } : { fal_only: true }) },
      });
    }
    return publicMediaCatalog(sanitizePricingCatalog(merged));
  }
  return publicMediaCatalog(sanitizePricingCatalog(baseRegistry));
}

function modelCapabilities(model: PricingModel) {
  const raw = (model.metadata || {}).capabilities;
  return Array.isArray(raw) ? raw.map(String) : capabilitiesForEndpoint(String(model.endpoint || ""));
}

function publicMediaFamilyForModel(model: PricingModel): PublicMediaFamily | null {
  const id = String(model.id || "").toLowerCase();
  const endpoint = String(model.endpoint || "").toLowerCase();
  const configuredFamily = String(model.metadata?.huggyflow_family || "").toLowerCase();
  const value = `${id} ${endpoint} ${configuredFamily}`;
  if (id === "google/gemini-3-pro-image" || value.includes("nano-banana-pro")) return "nano-banana-pro";
  if (id === "google/gemini-3.1-flash-image" || value.includes("nano-banana-2")) return "nano-banana-2";
  if (value.includes("soul-2.0") || value.includes("soul id")) return "soul-2.0";
  if (id === "bytedance-seed/seedream-5-0-pro" || value.includes("seedream/v5") || value.includes("seedream-5.0")) return "seedream-5.0";
  if (id === "openai/gpt-image-2" || value.includes("gpt-image-2")) return "gpt-image-2";
  if (id === "bytedance/seedance-2.0" || value.includes("seedance-2.0")) return "seedance-2.0";
  if (id === "bytedance/seedance-2.5" || value.includes("seedance-2.5")) return "seedance-2.5";
  if (id === "kwaivgi/kling-v3.0-pro" || value.includes("kling-video/v3") || value.includes("kling-v3.0")) return "kling-3.0";
  if (id === "google/veo-3.1" || value.includes("veo3.1") || value.includes("veo-3.1")) return "veo-3.1";
  if (id === "google/gemini-omni-flash" || value.includes("gemini-omni-flash")) return "gemini-omni-flash";
  if (id === "alibaba/wan-2.7" || value.includes("wan-2.7")) return "wan-2.7";
  return null;
}

function isPublicMediaModel(model: PricingModel) {
  return Boolean(publicMediaFamilyForModel(model));
}

function publicMediaDefinitionForModel(model: PricingModel) {
  const family = publicMediaFamilyForModel(model);
  return family ? { family, definition: PUBLIC_MEDIA_DEFINITIONS[family] } : null;
}

function publicMediaCatalog(catalog: PricingModel[]) {
  const byFamily = new Map<PublicMediaFamily, PricingModel[]>();
  for (const model of catalog) {
    const family = publicMediaFamilyForModel(model);
    if (!family) continue;
    const list = byFamily.get(family) || [];
    list.push(model);
    byFamily.set(family, list);
  }
  const selected: PricingModel[] = [];
  for (const family of PUBLIC_MEDIA_FAMILIES) {
    const candidates = byFamily.get(family) || [];
    // OpenRouter is preferred; FAL remains a real fallback for the same family.
    candidates.sort((a, b) => {
      const providerPriority = Number(b.provider === "openrouter") - Number(a.provider === "openrouter");
      if (providerPriority) return providerPriority;
      const endpointScore = (candidate: PricingModel) => {
        const endpoint = String(candidate.endpoint || "").toLowerCase();
        if (candidate.type === "image" && endpoint.includes("text-to-image")) return 3;
        if (candidate.type === "image" && !endpoint.includes("edit") && !endpoint.includes("image-to-image")) return 2;
        if (candidate.type === "video" && endpoint.includes("text-to-video")) return 3;
        if (endpoint.includes("reference-to-video") || endpoint.includes("image-to-video")) return 2;
        return endpoint.includes("edit") ? 1 : 0;
      };
      return endpointScore(b) - endpointScore(a) || a.costPerUnitUsd - b.costPerUnitUsd;
    });
    const model = candidates.find((candidate) => quoteFor(candidate).profitable);
    if (!model) continue;
    const familyModels = candidates.filter((candidate) => candidate !== model);
    const publicCapabilities = [...new Set(candidates.flatMap((candidate) => modelCapabilities(candidate)))];
    const routeVariants = familyModels.map((candidate) => ({
      endpoint: candidate.endpoint,
      provider: candidate.provider,
      capabilities: modelCapabilities(candidate),
      costPerUnitUsd: candidate.costPerUnitUsd,
      pricingUnit: candidate.pricingUnit,
      maximumUnits: candidate.maximumUnits || null,
    }));
    selected.push({
      ...model,
      name: PUBLIC_MEDIA_DEFINITIONS[family].name,
      type: PUBLIC_MEDIA_DEFINITIONS[family].type,
      metadata: {
        ...(model.metadata || {}),
        huggyflow_family: family,
        public_capabilities: publicCapabilities.length ? publicCapabilities : PUBLIC_MEDIA_DEFINITIONS[family].capabilities,
        route_variants: routeVariants,
        provider_fallback_available: familyModels.length > 0,
      },
    });
  }
  return priorityModelCatalog(selected);
}

function normalizeMediaType(type: string, body: Record<string, unknown> = {}) {
  const normalized = String(type || "").toLowerCase().trim();
  if (normalized === "upscale") {
    return body.videoUrl || body.video_url || body.sourceVideoUrl || body.source_video_url
      ? "video_edit"
      : "image_edit";
  }
  return normalized;
}

function requestTypeFromBody(body: Record<string, unknown>, prompt: string) {
  const explicitType = String(body.type || "").toLowerCase();
  const raw = String(body.mode || "").toLowerCase();
  const allowedTypes = ["image", "video", "audio", "document", "lipsync", "image_edit", "video_edit", "upscale", "voice_clone"];
  if (allowedTypes.includes(explicitType)) return normalizeMediaType(explicitType, body);
  if (raw === "document") return "document";
  const text = stripAccents(prompt.toLowerCase());
  if (/lip[-\s]?sync|synchronise.*l[eè]vres|doublage.*l[eè]vres/.test(text)) return "lipsync";
  if (/clone.*voix|clonage.*voix|voice clone|digital twin/.test(text)) return "voice_clone";
  if (/musique|music|chanson|soundtrack|bande son|tts|voix off|voice over|audio|doublage|transcri/.test(text)) return "audio";
  if (/retouche|modifier|edite|edit|background|arriere-plan|upscale|agrandir|remove/.test(text) && raw === "image") return "image_edit";
  if (/reframe|extend|prolonge|upscale.*video|sous-titre|subtitle|fond.*video|restyle|style.*video|transform.*video|remix.*video|runway/.test(text) && (raw === "video" || Boolean(body.videoUrl || body.video_url))) return "video_edit";
  if (/\b(video|clip|reels?|tiktok|ugc|pub video|spot|storyboard anime|animation)\b/.test(text)) return "video";
  if (/\b(image|photo|visuel|affiche|poster|miniature|thumbnail|packshot)\b/.test(text)) return raw === "video" ? "video" : "image";
  if (allowedTypes.includes(raw)) return normalizeMediaType(raw, body);
  return "image";
}

function requestedCapability(type: string, prompt: string, body: Record<string, unknown>) {
  const text = prompt.toLowerCase();
  const hasImageRef = Boolean(body.imageUrl || body.referenceImageUrl || body.firstFrameUrl || body.referenceUrls);
  const hasVideoRef = Boolean(body.videoUrl || body.sourceVideoUrl);
  if (type === "image" && /logo|poster|affiche|image|photo|visuel|illustration|packshot|portrait/.test(text)) return "text-to-image";
  if (type === "image_edit") {
    if (/remove|supprime.*fond|background|arriere-plan/.test(text)) return "remove-background";
    if (/outpaint|etendre|agrandir/.test(text)) return "outpaint";
    if (/upscale|ameliore.*resolution|haute resolution/.test(text)) return "image-upscale";
    return hasImageRef ? "edit" : "image-to-image";
  }
  if (type === "video") {
    if (body.firstFrameUrl || body.lastFrameUrl || /first.*last|dernier.*frame/.test(text)) return "first-last-frame-to-video";
    if (/reference|meme personnage|coherence|avatar/.test(text)) return "reference-to-video";
    if (hasImageRef || /anime|animer|image vers video|photo vers video/.test(text)) return "image-to-video";
    return "text-to-video";
  }
  if (type === "video_edit") {
    if (/extend|prolonge/.test(text)) return "extend-video";
    if (/upscale|4k|resolution/.test(text)) return "video-upscale";
    if (/sous-titre|subtitle/.test(text)) return "subtitles";
    return hasVideoRef ? "video-to-video" : "video-to-video";
  }
  if (type === "lipsync") return "lipsync";
  if (type === "voice_clone") return "voice-clone";
  if (type === "audio") {
    if (/musique|music|chanson|soundtrack/.test(text)) return "music";
    if (/transcri|speech.?to.?text|scribe/.test(text)) return "speech-to-text";
    if (/doublage|translate|tradu/.test(text)) return "dubbing";
    return "tts";
  }
  return type === "video" ? "text-to-video" : "text-to-image";
}

function aspectRatioForRequest(body: Record<string, unknown>, prompt: string, type: string) {
  if (isUgcPipelineRequest(prompt) && type === "video") return "9:16";
  return String(body.aspectRatio || body.aspect_ratio || "4:5");
}

function requestedUnitsForModel(model: PricingModel, body: Record<string, unknown>, prompt: string, type: string) {
  if (model.pricingUnit === "second") {
    return Number(body.duration || body.durationSeconds || (isUgcPipelineRequest(prompt) && type === "video" ? 15 : model.defaultUnits));
  }
  return Number(body.units || model.defaultUnits);
}

function scoreModel(model: PricingModel, type: string, capability: string, prompt: string) {
  if (model.type !== type) return -1000;
  const caps = modelCapabilities(model);
  if (!caps.includes(capability)) return -200;
  const text = prompt.toLowerCase();
  const tier = String((model.metadata || {}).quality_tier || "standard");
  const family = String(model.metadata?.huggyflow_family || "").toLowerCase();
  let score = 100;
  score += tier === "premium" ? 40 : tier === "standard" ? 24 : 12;
  if (model.premium) score += 12;
  const endpoint = String(model.endpoint || "").toLowerCase();
  if (/4k|ultra|maximum|cinema|pub|premium|qualite|qualité/.test(text) && endpoint.includes("4k")) score += 35;
  if (/rapide|vite|draft|test|brouillon/.test(text) && /fast|turbo|schnell|mini|lite/.test(endpoint)) score += 28;
  if (/personnage|avatar|humain|face|visage|talking head/.test(text) && /heygen|omnihuman|avatar|sync-lipsync/.test(endpoint)) score += 30;
  if (/cinema|cinematique|realiste|camera|mouvement/.test(text) && /veo|kling|ray|seedance/.test(endpoint)) score += 24;
  if (/image|photo|visuel|affiche|packshot|logo/.test(text) && /gpt-image-2|nano-banana|flux-2|gemini/.test(endpoint)) score += 22;
  if (/ugc|createur|face camera|temoignage|testimonial|tiktok|reels/.test(text) && endpoint.includes("kling-video/v3")) score += 40;
  if (/visage|portrait|createur|creator|ugc|personne/.test(text) && endpoint.includes("nano-banana-pro")) score += 28;
  if (capability.includes("video") && /seedance-2.0|kling-video\/v3|veo3.1|ray\/v3.2|grok-imagine-video/.test(endpoint)) score += 18;
  if (/premium|hero|final|haut de gamme|cinema|cinematique/.test(text) && family === "sora-2") score += 32;
  if (/style|transform|transforme|remix|restyle|retouche video/.test(text) && family === "gemini-omni-flash") score += 36;
  if (/vector|vecteur|logo|charte|brand style|typographie/.test(text) && family === "recraft-v3") score += 34;
  if (/coherence|cohérent|personnage|character|reference|référence|meme personne/.test(text) && String(model.metadata?.reference_strategy || "").includes("reference")) score += 24;
  if (/voix|voice|tts|narration|doublage|audio|musique|music/.test(text) && family === "elevenlabs-v3") score += 36;
  if (/upscale|4k|nettoie|resolution|résolution|fini|finish/.test(text) && family === "topaz-upscale") score += 40;
  if (/rapid|rapide|test|brouillon/.test(text) && (family === "gemini-omni-flash" || endpoint.includes("fast"))) score += 18;
  score -= Math.min(30, quoteFor(model).credits / 80);
  return score;
}

function resolveBestModelFromCatalog(catalog: PricingModel[], modelId: string | undefined, type: string, prompt = "", body: Record<string, unknown> = {}) {
  const explicit = String(modelId || "").toLowerCase();
  if (explicit && explicit !== "auto" && explicit !== "huggy-auto") {
    return resolveModelFromCatalog(catalog, modelId, type);
  }
  const capability = requestedCapability(type, prompt, body);
  const ranked = catalog
    .map((model) => ({ model, score: scoreModel(model, type, capability, prompt) }))
    .filter((item) => item.score > -100)
    .sort((a, b) => b.score - a.score);
  if (ranked[0]?.model) return ranked[0].model;

  // The public catalog intentionally exposes one compact family entry. If
  // that entry cannot satisfy a reference/edit capability, resolve Auto
  // against the full verified registry so a real FAL route can take over.
  const compatibleRegistry = sanitizePricingCatalog(enabledModelRegistry())
    .filter((model) => model.type === type && modelCapabilities(model).includes(capability))
    .sort((a, b) => scoreModel(b, type, capability, prompt) - scoreModel(a, type, capability, prompt));
  return compatibleRegistry[0] || resolveModelFromCatalog(catalog, undefined, type);
}

function assertModelCapability(model: PricingModel, type: string, prompt: string, body: Record<string, unknown>) {
  const capability = requestedCapability(type, prompt, body);
  if (modelCapabilities(model).includes(capability)) return;
  throw new FlowtubeError(409, "Cette capacité n’est pas disponible avec le modèle sélectionné. Choisis Auto ou une autre configuration.", {
    code: "MODEL_CAPABILITY_UNAVAILABLE",
    capability,
  });
}

function resolveModelFromCatalog(catalog: PricingModel[], modelId: string | undefined, type: string) {
  const rawRequestedId = String(modelId || "").trim();
  const requestedId = internalModelId(rawRequestedId);
  const matchesRequestedModel = (model: PricingModel) => model.type === type && (
    model.id === requestedId
    || model.id === rawRequestedId
    || publicModelKey(model.id) === rawRequestedId
    || String(model.metadata?.model_key || "") === rawRequestedId
  );
  const cheapestCompatible = [...catalog.filter((m) => m.type === type)]
    .sort((a, b) => quoteFor(a).credits - quoteFor(b).credits)[0];
  const registry = sanitizePricingCatalog(enabledModelRegistry());
  const cheapestRegistry = [...registry.filter((m) => m.type === type)]
    .sort((a, b) => quoteFor(a).credits - quoteFor(b).credits)[0];
  return catalog.find(matchesRequestedModel)
    || cheapestCompatible
    || registry.find(matchesRequestedModel)
    || cheapestRegistry
    || registry[0];
}

function unitsFor(model: PricingModel, requestedUnits?: number) {
  const raw = Number(requestedUnits || model.defaultUnits || 1);
  const min = Math.max(model.minimumUnits || 1, 0.01);
  const max = model.maximumUnits || raw;
  return Math.max(min, Math.min(raw, max));
}

function quoteFor(model: PricingModel, requestedUnits?: number): PricingQuote {
  const units = unitsFor(model, requestedUnits);
  const providerCostUsd = Number((model.costPerUnitUsd * units).toFixed(4));
  const infrastructureCostUsd = mediaInfrastructureCostUsd(model, units);
  const protectedCostUsd = Math.max(protectedOperatingCostUsd(providerCostUsd, infrastructureCostUsd), 0.0005);
  const credits = Math.max(1, Math.ceil((protectedCostUsd * model.marginMultiplier) / model.creditFloorUsd));
  const revenueFloorUsd = Number((credits * model.creditFloorUsd).toFixed(4));
  const revenueRetailUsd = Number((credits * model.retailCreditUsd).toFixed(4));
  const grossMarginFloorUsd = Number((revenueFloorUsd - protectedCostUsd).toFixed(4));
  const grossMarginRetailUsd = Number((revenueRetailUsd - protectedCostUsd).toFixed(4));
  const grossMarginFloorRatio = ratioFromAmounts(revenueFloorUsd, protectedCostUsd);
  const grossMarginRetailRatio = ratioFromAmounts(revenueRetailUsd, protectedCostUsd);
  const minimumMarginRatio = minimumMarginRatioForModel(model);
  return {
    credits,
    units,
    providerCostUsd,
    infrastructureCostUsd,
    protectedCostUsd,
    revenueFloorUsd,
    revenueRetailUsd,
    grossMarginFloorUsd,
    grossMarginRetailUsd,
    grossMarginFloorRatio,
    grossMarginRetailRatio,
    minimumMarginRatio,
    marginMultiplier: model.marginMultiplier,
    profitable: grossMarginFloorRatio >= minimumMarginRatio && credits <= MAX_MEDIA_CREDITS_PER_GENERATION,
    requiresConfirmation: model.requiresConfirmation || credits >= EXPENSIVE_CREDIT_THRESHOLD,
  };
}

function creditsFor(model: PricingModel, duration?: number) {
  return quoteFor(model, duration).credits;
}

function publicPricingModels(catalog: PricingModel[]) {
  const media = sanitizePricingCatalog(catalog)
    .map((model, index) => ({ model, index }))
    .sort((a, b) => {
      const countA = modelPopularityCache.counts.get(a.model.id) || 0;
      const countB = modelPopularityCache.counts.get(b.model.id) || 0;
      return countB - countA || a.index - b.index;
    })
    .map(({ model }) => {
    const quote = quoteFor(model);
    const publicInfo = publicMediaDefinitionForModel(model);
    if (!publicInfo) return null;
    const { family, definition } = publicInfo;
    const modelKey = rememberPublicModel(model.id);
    const capabilities = Array.isArray(model.metadata?.public_capabilities)
      ? model.metadata.public_capabilities.map(String)
      : modelCapabilities(model);
    const creditsLabel = model.pricingUnit === "second"
      ? `${quote.credits} credits pour ${Math.round(quote.units)} secondes`
      : `${quote.credits} credits par ${model.pricingUnit === "thousand_chars" ? "1 000 caracteres" : "creation"}`;
    return {
      id: modelKey,
      modelKey,
      name: definition.name,
      description: definition.description,
      family,
      type: definition.type,
      pricingUnit: model.pricingUnit,
      defaultUnits: model.defaultUnits,
      minimumUnits: model.minimumUnits,
      maximumUnits: model.maximumUnits || null,
      creditsPerDefaultUnit: quote.credits,
      qualityTier: String(model.metadata?.quality_tier || "standard"),
      capabilities,
      available: true,
      creditsLabel,
      costLabel: creditsLabel,
    };
  }).filter(Boolean);
  // Agent LLMs remain available through `agentModels` for chat orchestration,
  // but are intentionally not mixed into the curated media model catalog.
  return media;
}

function mediaInfrastructureCostUsd(model: PricingModel, units: number) {
  const providerUnits = Math.max(1, Math.ceil(units));
  const metadata = model.metadata || {};
  const storage = Number(metadata.storage_cost_usd || 0) || INFRA_MEDIA_STORAGE_USD;
  const bandwidth = Number(metadata.bandwidth_cost_usd || 0) || INFRA_MEDIA_BANDWIDTH_USD;
  const inputProcessing = Number(metadata.input_processing_cost_usd || 0) || INFRA_MEDIA_INPUT_USD;
  const polling = Number(metadata.polling_cost_usd || 0) || INFRA_MEDIA_POLLING_USD;
  const baseInfrastructure = Number(metadata.infrastructure_cost_usd || 0)
    || (model.pricingUnit === "second" ? INFRA_VIDEO_BASE_USD : INFRA_IMAGE_BASE_USD);
  const shared = storage + bandwidth + inputProcessing;
  if (model.pricingUnit === "second") {
    return Number((baseInfrastructure + providerUnits * INFRA_VIDEO_PER_SECOND_USD + polling + shared).toFixed(6));
  }
  if (model.type === "image" || model.type === "image_edit") return Number((baseInfrastructure + shared).toFixed(6));
  return Number((INFRA_TEXT_BASE_USD + units * INFRA_TEXT_TOKEN_USD + shared).toFixed(6));
}

async function assertSecuritySessionActive(req: Request, supabase: ReturnType<typeof adminClient>, userId: string, token: string) {
  if (!token || token.startsWith("hf_")) return;
  const sessionHash = await sha256Hex(token);
  const { data, error } = await supabase.from("user_security_sessions").select("revoked_at").eq("user_id", userId).eq("session_hash", sessionHash).maybeSingle();
  // Keep legacy deployments usable until the close-audit migration is applied.
  if (!error && data?.revoked_at) throw new FlowtubeError(401, "Cette session a ete revoquee. Reconnecte-toi pour continuer.", { code: "SESSION_REVOKED" });
}

function normalizePlanId(plan: string | null | undefined) {
  const id = String(plan || "free").toLowerCase();
  if (id === "starter") return "basic";
  if (id === "studio") return "max";
  return id;
}

function normalizePlan(row: Record<string, unknown>): PlanLimits {
  const id = normalizePlanId(String(row.id || "free"));
  const envKey = (suffix: string) => Deno.env.get(`STRIPE_PRICE_${id.toUpperCase()}_${suffix}`);
  const numeric = (value: unknown, fallback: number) => value === null || value === undefined || value === "" ? fallback : Number(value);
  const metadata = (row.metadata as Record<string, unknown> | undefined) || {};
  return {
    id,
    displayName: String(row.display_name || row.displayName || id),
    includedCredits: numeric(row.included_credits, 0),
    monthlyPriceUsd: numeric(row.monthly_price_usd, 0),
    annualPriceUsd: numeric(row.annual_price_usd, 0),
    monthlyPriceXof: numeric(row.monthly_price_xof ?? metadata.monthly_price_xof, 0),
    annualPriceXof: numeric(row.annual_price_xof ?? metadata.annual_price_xof, 0),
    pricingVersion: String(row.pricing_version ?? metadata.pricing_version ?? "legacy"),
    monthlyMessageLimit: numeric(row.monthly_message_limit, 300),
    dailyMessageLimit: numeric(row.daily_message_limit, 50),
    dailyImageLimit: numeric(row.daily_image_limit, id === "free" ? 3 : id === "basic" ? 10 : 30),
    dailyVideoLimit: numeric(row.daily_video_limit, 1),
    concurrentImageJobs: numeric(row.concurrent_image_jobs, 1),
    concurrentVideoJobs: numeric(row.concurrent_video_jobs, 0),
    allowedMediaTypes: (row.allowed_media_types as string[]) || ["image"],
    watermarkRequired: Boolean(row.watermark_required),
    mediaRetentionDays: numeric(row.media_retention_days, 30),
    storageGb: numeric(row.storage_gb, 1),
    maxUploadMb: numeric(row.max_upload_mb, 25),
    seatLimit: numeric(row.seat_limit, 1),
    supportLevel: String(row.support_level || "community"),
    priorityQueue: Boolean(row.priority_queue),
    stripeMonthlyPriceId: String(row.stripe_monthly_price_id || envKey("MONTHLY") || ""),
    stripeAnnualPriceId: String(row.stripe_annual_price_id || envKey("ANNUAL") || ""),
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

async function resolvePlan(supabase: ReturnType<typeof adminClient>, plan: string | null | undefined) {
  const normalized = normalizePlanId(plan);
  const { data, error } = await supabase.from("pricing_plans").select("*").eq("id", normalized).eq("active", true).maybeSingle();
  if (!error && data) return normalizePlan(data);
  if (normalized === "free") return FREE_FALLBACK_PLAN;
  throw new FlowtubeError(503, "Le tarif demande est momentanement indisponible.", {
    code: "ACTIVE_PLAN_NOT_FOUND",
    planId: normalized,
  });
}

async function publicPricingPlans(supabase: ReturnType<typeof adminClient>) {
  const { data, error } = await supabase.from("pricing_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    throw new FlowtubeError(503, "Les tarifs sont momentanement indisponibles.", { code: "PRICING_UNAVAILABLE" });
  }
  const plans = (data || []).map((row) => normalizePlan(row as Record<string, unknown>));
  if (!plans.length) {
    throw new FlowtubeError(503, "Aucun tarif actif n'est configure.", { code: "NO_ACTIVE_PRICING" });
  }
  const { data: options } = await supabase.from("pricing_plan_options")
    .select("id,plan_id,credits,monthly_price_xof,annual_price_xof,sort_order,metadata")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  const optionsByPlan = new Map<string, Record<string, unknown>[]>();
  for (const row of options || []) {
    const planId = String(row.plan_id || "");
    const list = optionsByPlan.get(planId) || [];
    list.push({
      id: String(row.id),
      credits: Number(row.credits || 0),
      monthlyPriceXof: Number(row.monthly_price_xof || 0),
      annualPriceXof: Number(row.annual_price_xof || 0),
      metadata: row.metadata || {},
    });
    optionsByPlan.set(planId, list);
  }
  return plans.map((plan) => ({
    ...planPublic(plan),
    creditOptions: optionsByPlan.get(plan.id) || [],
  }));
}

function planAmountXof(plan: PlanLimits, interval: "monthly" | "annual") {
  const explicit = interval === "annual" ? plan.annualPriceXof : plan.monthlyPriceXof;
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  return usdToXof(interval === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd);
}

function planPublic(plan: PlanLimits) {
  const monthlyBaseXof = plan.monthlyPriceUsd > 0 ? planAmountXof(plan, "monthly") : 0;
  const annualBaseXof = plan.annualPriceUsd > 0 ? planAmountXof(plan, "annual") : 0;
  return {
    id: plan.id,
    displayName: plan.displayName,
    includedCredits: plan.includedCredits,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    annualPriceUsd: plan.annualPriceUsd,
    monthlyPriceXof: monthlyBaseXof,
    annualPriceXof: annualBaseXof,
    pricingVersion: plan.pricingVersion,
    currency: DEFAULT_BILLING_CURRENCY,
    usdXofRate: DEFAULT_USD_XOF_RATE,
    monthlyMessageLimit: plan.monthlyMessageLimit,
    dailyMessageLimit: plan.dailyMessageLimit,
    dailyImageLimit: plan.dailyImageLimit,
    dailyVideoLimit: plan.dailyVideoLimit,
    concurrentImageJobs: plan.concurrentImageJobs,
    concurrentVideoJobs: plan.concurrentVideoJobs,
    allowedMediaTypes: plan.allowedMediaTypes,
    watermarkRequired: plan.watermarkRequired,
    mediaRetentionDays: plan.mediaRetentionDays,
    storageGb: plan.storageGb,
    maxUploadMb: plan.maxUploadMb,
    seatLimit: plan.seatLimit,
    supportLevel: plan.supportLevel,
    priorityQueue: plan.priorityQueue,
    checkoutEnabled: Boolean(plan.metadata.checkout !== false && (plan.monthlyPriceUsd > 0 || plan.annualPriceUsd > 0)),
    checkoutAmounts: { monthlyXof: monthlyBaseXof, annualXof: annualBaseXof },
    paymentFees: { configured: true, included: true },
    metadata: {
      badge: plan.metadata.badge || null,
      tagline: plan.metadata.tagline || plan.metadata.description || null,
      audience: plan.metadata.audience || null,
      popular: Boolean(plan.metadata.popular || plan.metadata.best_value),
      checkout: plan.metadata.checkout !== false,
    },
  };
}

function stripeSecret() {
  return Deno.env.get("STRIPE_SECRET_KEY") || "";
}

function stripePriceForPlan(plan: PlanLimits, interval: string) {
  if (interval === "annual") return plan.stripeAnnualPriceId || Deno.env.get(`STRIPE_PRICE_${plan.id.toUpperCase()}_ANNUAL`) || "";
  return plan.stripeMonthlyPriceId || Deno.env.get(`STRIPE_PRICE_${plan.id.toUpperCase()}_MONTHLY`) || "";
}

function stripePriceForPack(pack: Record<string, unknown>) {
  return String(pack.stripe_price_id || Deno.env.get(`STRIPE_PRICE_PACK_${String(pack.id).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`) || "");
}

function moneyFusionCheckoutUrl() {
  return Deno.env.get("MONEYFUSION_CHECKOUT_URL") || Deno.env.get("MONEYFUSION_API_URL") || DEFAULT_MONEYFUSION_CHECKOUT_URL;
}

function moneyFusionApiKey() {
  return Deno.env.get("MONEYFUSION_API_KEY") || Deno.env.get("MONEYFUSION_PRIVATE_KEY") || "";
}

function moneyFusionConfigured() {
  return Boolean(moneyFusionCheckoutUrl() && moneyFusionApiKey());
}

function moneyFusionFeeConfig() {
  const percentRaw = Deno.env.get("MONEYFUSION_FEE_PERCENT");
  const fixedRaw = Deno.env.get("MONEYFUSION_FEE_FIXED_XOF");
  const percent = percentRaw === undefined ? 0 : Math.max(0, Number(percentRaw) || 0);
  const fixedXof = fixedRaw === undefined ? 0 : Math.max(0, Math.round(Number(fixedRaw) || 0));
  return {
    percent,
    fixedXof,
    configured: percentRaw !== undefined || fixedRaw !== undefined,
    source: "MONEYFUSION_FEE_PERCENT + MONEYFUSION_FEE_FIXED_XOF",
  };
}

function moneyFusionFeeXof(baseXof: number) {
  const base = Math.max(0, Math.round(Number(baseXof) || 0));
  const config = moneyFusionFeeConfig();
  return base > 0 ? Math.ceil(base * config.percent / 100) + config.fixedXof : 0;
}

function moneyFusionCheckoutAmountXof(baseXof: number) {
  // The displayed catalogue price is the checkout price. Provider fees are an
  // internal cost and must not become an undisclosed surcharge.
  return Math.max(0, Math.round(Number(baseXof) || 0));
}

function moneyFusionCallbackUrl() {
  return Deno.env.get("MONEYFUSION_CALLBACK_URL") || `${APP_BASE_URL}/callback`;
}

function moneyFusionReturnUrl() {
  return Deno.env.get("MONEYFUSION_RETURN_URL") || `${APP_BASE_URL}/?checkout=success`;
}

function moneyFusionAmount(usd: number) {
  const currency = DEFAULT_BILLING_CURRENCY;
  if (currency === "USD") return Number(usd.toFixed(2));
  const rate = DEFAULT_USD_XOF_RATE;
  if (!rate) throw new FlowtubeError(503, "MoneyFusion est prepare, mais MONEYFUSION_USD_RATE manque pour convertir les tarifs.", { code: "MONEYFUSION_RATE_MISSING", currency });
  const amount = Math.round(usd * rate);
  if (amount < 200) throw new FlowtubeError(400, "Le montant MoneyFusion doit etre au moins de 200 FCFA.", { code: "MONEYFUSION_AMOUNT_TOO_LOW" });
  return amount;
}

function usdToXof(usd: number) {
  return Math.round(Number(usd || 0) * DEFAULT_USD_XOF_RATE);
}

function moneyFusionPaymentUrl(data: Record<string, unknown>) {
  const nested = (data.data || data.result || {}) as Record<string, unknown>;
  return String(data.url || data.payment_url || data.paymentUrl || data.link || nested.url || nested.payment_url || nested.paymentUrl || nested.link || "");
}

function moneyFusionDirectPaymentUrl(payload: Record<string, unknown>) {
  const base = moneyFusionCheckoutUrl();
  const url = new URL(base);
  const articles = Array.isArray(payload.article) ? payload.article as Record<string, unknown>[] : [];
  const articleName = articles.length ? String(articles[0].nom || articles[0].name || APP_NAME) : String(payload.article || APP_NAME);
  const params: Record<string, string> = {
    reference: String(payload.reference || ""),
    amount: String(payload.totalPrice || ""),
    totalPrice: String(payload.totalPrice || ""),
    currency: String(payload.currency || DEFAULT_BILLING_CURRENCY),
    article: articleName,
    callback_url: String(payload.callback_url || ""),
    webhook_url: String(payload.webhook_url || ""),
    return_url: String(payload.return_url || ""),
  };
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url.toString();
}

function moneyFusionCanFallbackToDirect(url: string) {
  return Deno.env.get("MONEYFUSION_DIRECT_CHECKOUT") === "true" && /pay\.moneyfusion\.net/i.test(url);
}

function moneyFusionToken(data: Record<string, unknown>) {
  const nested = (data.data || data.result || {}) as Record<string, unknown>;
  return String(data.token || data.tokenPay || data.token_pay || data.payment_token || data.paymentToken || data.transaction_id || data.reference || nested.token || nested.tokenPay || nested.token_pay || nested.payment_token || nested.paymentToken || nested.transaction_id || nested.reference || "");
}

function moneyFusionStatusValue(data: Record<string, unknown>) {
  const nested = (data.data || data.result || data.payment || {}) as Record<string, unknown>;
  return String(data.status || data.statut || data.payment_status || data.etat || data.state || nested.status || nested.statut || nested.payment_status || nested.etat || nested.state || "").toLowerCase();
}

function moneyFusionPaid(data: Record<string, unknown>) {
  const rawStatus = moneyFusionStatusValue(data);
  return ["paid", "success", "successful", "completed", "complete", "approved", "valid", "valide", "succeeded", "succes", "ok"].some((s) => rawStatus.includes(s));
}

function moneyFusionDeclined(data: Record<string, unknown>) {
  return data.statut === false || data.success === false || data.ok === false;
}

function moneyFusionMessage(data: Record<string, unknown>) {
  const nested = cleanMetadata(data.data || data.result);
  return String(data.message || data.error || nested.message || nested.error || "").trim();
}

function moneyFusionPhone(value: unknown) {
  const raw = String(value || "").trim();
  const normalized = raw.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{8,16}$/.test(normalized)) return "";
  return normalized;
}

function moneyFusionTrustedPaymentUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "moneyfusion.net" || url.hostname.endsWith(".moneyfusion.net"));
  } catch (_err) {
    return false;
  }
}

function moneyFusionSafeAppUrl(value: unknown, fallback: string) {
  try {
    const candidate = new URL(String(value || fallback));
    const app = new URL(APP_BASE_URL);
    return candidate.origin === app.origin ? candidate.toString() : fallback;
  } catch (_err) {
    return fallback;
  }
}

function moneyFusionHeaders() {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = moneyFusionApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["moneyfusion-private-key"] = apiKey;
  }
  return headers;
}

function moneyFusionStatusUrl(token: string) {
  if (!token) return "";
  return String(Deno.env.get("MONEYFUSION_STATUS_URL") || DEFAULT_MONEYFUSION_STATUS_URL)
    .replace("{token}", encodeURIComponent(token));
}

async function moneyFusionRequest(payload: Record<string, unknown>) {
  const url = moneyFusionCheckoutUrl();
  if (!url || !moneyFusionApiKey()) {
    throw new FlowtubeError(503, "Le paiement MoneyFusion est en cours de configuration. Reessaie dans quelques instants.", { code: "MONEYFUSION_NOT_CONFIGURED" });
  }
  const headers: Record<string, string> = { ...moneyFusionHeaders(), "Content-Type": "application/json" };
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(3000, Number(Deno.env.get("MONEYFUSION_TIMEOUT_MS") || 12000)));
  try {
    response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal });
  } catch (_err) {
    throw new FlowtubeError(503, "MoneyFusion est momentanement sature. Reessaie dans une minute.", { code: "MONEYFUSION_UNAVAILABLE" });
  } finally {
    clearTimeout(timeout);
  }
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
  if (!response.ok) {
    throw new FlowtubeError(response.status === 429 || response.status >= 500 ? 503 : response.status, response.status >= 500 ? "MoneyFusion est momentanement sature. Reessaie dans une minute." : "MoneyFusion a refuse la creation du paiement.", { code: "MONEYFUSION_ERROR", moneyfusion: data, status: response.status });
  }
  if (moneyFusionDeclined(data)) {
    throw new FlowtubeError(502, moneyFusionMessage(data) || "MoneyFusion a refuse la creation du paiement.", { code: "MONEYFUSION_DECLINED" });
  }
  const paymentUrl = moneyFusionPaymentUrl(data);
  const token = moneyFusionToken(data);
  if (!paymentUrl || !moneyFusionTrustedPaymentUrl(paymentUrl)) {
    throw new FlowtubeError(502, "MoneyFusion n'a pas renvoye d'URL de paiement.", { code: "MONEYFUSION_URL_MISSING", moneyfusion: data });
  }
  if (!token) throw new FlowtubeError(502, "MoneyFusion n'a pas renvoye de reference de paiement.", { code: "MONEYFUSION_TOKEN_MISSING" });
  return { data, paymentUrl, token };
}

async function moneyFusionLookupPayment(token: string): Promise<Record<string, unknown>> {
  const url = moneyFusionStatusUrl(token);
  if (!url) return {};
  const response = await fetch(url, { method: "GET", headers: moneyFusionHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || moneyFusionDeclined(data)) throw new Error(moneyFusionMessage(data) || `MoneyFusion status ${response.status}`);
  return data;
}

function formBody(params: Record<string, string | number | boolean | null | undefined>) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") body.set(key, String(value));
  }
  return body;
}

async function stripeRequest(path: string, params?: Record<string, string | number | boolean | null | undefined>) {
  const key = stripeSecret();
  if (!key) {
    throw new FlowtubeError(503, "Stripe n'est pas encore configure. Ajoute STRIPE_SECRET_KEY et les Price IDs.", { code: "STRIPE_NOT_CONFIGURED" });
  }
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? formBody(params) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Stripe request failed";
    throw new FlowtubeError(response.status, message, { code: "STRIPE_ERROR", stripe: data?.error || data });
  }
  return data;
}

async function ensureBillingCustomer(supabase: ReturnType<typeof adminClient>, profile: Record<string, unknown>) {
  if (profile.stripe_customer_id) return String(profile.stripe_customer_id);
  const email = String(profile.email || profile.billing_email || `guest-${profile.id}@huggyflow.fun`);
  const existing = await supabase.from("billing_customers").select("*").eq("user_id", profile.id).maybeSingle();
  if (existing.data?.stripe_customer_id) return String(existing.data.stripe_customer_id);
  const stripe = await stripeRequest("/customers", {
    email,
    name: String(profile.display_name || `${APP_NAME} user`),
    "metadata[user_id]": String(profile.id),
  });
  await supabase.from("billing_customers").upsert({
    user_id: profile.id,
    stripe_customer_id: stripe.id,
    email,
    name: String(profile.display_name || ""),
    currency: String(profile.currency || DEFAULT_BILLING_CURRENCY.toLowerCase()),
  }, { onConflict: "user_id" });
  await supabase.from("profiles").update({ stripe_customer_id: stripe.id, billing_email: email }).eq("id", profile.id);
  return String(stripe.id);
}

async function sendTransactionalEmail(supabase: ReturnType<typeof adminClient>, userId: string | null, to: string, template: string, subject: string, html: string, metadata: Record<string, unknown> = {}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey || !to) {
    await supabase.from("email_events").insert({ user_id: userId, template, to_email: to || null, subject, status: "skipped", metadata });
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("FLOWTUBE_EMAIL_FROM") || `${APP_NAME} <noreply@huggyflow.fun>`,
        to,
        subject,
        html,
      }),
    });
    const data = await response.json().catch(() => ({}));
    await supabase.from("email_events").insert({ user_id: userId, template, to_email: to, subject, status: response.ok ? "sent" : "failed", provider_message_id: data?.id || null, metadata: { ...metadata, response: data } });
  } catch (err) {
    await supabase.from("email_events").insert({ user_id: userId, template, to_email: to, subject, status: "failed", metadata: { ...metadata, error: err instanceof Error ? err.message : "email failed" } });
  }
}

function moderationDecision(prompt: string) {
  const text = prompt.toLowerCase();
  const blocked = [
    /abus sexuel|mineur sexuel|child sexual|csam/,
    /fabrique.*bombe|explosif maison|arme biologique/,
    /voler une carte|pirater un compte|steal credit card/,
  ];
  if (blocked.some((pattern) => pattern.test(text))) {
    return { decision: "blocked", reason: "policy_safety" };
  }
  const review = [/nudite/, /gore/, /violence graphique/, /deepfake/, /usurpation/];
  return review.some((pattern) => pattern.test(text)) ? { decision: "review", reason: "needs_review" } : { decision: "approved", reason: "" };
}

async function enforcePromptPolicy(supabase: ReturnType<typeof adminClient>, profile: Record<string, unknown>, prompt: string, projectId?: string) {
  const decision = moderationDecision(prompt);
  const uuidish = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  await supabase.from("moderation_events").insert({
    user_id: profile.id,
    project_id: projectId && uuidish.test(projectId) ? projectId : null,
    decision: decision.decision,
    reason: decision.reason || null,
    prompt_hash: await sha256Hex(prompt),
    metadata: { length: prompt.length },
  });
  if (decision.decision === "blocked") {
    throw new FlowtubeError(400, "Cette demande ne peut pas etre traitee par Huggyflow.", { code: "PROMPT_BLOCKED" });
  }
  return decision;
}

function stripAccents(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sceneFromPrompt(prompt: string) {
  const text = stripAccents(prompt.toLowerCase());
  if (/btp|chantier|devis|artisan|ouvrier|macon/.test(text)) return "btp";
  if (/parfum|produit|packshot|flacon|montre|cosme/.test(text)) return "product";
  if (/personnage|portrait|avatar|character|visage/.test(text)) return "character";
  return "studio";
}

const CREATION_VERB = /\b(genere|generes|cree|crees|fais|produis|dessine|realise|lance|construis|concois|imagine|anime|remixe?|retouche|transforme|decline|upscale|ameliore)\b/;
const MEDIA_SUBJECT = /\b(image|video|affiche|visuel|poster|photo|packshot|logo|animation|miniature|thumbnail|banniere|clip|ugc|storyboard|variante|declinaison|mockup|avatar|lipsync|voix|musique|jingle|audio)\b/;
const CONVERSATIONAL_ONLY = /^(salut|bonjour|bonsoir|coucou|hello|hey|merci|thanks|super|parfait|genial|top|cool|d'accord|dac|ca marche|bien recu|compris|je vois|ah ok|haha|lol)\b[\s!.,]*$/;
const SOCIAL_GREETING = /^(salut|bonjour|bonsoir|coucou|hello|hey)(?:\s+(?:comment\s+(?:vas[- ]?tu|allez[- ]?vous|ca\s+va)|ca\s+va|quoi\s+de\s+neuf))?[\s!?.,]*$/;
const SOCIAL_THANKS = /^(merci|thanks|super|parfait|genial|top|cool|d'accord|dac|ca marche|bien recu|compris|je vois|ah ok)[\s!?.,]*$/;

function socialOnlyReply(prompt: string) {
  const normalized = stripAccents(String(prompt || "").trim().toLowerCase());
  if (SOCIAL_GREETING.test(normalized)) return "Bonjour ! Comment puis-je vous aider ?";
  if (SOCIAL_THANKS.test(normalized)) return "Avec plaisir.";
  return "";
}
const QUESTION_OPENERS = /^(comment|pourquoi|combien|quand|qui|que\b|quoi\b|quel(le)?s?\b|est[- ]ce|c'est quoi|qu'est[- ]ce|peux[- ]tu|tu peux|sais[- ]tu|explique|dis[- ]moi)/;
const CAPABILITY_QUESTION = /\b(que sais[- ]tu faire|tu sais faire quoi|que peux[- ]tu faire|tu peux faire quoi|qu[' ]?est[- ]ce que tu peux faire|tes capacites|tes competences|aide[- ]moi|comment ca marche|comment fonctionne huggyflow|on cree quoi|on cree quoi aujourd'hui)\b/;
const EXISTING_MEDIA_QUERY = /\b(images?|videos?|creations?|rendus?|medias?|fichiers?)\b.*\b(que tu as|deja|precedent(?:e|es|s)?|dernier(?:e|es|s)?|cree(?:e|es|s)?|genere(?:e|es|s)?|termine(?:e|es|s)?|historique|galerie)\b|\b(historique|galerie|precedent(?:e|es|s)?|dernier(?:e|es|s)?)\b.*\b(images?|videos?|creations?|rendus?|medias?|fichiers?)\b/;

function shouldGenerateMedia(prompt: string, mode: string, selectedModel = "auto", explicitIntent = "auto") {
  if (String(mode || '').toLowerCase() === 'document') return false;
  const text = stripAccents(prompt.toLowerCase().trim());
  if (!text) return false;
  // Politesses et acquiescements: on discute, on ne genere pas.
  if (CONVERSATIONAL_ONLY.test(text)) return false;
  // Questions sur l'agent ou l'interface: on explique, on ne lance pas de rendu.
  if (CAPABILITY_QUESTION.test(text)) return false;
  // Consultation d'un resultat existant: ne jamais interpreter "cree" au passe
  // comme un nouvel ordre de generation payant.
  if (EXISTING_MEDIA_QUERY.test(text)) return false;
  // Question sans intention de creation ("combien coute une video ?"): on repond, on ne genere pas.
  if (QUESTION_OPENERS.test(text) && !CREATION_VERB.test(text)) return false;
  if (text.endsWith("?") && !CREATION_VERB.test(text)) return false;
  if (/\b(prix|tarif|cout|combien|idee|exemple|conseil|prompt pour|parle[- ]moi|explique|compare|liste)\b/.test(text) && !CREATION_VERB.test(text)) return false;
  if (CREATION_VERB.test(text)) return true;
  // A descriptive prompt is executable only after an explicit Media choice.
  // The default `mode=image` must never turn ordinary conversation into a paid job.
  const mediaChoice = explicitIntent === "generate" || (selectedModel !== "" && selectedModel !== "auto");
  return mediaChoice && MEDIA_SUBJECT.test(text) && text.split(/\s+/).length >= 3;
}

async function ensureProfile(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (data) {
    const paidPlan = normalizePlanId(String(data.plan || "free")) !== "free";
    const periodEnd = data.current_period_end ? new Date(String(data.current_period_end)).getTime() : 0;
    if (paidPlan && periodEnd > 0 && periodEnd <= Date.now()) {
      const { data: expired } = await supabase.from("profiles").update({
        plan: "free",
        billing_status: "expired",
      }).eq("id", userId).eq("current_period_end", data.current_period_end).select("*").maybeSingle();
      if (expired) return expired;
    }
    return data;
  }
  const profile = {
    id: userId,
    email: null,
    display_name: "Utilisateur",
    plan: "free",
    credits: 100,
    credits_max: 100,
    currency: DEFAULT_BILLING_CURRENCY.toLowerCase(),
  };
  const { data: inserted, error } = await supabase.from("profiles").insert(profile).select("*").single();
  if (error) throw error;
  return inserted;
}

async function createProject(supabase: ReturnType<typeof adminClient>, userId: string, title: string, seedMessages: { role: string; content: string; metadata?: Record<string, unknown> }[] = []) {
  const { data: project, error: projectError } = await supabase.from("projects")
    .insert({ user_id: userId, title })
    .select("*")
    .single();
  if (projectError) throw projectError;

  const { data: conversation, error: convError } = await supabase.from("conversations")
    .insert({ user_id: userId, project_id: project.id, title })
    .select("*")
    .single();
  if (convError) throw convError;

  if (seedMessages.length) {
    const rows = seedMessages.map((message) => ({
      user_id: userId,
      project_id: project.id,
      conversation_id: conversation.id,
      role: message.role,
      content: message.content,
      metadata: message.metadata || {},
    }));
    const { error } = await supabase.from("messages").insert(rows);
    if (error) throw error;
  }

  return { project, conversation };
}

async function ensureSeedData(supabase: ReturnType<typeof adminClient>, userId: string) {
  void supabase;
  void userId;
}

function isConfirmedResultUrl(value: unknown) {
  const url = String(value || "").trim();
  return /^https?:\/\/[^\s]+$/i.test(url);
}

function generationResultConfirmed(generation: Record<string, unknown>) {
  return String(generation.status || "") === "completed" && isConfirmedResultUrl(generation.result_url);
}

function mediaFromGeneration(generation: Record<string, unknown>) {
  const batch = cleanMetadata(generation.params).batch as Record<string, unknown> | undefined;
  const resultConfirmed = generationResultConfirmed(generation);
  return {
    id: generation.id,
    generationId: generation.id,
    projectId: generation.project_id,
    messageId: generation.message_id,
    type: generation.type,
    status: resultConfirmed ? "completed" : (generation.status === "completed" ? "failed" : generation.status),
    resultConfirmed,
    progress: generation.progress || 0,
    model: generation.model_label,
    modelLabel: generation.model_label,
    modelId: generation.model_id ? rememberPublicModel(String(generation.model_id)) : null,
    prompt: generation.prompt || "",
    aspectRatio: generation.aspect_ratio,
    ratio: generation.aspect_ratio,
    scene: (generation.params as Record<string, unknown> | null)?.scene || sceneFromPrompt(String(generation.prompt || "")),
    dur: generation.duration_seconds ? `0:${String(generation.duration_seconds).padStart(2, "0")}` : undefined,
    resultUrl: resultConfirmed ? generation.result_url : "",
    credits: generation.credits || 0,
    errorMessage: !resultConfirmed && generation.status === "completed"
      ? "Le resultat n'a pas pu etre verifie."
      : generation.status === "failed"
      ? publicErrorMessage(Str…71813 tokens truncated…eneration) => generation.status === "completed").length;
  const failed = finalItems.filter((generation) => generation.status === "failed" || generation.status === "cancelled").length;
  const { data: profile } = await supabase.from("profiles").select("credits,credits_max").eq("id", userId).single();
  return json({
    batch: {
      id: batchId,
      total: finalItems.length,
      completed,
      failed,
      done: completed + failed >= finalItems.length,
      items: finalItems.map((generation) => mediaFromGeneration(generation)),
    },
    credits: profile?.credits,
    creditsMax: profile?.credits_max,
  });
}

async function chat(req: Request) {
  const body = await bodyJson(req);
  const prompt = String(body.message || "");
  const requestAttachments = normalizeRequestAttachments((body as Record<string, unknown>).attachments);
  const attachmentContext = attachmentContextFromBody(body as Record<string, unknown>);
  let agentModelId = "auto";
  const runId = String(body.runId || body.run_id || crypto.randomUUID()).slice(0, 120);
  const requestedMessageId = String(body.messageId || body.message_id || body.idempotencyKey || crypto.randomUUID()).slice(0, 120);
  const encoder = new TextEncoder();
  let streamSupabase: ReturnType<typeof adminClient> | null = null;
  let streamUserId = "";
  let streamMessageId = "";

  const stream = new ReadableStream({
    start: async (controller) => {
      let eventSequence = 0;
      let queuedMediaInRun = false;
      let terminalEventSent = false;
      const eventWrites: PromiseLike<unknown>[] = [];
      const send = (event: string, payload: unknown) => {
        if (event === "generation" || event === "batch") queuedMediaInRun = true;
        eventSequence += 1;
        const normalizedType = event === "text"
          ? "assistant.delta"
          : event === "done"
            ? "run.completed"
            : event === "error"
              ? "run.failed"
              : event === "cancelled"
                ? "run.cancelled"
                : event;
        let nextPayload: Record<string, unknown> = payload && typeof payload === "object"
          ? { ...(payload as Record<string, unknown>), type: normalizedType, runId, messageId: requestedMessageId, sequence: eventSequence, timestamp: new Date().toISOString() }
          : { type: normalizedType, runId, messageId: requestedMessageId, sequence: eventSequence, timestamp: new Date().toISOString(), value: payload };
        if (event === "text" && payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).delta === "string") {
          nextPayload = { ...(payload as Record<string, unknown>), delta: cleanAgentDisplayText(String((payload as Record<string, unknown>).delta || "")) };
          nextPayload = { ...(nextPayload as Record<string, unknown>), type: normalizedType, runId, messageId: requestedMessageId, sequence: eventSequence, timestamp: new Date().toISOString() };
        }
        if (normalizedType === "run.completed" && queuedMediaInRun && nextPayload.resultConfirmed === undefined) {
          nextPayload = { ...nextPayload, status: "queued", resultConfirmed: false };
        }
        if (["run.completed", "run.failed", "run.cancelled", "run.interrupted"].includes(normalizedType)) terminalEventSent = true;
        if (streamSupabase && streamUserId) {
          eventWrites.push(streamSupabase.from("agent_run_events").upsert({
            run_id: runId,
            user_id: streamUserId,
            message_id: streamMessageId || null,
            sequence: eventSequence,
            event_type: normalizedType,
            payload: cleanMetadata(nextPayload),
          }, { onConflict: "run_id,sequence" }).then(() => undefined));
        }
        if (!req.signal.aborted) controller.enqueue(encoder.encode(`id: ${eventSequence}\nevent: ${event}\ndata: ${JSON.stringify(nextPayload)}\n\n`));
      };
      const heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 15000);
      try {
        const supabase = adminClient();
        const userId = await userIdFromRequest(req, supabase);
        streamSupabase = supabase;
        streamUserId = userId;
        await supabase.from("agent_run_controls").upsert({
          run_id: runId,
          user_id: userId,
          status: "active",
          requested_at: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "run_id,user_id" });
        eventWrites.push(supabase.from("agent_run_events")
          .delete()
          .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).then(() => undefined));
        await refreshOpenRouterCatalog();
        const profile = await ensureProfile(supabase, userId);
        await enforceRateLimit(req, supabase, "chat", userId, DEFAULT_RATE_LIMIT);
        const plan = await resolvePlan(supabase, String(profile.plan || "free"));
        await enforceMessageLimits(supabase, userId, plan);
        let { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""), projectTitleFromPrompt(prompt));
        await enforcePromptPolicy(supabase, profile, prompt, project.id);
        const history = await conversationHistory(supabase, conversation.id);
        ({ project, conversation } = await renameUntitledProject(supabase, userId, project, conversation, prompt, history.length));
        const memoryDirectives = extractMemoryDirectives(prompt);
        if (memoryDirectives.length) await saveAgentMemory(supabase, userId, project.id, memoryDirectives);
        const memory = await loadAgentMemory(supabase, userId, project.id);
        const elements = await loadElements(supabase, userId);
        const existingSkills = await loadLearnedSkills(supabase, userId);
        const matchedExistingSkill = matchLearnedSkill(prompt, existingSkills);
        const requestMode = String(body.mode || "image");
        const requestedMediaModel = String(body.modelId || "auto");
        const requestedIntent = String(body.intent || "auto");
        const orchestration = orchestrateRequest(prompt, body as Record<string, unknown>, requestAttachments);
        const socialReply = socialOnlyReply(prompt);
        const simpleConversation = !requestAttachments.length
          && orchestration.intent === "conversation"
          && !extractSkillDirective(prompt)
          && !isCostReportRequest(prompt)
          && !extractElementDirective(prompt);
        const requiredAgentCapabilities = socialReply ? ["text" as ModelCapability] : requestedAgentCapabilities(prompt, body as Record<string, unknown>, orchestration);
        agentModelId = socialReply ? activeDefaultAgentModel() : selectAgentModelForRequest(body as Record<string, unknown>, prompt, requiredAgentCapabilities, orchestration.complexity);
        send("run.started", { phase: simpleConversation ? "thinking" : "analyzing", progress: simpleConversation ? 4 : 10, model: agentModelId === "auto" ? undefined : "selected" });
        const billingRequestKey = String(body.idempotencyKey || body.idempotency_key || crypto.randomUUID()).slice(0, 120);
        const billingCounters = new Map<string, number>();
        const nextBillingKey = (reason: string) => {
          const count = (billingCounters.get(reason) || 0) + 1;
          billingCounters.set(reason, count);
          return `${billingRequestKey}:${reason}:${count}`.slice(0, 180);
        };
        if (!simpleConversation) send("status", { phase: "analyzing", progress: 12, label: orchestration.publicSummary });
        const learnedSkills = await loadLearnedSkills(supabase, userId);
        if (!simpleConversation) send("status", { phase: "routing", progress: 24, label: matchedExistingSkill ? "AgentFlow réactive une compétence existante" : orchestration.publicSummary });
        const { data: userMessage } = await supabase.from("messages").insert({
          user_id: userId,
          project_id: project.id,
          conversation_id: conversation.id,
          role: "user",
          content: prompt,
          metadata: requestAttachments.length ? { attachments: requestAttachments } : {},
        }).select("id").maybeSingle();
        if (userMessage?.id) streamMessageId = String(userMessage.id);
        const saveAssistant = async (content: string) => {
          if (!content || !content.trim()) return;
          const { data: saved } = await supabase.from("messages").insert({
            user_id: userId,
            project_id: project.id,
            conversation_id: conversation.id,
            role: "assistant",
            content: cleanAgentDisplayText(content).trim(),
          }).select("id").maybeSingle();
          if (saved?.id) streamMessageId = String(saved.id);
        };
        const billAgent = (reason: string, multiplier = 1) =>
          agentBilling({ supabase, userId, send }, reason, multiplier, nextBillingKey(reason));

        const metadata = cleanMetadata(profile.metadata);
        const pending = metadata.pending_generation as Record<string, unknown> | undefined;
        const pendingExpired = pending?.expiresAt ? new Date(String(pending.expiresAt)).getTime() < Date.now() : false;
        if (pending && pendingExpired) await clearPendingGeneration(supabase, profile);

        if (pending && !pendingExpired && isCancelText(prompt)) {
          await clearPendingGeneration(supabase, profile);
          const cancelReply = "Generation annulee. Aucun credit n'a ete debite.";
          send("text", { delta: cancelReply });
          await saveAssistant(cancelReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        if (pending && !pendingExpired && isConfirmationText(prompt)) {
          await clearPendingGeneration(supabase, profile);
          const pendingBody = (pending.body || {}) as Record<string, unknown>;
          const pendingProjectId = isUuid(String(pendingBody.projectId || "")) ? String(pendingBody.projectId) : String(project.id);
          const pendingBatch = Number(pendingBody.batch || 1);
          if (pendingBatch >= 2) {
            const reply = `Confirmation recue. Je lance le lot de ${pendingBatch} creations : les rendus vont s'enchainer automatiquement.`;
            send("text", { delta: reply });
            const result = await createGenerationBatch(req, {
              ...pendingBody,
              projectId: pendingProjectId,
            }, pendingBatch, reply);
            send("batch", result.batch);
          } else {
            const reply = "Confirmation recue. Je lance la generation maintenant.";
            send("text", { delta: reply });
            const result = await createGeneration(req, {
              ...pendingBody,
              projectId: pendingProjectId,
              confirmed: true,
            }, reply);
            send("generation", result.generation);
          }
          const { data: freshProfile } = await supabase.from("profiles").select("credits,credits_max").eq("id", userId).single();
          send("credits", { credits: freshProfile?.credits ?? 0, creditsMax: freshProfile?.credits_max ?? 100 });
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Social turns are intentionally resolved without project history. This
        // prevents an old production brief from taking over a simple greeting.
        if (socialReply) {
          send("text", { delta: socialReply });
          await saveAssistant(socialReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        if (isUgcPipelineRequest(prompt)) {
          const missing = ugcPipelineMissingInputs(prompt, requestAttachments);
          if (missing.length) {
            const reply = ugcPipelineMissingReply(missing);
            send("text", { delta: reply });
            await saveAssistant(reply);
            send("done", projectDonePayload(project, conversation));
            return;
          }
        }

        // Commande "cree un skill ...": l'utilisateur enregistre un workflow reutilisable.
        const skillDirective = extractSkillDirective(prompt);
        if (skillDirective) {
          send("skill", { phase: "creating", name: skillDirective.name, label: "AgentFlow enregistre cette competence pour plus tard" });
          const playbook = prompt.trim();
          await saveLearnedSkill(supabase, userId, String(project.id), skillDirective.name, skillDirective.triggers, playbook, false);
          send("skill", { phase: "ready", name: skillDirective.name, label: "Competence active et reutilisable" });
          const skillReply = `Skill "${skillDirective.name}" enregistre (declencheurs: ${skillDirective.triggers.join(", ")}). Je l'appliquerai quand le sujet reviendra, ou lance-le avec /${skillDirective.name}.`;
          send("text", { delta: skillReply });
          await saveAssistant(skillReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Analyse visuelle: breakdown d'une image/pub de reference (attachee, @element, ou derniere creation).
        if (isVisualAnalysisRequest(prompt)) {
          await assertAgentRunActive(req, supabase, userId, runId);
          const attached = String(body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url || body.videoUrl || body.video_url || "");
          const mentioned = resolveElementMentions(prompt, elements);
          let target = attached || (mentioned[0] && mentioned[0].media_url) || "";
          let isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(target) || !!(body.videoUrl || body.video_url);
          if (!target) {
            const { data: last } = await supabase.from("generations")
              .select("result_url,type").eq("project_id", project.id).eq("status", "completed")
              .not("result_url", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
            if (last?.result_url) { target = String(last.result_url); isVideo = String(last.type) === "video"; }
          }
          if (!target) {
            const noRef = "Envoie-moi l'image ou la pub a analyser (piece jointe, @element epingle, ou reference une creation du projet) et je te fais le breakdown du hook, de la compo et de l'angle.";
            send("text", { delta: noRef });
            await saveAssistant(noRef);
            send("done", projectDonePayload(project, conversation));
            return;
          }
          send("text", { delta: "J'analyse le visuel..." });
          const analysis = await runVisualAnalysis(target, isVideo, agentModelId, billAgent("visual_analysis"));
          send("text", { delta: analysis });
          await saveAssistant(analysis);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Recherche web: lit une page (produit/marque/concurrent) et en tire un brief.
        const researchUrl = extractFirstUrl(prompt);
        if (researchUrl && isResearchRequest(prompt)) {
          await assertAgentRunActive(req, supabase, userId, runId);
          send("status", { phase: "researching", progress: 34, label: "AgentFlow vérifie la source demandée", tool: "Recherche web" });
          send("text", { delta: `Je lis ${researchUrl}...` });
          const brief = await runWebResearch(researchUrl, prompt, agentModelId, billAgent("web_research"));
          send("text", { delta: brief });
          await saveAssistant(brief);
          send("done", projectDonePayload(project, conversation));
          return;
        }
        if (!researchUrl && isTrendResearchRequest(prompt)) {
          await assertAgentRunActive(req, supabase, userId, runId);
          send("status", { phase: "researching", progress: 34, label: "AgentFlow analyse les signaux disponibles", tool: "Recherche marché" });
          send("text", { delta: "J'analyse les signaux marche disponibles..." });
          const brief = await runMarketResearch(prompt, prompt, agentModelId, billAgent("market_research"));
          send("text", { delta: brief });
          await saveAssistant(brief);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Commande "rapport de cout": bilan credits du projet vs equivalent traditionnel.
        if (isCostReportRequest(prompt)) {
          const { data: projGens } = await supabase.from("generations")
            .select("type,status,credits")
            .eq("project_id", project.id);
          const costReply = buildCostReport((projGens || []) as { type: string; status: string; credits: number }[], Number(profile.credits || 0));
          send("text", { delta: costReply });
          await saveAssistant(costReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Consultation de l'historique: repondre depuis les resultats verifies
        // sans repasser par le modele ni exposer les statuts internes.
        if (EXISTING_MEDIA_QUERY.test(stripAccents(prompt.toLowerCase()))) {
          const { data: recentCreations } = await supabase.from("generations")
            .select("type,prompt,created_at")
            .eq("project_id", project.id)
            .eq("user_id", userId)
            .eq("status", "completed")
            .not("result_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(10);
          const creations = (recentCreations || []).slice().reverse();
          const historyReply = creations.length
            ? `Voici les ${creations.length} creation${creations.length > 1 ? "s" : ""} de ce projet :\n${creations.map((creation, index) => {
              const kind = creation.type === "video" ? "Video" : creation.type === "audio" ? "Audio" : "Image";
              const label = String(creation.prompt || "Creation sans titre").replace(/\s+/g, " ").trim().slice(0, 140);
              return `${index + 1}. ${kind} - ${label}`;
            }).join("\n")}`
            : "Aucune creation finalisee n'est encore disponible dans ce projet.";
          send("text", { delta: historyReply });
          await saveAssistant(historyReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Commande "epingle ... comme @nom": sauvegarde la creation visee comme element reutilisable.
        const elementDirective = extractElementDirective(prompt);
        if (elementDirective) {
          const { data: convGens } = await supabase.from("generations")
            .select("id,result_url,created_at")
            .eq("conversation_id", conversation.id)
            .eq("status", "completed")
            .not("result_url", "is", null)
            .order("created_at", { ascending: true });
          const list = convGens || [];
          const idx = resolveReferencedIndex(prompt, list.length);
          const target = idx !== null && list[idx] ? list[idx] : list[list.length - 1];
          let elementReply: string;
          if (!target || !target.result_url) {
            elementReply = "Je n'ai pas trouve de creation terminee a epingler dans ce projet. Genere d'abord un visuel, puis demande-moi de l'epingler comme element.";
          } else {
            await saveElement(supabase, userId, String(project.id), elementDirective.name, elementDirective.kind, String(target.result_url), String(target.id));
            elementReply = `Element @${elementDirective.name} epingle (${elementDirective.kind}). Mentionne @${elementDirective.name} dans n'importe quel prompt pour le reutiliser comme reference visuelle.`;
          }
          send("text", { delta: elementReply });
          await saveAssistant(elementReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Boucle agentique (flag AGENT_LOOP_ENABLED): l'agent decide lui-meme des outils a appeler.
        // Media requests use the typed generation lifecycle below so the UI
        // receives a real queued job and never a speculative tool response.
        // The agent loop remains available for non-media workflows.
        if (orchestration.usesAgentLoop && !simpleConversation) {
          await assertAgentRunActive(req, supabase, userId, runId);
          if (!simpleConversation) send("status", { phase: "routing", progress: 32, label: "AgentFlow orchestre les outils adaptés", tool: "AgentFlow Loop" });
          const loopCtx: AgentLoopCtx = { req, supabase, userId, project, conversation, profile, plan, body: body as Record<string, unknown>, agentModelId, send, billingKey: `${billingRequestKey}:loop` };
          const loopMatched = matchLearnedSkill(prompt, learnedSkills);
          const loopContext: ReplyContext = {
            planName: plan.displayName,
            creditsBalance: Number(profile.credits || 0),
            projectTitle: orchestration.requiresProjectContext ? String(project.title || "") : undefined,
            memory: orchestration.requiresProjectContext ? memory : [],
            elements: orchestration.requiresProjectContext ? elements : [],
            learnedSkill: loopMatched ? `${loopMatched.name}: ${loopMatched.playbook}`.slice(0, 800) : undefined,
            attachments: attachmentContext,
            complexity: orchestration.complexity,
          };
          const reply = await runAgentLoop(loopCtx, prompt, orchestration.requiresProjectContext ? history : [], loopContext);
          await saveAssistant(reply);
          const { data: loopProfile } = await supabase.from("profiles").select("credits,credits_max").eq("id", userId).single();
          send("credits", { credits: loopProfile?.credits ?? 0, creditsMax: loopProfile?.credits_max ?? 100 });
          send("done", projectDonePayload(project, conversation));
          return;
        }

        const mode = String(body.mode || "image");
        const type = requestTypeFromBody({ ...body, mode }, prompt);
        const catalog = await pricingCatalog(supabase);
        const model = resolveBestModelFromCatalog(catalog, String(body.modelId || "auto"), type, prompt, body as Record<string, unknown>);
        const aspectRatio = aspectRatioForRequest(body as Record<string, unknown>, prompt, type);
        const quote = quoteFor(model, requestedUnitsForModel(model, body as Record<string, unknown>, prompt, type));
        const willGenerate = orchestration.intent === "media";
        const batchCount = willGenerate ? batchCountFromPrompt(prompt) : 1;
        send("status", { phase: "routing", progress: 32, label: `AgentFlow sélectionne ${model.name}`, model: model.name });

        // A media request must be rejected before the agent brief is billed.
        // The image/video quote is the real user-facing operation; charging a
        // hidden planning turn first could consume the remaining balance and
        // then make the actual generation fail with an inconsistent balance.
        if (willGenerate && batchCount < 2) {
          await assertAgentRunActive(req, supabase, userId, runId);
          await enforceGenerationGuards(supabase, profile, plan, model, quote);
          ensureProviderReady(model);
        }

        if (willGenerate && batchCount >= 2) {
          await enforceBatchGuards(supabase, profile, plan, model, quote, batchCount);
          ensureProviderReady(model);
          await savePendingGeneration(supabase, profile, {
            body: {
              projectId: project.id,
              prompt,
              type,
              modelId: model.id,
              aspectRatio,
              scene: sceneFromPrompt(prompt),
              duration: type === "video" ? quote.units : undefined,
              batch: batchCount,
              imageUrl: body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url,
              videoUrl: body.videoUrl || body.video_url,
              audioUrl: body.audioUrl || body.audio_url,
              referenceUrls: body.referenceUrls || body.reference_urls,
              firstFrameUrl: body.firstFrameUrl || body.first_frame_url,
              lastFrameUrl: body.lastFrameUrl || body.last_frame_url,
            },
            model: { id: model.id, name: model.name, type: model.type },
            quote,
            batch: batchCount,
          });
          const batchReply = batchConfirmationMessage(model, quote, batchCount, type);
          send("text", { delta: batchReply });
          await saveAssistant(batchReply);
          send("done", projectDonePayload(project, conversation, { requiresConfirmation: true }));
          return;
        }

        if (willGenerate && quote.requiresConfirmation && body.confirmed !== true) {
          await enforceGenerationGuards(supabase, profile, plan, model, quote);
          ensureProviderReady(model);
          await savePendingGeneration(supabase, profile, {
            body: {
              projectId: project.id,
              prompt,
              type,
              modelId: model.id,
              aspectRatio,
              scene: sceneFromPrompt(prompt),
              duration: type === "video" ? quote.units : undefined,
              imageUrl: body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url,
              videoUrl: body.videoUrl || body.video_url,
              audioUrl: body.audioUrl || body.audio_url,
              referenceUrls: body.referenceUrls || body.reference_urls,
              firstFrameUrl: body.firstFrameUrl || body.first_frame_url,
              lastFrameUrl: body.lastFrameUrl || body.last_frame_url,
            },
            model: { id: model.id, name: model.name, type: model.type },
            quote,
          });
          const confirmReply = confirmationMessage(model, quote);
          send("text", { delta: confirmReply });
          await saveAssistant(confirmReply);
          send("done", projectDonePayload(project, conversation, { requiresConfirmation: true }));
          return;
        }

        if (willGenerate) ensureProviderReady(model);
        const credits = quote.credits;
        const responseType = willGenerate ? type : (orchestration.intent === "document" ? "document" : "conversation");
        const responseCredits = willGenerate ? credits : 0;
        const { data: recentGens } = await supabase.from("generations")
          .select("type,prompt,status")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(3);
        const replyContext: ReplyContext = {
          planName: plan.displayName,
          creditsBalance: Number(profile.credits || 0),
          projectTitle: orchestration.requiresProjectContext ? String(project.title || "") : undefined,
          recentCreations: orchestration.requiresProjectContext
            ? (recentGens || []).map((generation) => `${generation.type} (${generation.status}): ${String(generation.prompt || "").slice(0, 110)}`)
            : [],
          willGenerate,
          memory: orchestration.requiresProjectContext ? memory : [],
          elements: orchestration.requiresProjectContext ? elements : [],
          attachments: attachmentContext,
          learnedSkill: orchestration.intent === "workflow" || orchestration.complexity === "complex"
            ? (() => { const s = matchLearnedSkill(prompt, learnedSkills); return s ? `${s.name}: ${s.playbook}`.slice(0, 800) : undefined; })()
            : undefined,
          complexity: orchestration.complexity,
        };
        if (!simpleConversation) send("status", { phase: "writing", progress: 42, label: willGenerate ? "AgentFlow prépare le brief de production" : "AgentFlow compose la réponse", model: "selected" });
        const reply = willGenerate
          ? `Je prépare le rendu ${type === "video" ? "vidéo" : type === "audio" ? "audio" : "image"}. Le résultat apparaîtra ici uniquement après confirmation.`
          : await anthropicReply(
            prompt,
            responseType,
            responseCredits,
            orchestration.requiresProjectContext ? history : [],
            (delta) => send("text", { delta }),
            replyContext,
            agentModelId,
            // Media pricing is settled by the generation lifecycle after a
            // confirmed result. Do not create a second hidden debit for the
            // orchestration brief.
            billAgent("agent_chat_reply"),
          );
        if (willGenerate) send("text", { delta: reply });
        if (!willGenerate) await saveAssistant(reply);

        const requestedArtifactType = artifactRequestType(prompt);
        if (requestedArtifactType) {
          send("artifact_status", { phase: "building", type: requestedArtifactType, label: "AgentFlow prepare un artifact reutilisable" });
          const artifactFiles = artifactFilesFromReply(reply, requestedArtifactType);
          const artifact = await createArtifactRecord(supabase, {
            userId,
            projectId: String(project.id),
            conversationId: String(conversation.id),
            title: artifactTitleFromPrompt(prompt),
            type: requestedArtifactType,
            files: artifactFiles.files,
            entryFile: artifactFiles.entryFile,
            sourcePrompt: prompt,
            modelId: agentModelId,
          });
          send("artifact_status", { phase: "ready", type: requestedArtifactType, label: "Artifact pret dans le panneau droit" });
          send("artifact", { artifact });
        }

        if (willGenerate) {
          send("status", { phase: "rendering", progress: 58, label: "AgentFlow transmet le brief au moteur de création", model: model.name });
          // Reference "refais le #N / la meme": on retrouve la creation visee et on reutilise son prompt + resultat.
          let basePrompt = prompt;
          let referencedImage = body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url;
          // @mentions d'elements epingles: la reference visuelle est jointe et le nom explicite dans le prompt.
          const mentionedElements = resolveElementMentions(prompt, elements);
          if (mentionedElements.length) {
            if (!referencedImage) referencedImage = mentionedElements[0].media_url;
            for (const el of mentionedElements) {
              basePrompt = basePrompt.replace(new RegExp(`@${el.name}\\b`, "gi"), `${el.name} (reference ${el.kind} fournie en image)`);
            }
          }
          if (/\b(refais|meme|pareil|comme|derniere?|premier|deuxieme|troisieme|precedent|encore|another|same)\b/i.test(stripAccents(prompt.toLowerCase()))) {
            const { data: convGens } = await supabase.from("generations")
              .select("prompt,result_url,type,created_at")
              .eq("conversation_id", conversation.id)
              .order("created_at", { ascending: true });
            const list = convGens || [];
            const idx = resolveReferencedIndex(prompt, list.length);
            if (idx !== null && list[idx]) {
              const ref = list[idx];
              // Si le message est court/vague, on herite du prompt de reference (variation demandee en plus).
              if (prompt.trim().split(/\s+/).length <= 8 && ref.prompt) basePrompt = `${ref.prompt}. Variation demandee: ${prompt}`;
              if (!referencedImage && ref.result_url) referencedImage = ref.result_url;
            }
          }
          const result = await createGeneration(req, {
            projectId: project.id,
            prompt: basePrompt,
            type,
            modelId: model.id,
            aspectRatio,
            scene: sceneFromPrompt(basePrompt),
            duration: model.pricingUnit === "second" ? quote.units : undefined,
            confirmed: body.confirmed === true || !quote.requiresConfirmation,
            imageUrl: referencedImage,
            videoUrl: body.videoUrl || body.video_url,
            audioUrl: body.audioUrl || body.audio_url,
            referenceUrls: body.referenceUrls || body.reference_urls,
            firstFrameUrl: body.firstFrameUrl || body.first_frame_url,
            lastFrameUrl: body.lastFrameUrl || body.last_frame_url,
          }, reply);
          send("generation", result.generation);
        }
        const { data: finalProfile } = await supabase.from("profiles").select("credits,credits_max").eq("id", userId).single();
        send("credits", { credits: finalProfile?.credits ?? 0, creditsMax: finalProfile?.credits_max ?? 100 });
        send("done", projectDonePayload(project, conversation));
      } catch (err) {
        console.error("[chat-run-failed]", JSON.stringify(safeErrorDiagnostic(err)));
        if (err instanceof FlowtubeError && err.payload?.code === "RUN_CANCELLED") send("cancelled", { status: "cancelled", resultConfirmed: false });
        else if (err instanceof FlowtubeError) send("error", { message: publicErrorMessage(err.message), ...publicErrorPayload(err) });
        else send("error", { message: "La création est indisponible pour le moment. Réessaie dans quelques instants." });
      } finally {
        clearInterval(heartbeat);
        if (!terminalEventSent && streamSupabase && streamUserId) {
          eventSequence += 1;
          eventWrites.push(streamSupabase.from("agent_run_events").upsert({
            run_id: runId,
            user_id: streamUserId,
            message_id: streamMessageId || null,
            sequence: eventSequence,
            event_type: "run.interrupted",
            payload: {
              type: "run.interrupted",
              runId,
              messageId: requestedMessageId,
              sequence: eventSequence,
              timestamp: new Date().toISOString(),
              status: "interrupted",
              resultConfirmed: false,
            },
          }, { onConflict: "run_id,sequence" }).then(() => undefined));
        }
        await Promise.allSettled(eventWrites);
        try { controller.close(); } catch (_err) { /* the browser already cancelled the stream */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function extractUrl(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractUrl(item);
      if (found) return found;
    }
  }
  if (typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      const found = extractUrl(item);
      if (found) return found;
    }
  }
  return "";
}

function extensionFromContentType(contentType: string, fallbackType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("mpeg")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("plain")) return "txt";
  if (contentType.includes("markdown")) return "md";
  if (contentType.includes("msword")) return "doc";
  if (contentType.includes("wordprocessingml")) return "docx";
  return fallbackType === "video" ? "mp4" : fallbackType === "audio" ? "mp3" : "png";
}

async function persistMediaAsset(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  const resultUrl = String(generation.result_url || "");
  if (!resultUrl) return;
  const { data: existing } = await supabase.from("media_assets").select("id").eq("generation_id", generation.id).limit(1).maybeSingle();
  if (existing) return;
  const params = (generation.params || {}) as Record<string, unknown>;
  const retentionDays = Number(params.media_retention_days || 30);
  const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();
  let asset = {
    user_id: generation.user_id,
    generation_id: generation.id,
    bucket: MEDIA_BUCKET,
    object_path: `${generation.user_id}/${generation.id}/remote`,
    source_url: resultUrl,
    public_url: resultUrl,
    expires_at: expiresAt,
    status: "available",
    metadata: { persisted: false },
  } as Record<string, unknown>;

  if (Deno.env.get("FLOWTUBE_STORE_MEDIA") === "true") {
    try {
      const response = await safeExternalFetch(resultUrl);
      if (!response.ok) throw new Error(`download ${response.status}`);
      const kind = generatedMediaKind(generation.type);
      const maximumBytes = (kind === "video" ? 500 : kind === "audio" ? 100 : 30) * 1024 * 1024;
      const bytes = await readResponseBytes(response, maximumBytes);
      const contentType = generatedContentType(bytes, response.headers.get("content-type"), generation.type);
      if (!contentType) throw new Error("invalid media result");
      const buffer = new Uint8Array(bytes).buffer as ArrayBuffer;
      const ext = extensionFromContentType(contentType, String(generation.type || "image"));
      const path = `${generation.user_id}/${generation.id}/result.${ext}`;
      const { error: uploadError } = await supabase.storage.from(MEDIA_BUCKET).upload(path, buffer, { contentType, upsert: true });
      if (uploadError) throw uploadError;
      const signedSeconds = Math.max(3600, Math.min(retentionDays * 24 * 60 * 60, 60 * 60 * 24 * 30));
      const { data: signed } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, signedSeconds);
      const signedExpiresAt = new Date(Date.now() + signedSeconds * 1000).toISOString();
      asset = {
        ...asset,
        object_path: path,
        content_type: contentType,
        bytes: buffer.byteLength,
        public_url: signed?.signedUrl || resultUrl,
        signed_url_expires_at: signedExpiresAt,
        metadata: { persisted: true },
      };
      await supabase.from("generations").update({
        storage_bucket: MEDIA_BUCKET,
        storage_path: path,
        storage_url_expires_at: signedExpiresAt,
        expires_at: expiresAt,
        result_url: signed?.signedUrl || resultUrl,
      }).eq("id", generation.id);
    } catch (err) {
      asset.metadata = { persisted: false, error: err instanceof Error ? err.message : "storage failed" };
      asset.status = "failed";
    }
  }

  await supabase.from("media_assets").insert(asset);
}

function uploadKindFromBody(kind: unknown, contentType: string) {
  const explicit = String(kind || "").toLowerCase();
  if (["image", "video", "audio", "text", "file"].includes(explicit)) return explicit;
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  if (contentType.startsWith("text/")) return "text";
  return "file";
}

function uploadAllowedContentType(contentType: string) {
  const type = contentType.toLowerCase();
  return type.startsWith("image/")
    || type.startsWith("video/")
    || type.startsWith("audio/")
    || type.startsWith("text/")
    || [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/json",
      "application/octet-stream",
    ].includes(type);
}

function safeUploadName(name: unknown) {
  return String(name || "fichier")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90) || "fichier";
}

function bytesFromDataUrl(data: unknown) {
  const raw = String(data || "");
  const base64 = raw.includes(",") ? raw.slice(raw.indexOf(",") + 1) : raw;
  if (!base64) throw new FlowtubeError(400, "Fichier vide.", { code: "UPLOAD_EMPTY" });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hasExpectedUploadSignature(bytes: Uint8Array, contentType: string) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const at = (offset: number, ...values: number[]) => values.every((value, index) => bytes[offset + index] === value);
  if (contentType === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (contentType === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (contentType === "image/gif") return starts(0x47, 0x49, 0x46, 0x38);
  if (contentType === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
  if (contentType === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46);
  if (contentType.startsWith("video/") || contentType === "audio/mp4") return at(4, 0x66, 0x74, 0x79, 0x70);
  if (contentType === "audio/wav" || contentType === "audio/x-wav") return starts(0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x41, 0x56, 0x45);
  if (contentType === "audio/ogg") return starts(0x4f, 0x67, 0x67, 0x53);
  if (contentType === "audio/mpeg") return starts(0x49, 0x44, 0x33) || starts(0xff, 0xfb) || starts(0xff, 0xf3) || starts(0xff, 0xf2);
  if (contentType === "application/json") {
    const sample = new TextDecoder().decode(bytes.slice(0, 80)).trim();
    return sample.startsWith("{") || sample.startsWith("[");
  }
  if (contentType === "application/msword") return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  if (contentType.includes("wordprocessingml")) return starts(0x50, 0x4b, 0x03, 0x04);
  return false;
}

async function uploadRoute(req: Request) {
  const requestContentType = String(req.headers.get("content-type") || "").toLowerCase();
  let body: Record<string, unknown> = {};
  let uploadedFile: File | null = null;
  if (requestContentType.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const candidate = form.get("file");
    if (candidate instanceof File) uploadedFile = candidate;
    body = {
      fileName: form.get("fileName") || form.get("file_name") || uploadedFile?.name || "fichier",
      contentType: form.get("contentType") || form.get("content_type") || uploadedFile?.type || "application/octet-stream",
      kind: form.get("kind") || "",
      textPreview: form.get("textPreview") || form.get("text_preview") || "",
    };
  } else {
    body = await bodyJson(req);
  }
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);
  await enforceRateLimit(req, supabase, "upload", userId, 30);
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  const contentType = String(body.contentType || body.content_type || "application/octet-stream").toLowerCase();
  if (!uploadAllowedContentType(contentType)) {
    throw new FlowtubeError(415, "Format de fichier non pris en charge.", { code: "UNSUPPORTED_UPLOAD_TYPE" });
  }
  const bytes = uploadedFile
    ? new Uint8Array(await uploadedFile.arrayBuffer())
    : bytesFromDataUrl(body.data || body.base64);
  if (!hasExpectedUploadSignature(bytes, contentType)) {
    throw new FlowtubeError(415, "Le contenu du fichier ne correspond pas au format annonce.", { code: "UPLOAD_SIGNATURE_INVALID" });
  }
  const maxBytes = Math.max(1, Number(plan.maxUploadMb || 25)) * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    throw new FlowtubeError(413, `Fichier trop lourd pour ton plan (${plan.maxUploadMb} Mo maximum).`, {
      code: "UPLOAD_TOO_LARGE",
      maxUploadMb: plan.maxUploadMb,
    });
  }
  const kind = uploadKindFromBody(body.kind, contentType);
  const fileName = safeUploadName(body.fileName || body.name);
  const ext = extensionFromContentType(contentType, kind === "file" ? "png" : kind);
  const path = `${userId}/uploads/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, new Blob([bytes], { type: contentType }), { contentType, upsert: false });
  if (uploadError) throw uploadError;
  const signedSeconds = Math.max(3600, Math.min(Number(plan.mediaRetentionDays || 30) * 24 * 60 * 60, 60 * 60 * 24 * 30));
  const { data: signed, error: signedError } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, signedSeconds);
  if (signedError) throw signedError;
  const expiresAt = new Date(Date.now() + signedSeconds * 1000).toISOString();
  const textPreview = String(body.textPreview || body.text_preview || "").slice(0, 12000);
  const { data: asset } = await supabase.from("media_assets").insert({
    user_id: userId,
    bucket: MEDIA_BUCKET,
    object_path: path,
    content_type: contentType,
    bytes: bytes.byteLength,
    public_url: signed?.signedUrl || "",
    signed_url_expires_at: expiresAt,
    expires_at: expiresAt,
    status: "available",
    metadata: { upload: true, kind, file_name: fileName, text_preview: textPreview || undefined },
  }).select("id").single();
  return json({
    id: asset?.id || crypto.randomUUID(),
    name: fileName,
    kind,
    contentType,
    bytes: bytes.byteLength,
    url: signed?.signedUrl || "",
    expiresAt,
    textPreview,
  });
}

async function refundFailedGeneration(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  if ((!generation?.debited_at && Number(generation?.reserved_credits || 0) <= 0) || generation.failure_refunded_at) return;
  const { error } = await supabase.rpc("refund_failed_generation", { p_generation_id: generation.id });
  if (error) console.error("generation refund failed", safeLogMessage(error.message));
}

async function debitCredits(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  if (generation.debited_at || generation.status !== "completed") return;
  const userId = String(generation.user_id);
  const credits = Number(generation.credits || 0);
  const { data: debitResult, error: debitError } = await supabase.rpc("debit_completed_generation", {
    p_generation_id: generation.id,
  });
  if (debitError) throw debitError;
  const debit = Array.isArray(debitResult) ? debitResult[0] as Record<string, unknown> | undefined : undefined;
  if (!debit || debit.charged !== true) return;
  await recordCompletedGenerationBilling(supabase, generation);
}

async function recordCompletedGenerationBilling(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  const { data: existingAudit } = await supabase.from("pricing_audit_logs")
    .select("id").eq("generation_id", generation.id).eq("status", "completed").limit(1).maybeSingle();
  if (existingAudit?.id) return;
  const userId = String(generation.user_id);
  const credits = Number(generation.credits || 0);
  const creditFloorUsd = Number(generation.credit_floor_usd || CREDIT_FLOOR_USD);
  const retailCreditUsd = Number(generation.retail_credit_usd || RETAIL_CREDIT_USD);
  const providerCostUsd = Number(generation.cost_usd || 0);
  const revenueFloorUsd = Number((credits * creditFloorUsd).toFixed(4));
  const grossMarginFloorUsd = Number((revenueFloorUsd - providerCostUsd).toFixed(4));
  const grossMarginFloorRatio = ratioFromAmounts(revenueFloorUsd, providerCostUsd);
  await supabase.from("pricing_audit_logs").insert({
    user_id: userId,
    generation_id: generation.id,
    pricing_model_id: generation.pricing_model_id || generation.model_id,
    credits_charged: credits,
    credit_floor_usd: creditFloorUsd,
    retail_credit_usd: retailCreditUsd,
    provider_cost_usd: providerCostUsd,
    status: "completed",
    metadata: {
      model_label: generation.model_label,
      media_type: generation.type,
      margin_multiplier: generation.margin_multiplier || MEDIA_MARGIN_MULTIPLIER,
      gross_margin_floor_ratio: grossMarginFloorRatio,
      result_url_present: Boolean(generation.result_url),
    },
  });
  await supabase.from("generations").update({
    revenue_floor_usd: revenueFloorUsd,
    gross_margin_floor_usd: grossMarginFloorUsd,
  }).eq("id", generation.id);
  await persistMediaAsset(supabase, generation);
}

async function syncGeneration(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  if (generation.status === "completed") {
    if (generationResultConfirmed(generation)) return generation;
    return await failProviderGeneration(supabase, generation, new Error("Le resultat media n'a pas pu etre verifie."), "result_url_missing");
  }
  if (generation.status === "failed" || generation.status === "cancelled") return generation;
  // Item de lot en file d'attente : il attend un slot, la vague suivante le lancera.
  if (generation.status === "pending" && !generation.fal_job_id && !generation.provider_job_id && batchInfoOf(generation)) return generation;
  const createdAt = new Date(String(generation.created_at || "")).getTime();
  if (Number.isFinite(createdAt) && createdAt > 0 && Date.now() - createdAt > 15 * 60 * 1000) {
    return await failProviderGeneration(supabase, generation, new Error("Le délai maximal de génération est dépassé."), "generation_timeout").then(() => ({ ...generation, status: "failed" }));
  }
  if (String(generation.provider || "") === "openrouter" && generation.provider_job_id) {
    try {
      const payload = cleanMetadata(generation.provider_payload);
      const pollingUrl = String(payload.polling_url || `${OPENROUTER_BASE_URL}/videos/${generation.provider_job_id}`);
      const response = await fetch(pollingUrl.startsWith("http") ? pollingUrl : `${OPENROUTER_BASE_URL}${pollingUrl}`, { headers: openRouterHeaders() });
      if (!response.ok) throw openRouterProviderError(response, String(generation.model_id || ""));
      const body = await response.json() as Record<string, unknown>;
      const statusText = String(body.status || body.state || "").toLowerCase();
      if (["failed", "error", "cancelled", "canceled"].includes(statusText)) throw new Error("La generation video a echoue. Aucun credit supplementaire ne sera debite.");
      if (["completed", "complete", "succeeded", "success"].includes(statusText)) {
        const unsignedUrls = Array.isArray(body.unsigned_urls) ? body.unsigned_urls.map(String) : [];
        const resultUrl = String(body.video_url || body.videoUrl || body.url || unsignedUrls[0] || extractUrl(body.output || body.data || body.result));
        const contentUrl = `${OPENROUTER_BASE_URL}/videos/${generation.provider_job_id}/content?index=0`;
        const stored = await fetchAndStoreProviderResult(supabase, generation, resultUrl || contentUrl, openRouterHeaders());
        return await completeProviderGeneration(supabase, generation, stored.signedUrl, body, Number((body.usage as Record<string, unknown> | undefined)?.cost || generation.cost_usd));
      }
      const providerProgress = Number(body.progress || body.percent || 0);
      const progress = Math.min(95, Math.max(Number(generation.progress || 5) + 4, providerProgress || Number(generation.progress || 5)));
      const { data } = await supabase.from("generations").update({ status: "running", progress, provider_payload: { ...payload, ...body, polling_url: pollingUrl } }).eq("id", generation.id).select("*").single();
      await trackGenerationJob(supabase, data || generation, "running", { reconciled_at: new Date().toISOString(), provider: "openrouter" });
      return data || generation;
    } catch (error) {
      return await failProviderGeneration(supabase, generation, error, error instanceof FlowtubeError ? String(error.payload.code || "openrouter_poll_failed") : "openrouter_poll_failed").then(() => ({ ...generation, status: "failed" }));
    }
  }
  const key = Deno.env.get("FAL_KEY");
  if (key && generation.fal_job_id) {
    try {
      fal.config({ credentials: key });
      const catalog = await pricingCatalog(supabase);
      const model = resolveModelFromCatalog(catalog, String(generation.model_id), String(generation.type));
      const payload = cleanMetadata(generation.provider_payload);
      const endpoint = String(payload.endpoint || model.endpoint || "");
      if (!endpoint) throw new Error("Media endpoint unavailable");
      const status = await fal.queue.status(endpoint, { requestId: String(generation.fal_job_id), logs: true });
      const statusText = String((status as unknown as Record<string, unknown>).status || "").toUpperCase();
      if (statusText === "COMPLETED") {
        const result = await fal.queue.result(endpoint, { requestId: String(generation.fal_job_id) });
        const resultUrl = extractUrl((result as Record<string, unknown>).data || result);
        const stored = await fetchAndStoreProviderResult(supabase, generation, resultUrl);
        return await completeProviderGeneration(supabase, generation, stored.signedUrl, result);
      }
      const progress = Math.min(95, Math.max(Number(generation.progress || 5), Number(generation.progress || 5) + 8));
      const { data } = await supabase.from("generations").update({ status: "running", progress, provider_payload: status }).eq("id", generation.id).select("*").single();
      await trackGenerationJob(supabase, data, "running", { reconciled_at: new Date().toISOString() });
      return data;
    } catch (err) {
      const { data } = await supabase.from("generations").update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "fal.ai status failed",
        completed_at: new Date().toISOString(),
      }).eq("id", generation.id).select("*").single();
      await refundFailedGeneration(supabase, data);
      await trackGenerationJob(supabase, data, "failed", { error: data?.error_message || "provider_status_failed" });
      await advanceBatch(supabase, data);
      return data;
    }
  }

  if (Deno.env.get("FAL_KEY") && Number.isFinite(createdAt) && Date.now() - createdAt < 120000) return generation;

  const { data } = await supabase.from("generations").update({
    status: "failed",
    error_message: "Le resultat n'a pas pu etre finalise.",
    completed_at: new Date().toISOString(),
  }).eq("id", generation.id).select("*").single();
  await refundFailedGeneration(supabase, data);
  await trackGenerationJob(supabase, data, "failed", { error: data?.error_message || "provider_job_missing" });
  return data;
}

async function generationStatus(req: Request, generationId: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const { data: generation, error } = await supabase.from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!generation) return json({ error: { message: "Generation not found" } }, 404);
  const synced = await syncGeneration(supabase, generation);
  const [withFreshMediaUrl] = await refreshGenerationMediaUrls(supabase, [synced]);
  const { data: profile } = await supabase.from("profiles").select("credits,credits_max").eq("id", userId).single();
  return json({ generation: mediaFromGeneration(withFreshMediaUrl), credits: profile?.credits, creditsMax: profile?.credits_max });
}

async function cancelGeneration(req: Request, generationId: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const { data: generation, error } = await supabase.from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!generation) return json({ error: { message: "Generation not found" } }, 404);

  if (["pending", "running"].includes(String(generation.status))) {
    const { data: cancelled, error: cancelError } = await supabase.from("generations")
      .update({
        status: "cancelled",
        progress: 0,
        error_message: "La generation a ete annulee.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId)
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .select("*")
      .maybeSingle();
    if (cancelError) throw cancelError;
    const finalGeneration = cancelled || generation;
    if (cancelled) {
      await refundFailedGeneration(supabase, finalGeneration);
      await trackGenerationJob(supabase, finalGeneration, "cancelled", { cancelled_by: "user" });
      await advanceBatch(supabase, finalGeneration);
    }
    return json({ generation: mediaFromGeneration(finalGeneration), status: "cancelled", resultConfirmed: false });
  }

  return json({
    generation: mediaFromGeneration(generation),
    status: String(generation.status || "failed"),
    resultConfirmed: generationResultConfirmed(generation),
  });
}

async function agentRunEventsRoute(req: Request, runId: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const url = new URL(req.url);
  const afterSequence = Math.max(0, Number(url.searchParams.get("afterSequence") || url.searchParams.get("after") || 0));
  const { data, error } = await supabase.from("agent_run_events")
    .select("event_type,run_id,message_id,sequence,payload,created_at")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .gt("sequence", afterSequence)
    .order("sequence", { ascending: true })
    .limit(200);
  if (error) throw error;
  return json({
    runId,
    events: (data || []).map((event) => ({
      ...(event.payload && typeof event.payload === "object" ? event.payload : {}),
      type: event.event_type,
      runId: event.run_id,
      messageId: event.message_id || undefined,
      sequence: event.sequence,
      timestamp: event.created_at,
    })),
  });
}

async function agentRunCancellationRequested(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  runId: string,
) {
  const { data } = await supabase.from("agent_run_controls")
    .select("status")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.status === "cancel_requested" || data?.status === "cancelled";
}

async function assertAgentRunActive(
  req: Request,
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  runId: string,
) {
  if (req.signal.aborted || await agentRunCancellationRequested(supabase, userId, runId)) {
    throw new FlowtubeError(409, "La tâche a été annulée.", { code: "RUN_CANCELLED" });
  }
}

async function cancelAgentRun(req: Request, runId: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const normalizedRunId = String(runId || "").trim().slice(0, 120);
  if (!normalizedRunId) throw new FlowtubeError(400, "Référence de tâche invalide.", { code: "RUN_ID_INVALID" });
  const now = new Date().toISOString();
  const { error } = await supabase.from("agent_run_controls").upsert({
    run_id: normalizedRunId,
    user_id: userId,
    status: "cancel_requested",
    requested_at: now,
    updated_at: now,
  }, { onConflict: "run_id,user_id" });
  if (error) throw error;
  const { data: lastEvent } = await supabase.from("agent_run_events")
    .select("sequence")
    .eq("run_id", normalizedRunId)
    .eq("user_id", userId)
    .order("sequence", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sequence = Math.max(1, Number(lastEvent?.sequence || 0) + 1);
  await supabase.from("agent_run_events").upsert({
    run_id: normalizedRunId,
    user_id: userId,
    sequence,
    event_type: "run.cancelled",
    payload: { type: "run.cancelled", runId: normalizedRunId, sequence, timestamp: now, status: "cancelled", resultConfirmed: false },
  }, { onConflict: "run_id,sequence" });
  await supabase.from("agent_run_controls").update({ status: "cancelled", updated_at: now })
    .eq("run_id", normalizedRunId).eq("user_id", userId);
  return json({ runId: normalizedRunId, status: "cancelled", resultConfirmed: false });
}

async function backgroundTasksRoute(req: Request) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const recentSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [activeResult, recentResult, workflowResult] = await Promise.all([
    supabase.from("generations").select("*").eq("user_id", userId).in("status", ["pending", "running"]).order("created_at", { ascending: false }).limit(24),
    supabase.from("generations").select("*").eq("user_id", userId).in("status", ["completed", "failed", "cancelled"]).gte("completed_at", recentSince).order("completed_at", { ascending: false }).limit(24),
    supabase.from("agent_tasks").select("*").eq("user_id", userId).eq("task_type", "workflow").is("parent_task_id", null).order("updated_at", { ascending: false }).limit(12),
  ]);
  if (activeResult.error) throw activeResult.error;
  if (recentResult.error) throw recentResult.error;
  if (workflowResult.error) throw workflowResult.error;

  const syncedActive: Record<string, unknown>[] = [];
  const batchIds = new Set<string>();
  for (const generation of activeResult.data || []) {
    const batch = batchInfoOf(generation);
    if (batch) batchIds.add(batch.id);
  }
  for (const batchId of batchIds) {
    try { await launchBatchWave(supabase, userId, batchId); } catch (error) { console.error("batch recovery failed", safeLogMessage(error)); }
  }
  for (const generation of (activeResult.data || []).slice(0, 8)) {
    try {
      syncedActive.push(await syncGeneration(supabase, generation));
    } catch {
      syncedActive.push(generation);
    }
  }
  for (const generation of (activeResult.data || []).slice(8)) syncedActive.push(generation);
  const byId = new Map<string, Record<string, unknown>>();
  for (const generation of syncedActive) byId.set(String(generation.id), generation);
  for (const generation of recentResult.data || []) byId.set(String(generation.id), generation);

  const refreshedTasks = await refreshGenerationMediaUrls(supabase, Array.from(byId.values()));
  const tasks = refreshedTasks
    .sort((a, b) => new Date(String(b.completed_at || b.created_at || 0)).getTime() - new Date(String(a.completed_at || a.created_at || 0)).getTime())
    .map((generation) => mediaFromGeneration(generation));
  return json({
    tasks,
    activeCount: tasks.filter((task) => task.status === "pending" || task.status === "running").length,
    workflows: (workflowResult.data || []).map(agentTaskPayload),
    serverTime: new Date().toISOString(),
  });
}

async function createProjectRoute(req: Request) {
  const body = await bodyJson(req);
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  await ensureProfile(supabase, userId);
  const result = await createProject(supabase, userId, String(body.title || "Nouveau projet"));
  return json({ project: { id: result.project.id, title: result.project.title, conversationId: result.conversation.id } });
}

async function projectRoute(req: Request, projectId: string) {
  if (!isUuid(projectId)) return json({ error: { message: "Project not found" } }, 404);
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const { data: project, error: projectError } = await supabase.from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return json({ error: { message: "Project not found" } }, 404);

  if (req.method === "PATCH") {
    const body = await bodyJson(req);
    const title = String(body.title || "").replace(/\s+/g, " ").trim().slice(0, 80) || "Nouveau projet";
    const { data: updated, error } = await supabase.from("projects")
      .update({ title })
      .eq("id", projectId)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw error;
    await supabase.from("conversations").update({ title }).eq("project_id", projectId).eq("user_id", userId);
    return json({ project: { id: updated.id, title: updated.title } });
  }

  if (req.method === "DELETE") {
    await supabase.from("messages").delete().eq("project_id", projectId).eq("user_id", userId);
    await supabase.from("generations").delete().eq("project_id", projectId).eq("user_id", userId);
    await supabase.from("agent_memory").delete().eq("project_id", projectId).eq("user_id", userId);
    await supabase.from("agent_skills").delete().eq("project_id", projectId).eq("user_id", userId);
    await supabase.from("brand_assets").delete().eq("project_id", projectId).eq("user_id", userId);
    await supabase.from("conversations").delete().eq("project_id", projectId).eq("user_id", userId);
    const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("user_id", userId);
    if (error) throw error;
    return json({ ok: true, projectId });
  }

  return json({ error: { message: "Project route not found" } }, 404);
}

async function profileRoute(req: Request) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);

  if (req.method === "GET") {
    return json({
      user: {
        id: profile.id,
        email: profile.email,
        billingEmail: profile.billing_email,
        name: profile.display_name,
        plan: profile.plan,
        preferences: cleanMetadata(cleanMetadata(profile.metadata).preferences),
      },
      credits: profile.credits,
      creditsMax: profile.credits_max,
    });
  }

  if (req.method !== "POST") return json({ error: { message: "Profile route not found" } }, 404);

  const body = await bodyJson(req);
  const metadata = cleanMetadata(profile.metadata);
  const incomingPreferences = cleanMetadata(body.preferences || body.prefs);
  const preferences = {
    ...cleanMetadata(metadata.preferences),
    ...incomingPreferences,
  };
  const patch: Record<string, unknown> = { metadata: { ...metadata, preferences } };
  const displayName = String(body.displayName || body.name || "").replace(/\s+/g, " ").trim();
  if (displayName) patch.display_name = displayName.slice(0, 80);
  const billingEmail = String(body.billingEmail || body.email || "").trim().toLowerCase();
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billingEmail)) patch.billing_email = billingEmail;

  const { data: updated, error } = await supabase.from("profiles")
    .update(patch)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;

  return json({
    user: {
      id: updated.id,
      email: updated.email,
      billingEmail: updated.billing_email,
      name: updated.display_name,
      plan: updated.plan,
      preferences: cleanMetadata(cleanMetadata(updated.metadata).preferences),
    },
    credits: updated.credits,
    creditsMax: updated.credits_max,
    preferences: cleanMetadata(cleanMetadata(updated.metadata).preferences),
  });
}

function compactText(value: unknown, max = 120) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function safeStructuredContent(value: unknown, maxBytes = 100_000) {
  const content = cleanMetadata(value);
  if (new TextEncoder().encode(JSON.stringify(content)).byteLength > maxBytes) {
    throw new FlowtubeError(413, "Ce contenu est trop volumineux.", { code: "CONTENT_TOO_LARGE" });
  }
  return content;
}

async function recordProductEvent(
  supabase: ReturnType<typeof adminClient>,
  userId: string | null,
  eventName: string,
  metadata: Record<string, unknown> = {},
  sessionId = "",
) {
  const name = compactText(eventName, 100).toLowerCase();
  if (!/^[a-z0-9_:-]+$/.test(name)) return;
  const { error } = await supabase.from("product_events").insert({
    user_id: userId || null,
    session_id: compactText(sessionId, 120) || null,
    event_name: name,
    metadata: safeStructuredContent(metadata, 12_000),
  });
  if (error) console.error("product event tracking failed", safeLogMessage(error.message));
}

async function brandKitsRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const list = async () => {
    const { data, error } = await supabase.from("brand_kits").select("*").eq("user_id", userId).order("is_default", { ascending: false }).order("updated_at", { ascending: false });
    if (error) throw error;
    return data || [];
  };
  if (req.method === "GET") return json({ brands: await list() });
  const body = await bodyJson(req);
  const action = String(body.action || "save");
  if (action === "delete") {
    const id = String(body.id || "");
    if (!isUuid(id)) throw new FlowtubeError(400, "Marque introuvable.", { code: "INVALID_BRAND_ID" });
    const { error } = await supabase.from("brand_kits").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
    await recordProductEvent(supabase, userId, "brand_deleted", { brand_id: id });
    return json({ brands: await list() });
  }
  const name = compactText(body.name, 80);
  if (!name) throw new FlowtubeError(400, "Donne un nom a cette marque.", { code: "BRAND_NAME_REQUIRED" });
  const profile = safeStructuredContent(body.profile || body.details || {}, 30_000);
  const isDefault = body.isDefault === true || body.is_default === true;
  if (isDefault) {
    const { error } = await supabase.from("brand_kits").update({ is_default: false }).eq("user_id", userId);
    if (error) throw error;
  }
  const id = String(body.id || "");
  if (isUuid(id)) {
    const { error } = await supabase.from("brand_kits").update({ name, profile, is_default: isDefault }).eq("id", id).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("brand_kits").insert({ user_id: userId, name, profile, is_default: isDefault });
    if (error) throw error;
  }
  await recordProductEvent(supabase, userId, "brand_saved", { default: isDefault });
  return json({ brands: await list() });
}

async function templatesRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const list = async () => {
    const { data, error } = await supabase.from("creative_templates")
      .select("id,user_id,project_id,brand_kit_id,source_generation_id,title,kind,visibility,content,remix_count,last_remixed_at,created_at,updated_at")
      .or(`user_id.eq.${userId},visibility.eq.public`)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  };
  if (req.method === "GET") return json({ templates: await list() });
  const body = await bodyJson(req);
  const action = String(body.action || "create");
  if (action === "delete") {
    const id = String(body.id || "");
    if (!isUuid(id)) throw new FlowtubeError(400, "Template introuvable.", { code: "INVALID_TEMPLATE_ID" });
    const { error } = await supabase.from("creative_templates").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
    await recordProductEvent(supabase, userId, "template_deleted", { template_id: id });
    return json({ templates: await list() });
  }
  if (action === "remix") {
    const sourceId = String(body.id || body.templateId || "");
    if (!isUuid(sourceId)) throw new FlowtubeError(400, "Template introuvable.", { code: "INVALID_TEMPLATE_ID" });
    const { data: source, error } = await supabase.from("creative_templates").select("*").eq("id", sourceId).maybeSingle();
    if (error) throw error;
    if (!source || (source.user_id !== userId && source.visibility !== "public")) throw new FlowtubeError(404, "Template indisponible.", { code: "TEMPLATE_NOT_FOUND" });
    const { data: created, error: createError } = await supabase.from("creative_templates").insert({
      user_id: userId,
      project_id: body.projectId && isUuid(String(body.projectId)) ? body.projectId : null,
      brand_kit_id: body.brandKitId && isUuid(String(body.brandKitId)) ? body.brandKitId : null,
      source_generation_id: source.source_generation_id || null,
      title: compactText(body.title || `Remix - ${source.title}`, 120),
      kind: source.kind || "creative",
      visibility: "private",
      content: { ...cleanMetadata(source.content), remixed_from: source.id },
    }).select("*").single();
    if (createError) throw createError;
    await supabase.from("creative_templates").update({ remix_count: Number(source.remix_count || 0) + 1, last_remixed_at: new Date().toISOString() }).eq("id", source.id);
    await recordProductEvent(supabase, userId, "template_remixed", { source_template_id: source.id, template_id: created.id });
    return json({ template: created, templates: await list() });
  }
  const title = compactText(body.title, 120);
  if (!title) throw new FlowtubeError(400, "Donne un nom a ce template.", { code: "TEMPLATE_TITLE_REQUIRED" });
  const kind = ["creative", "ugc", "image", "video", "campaign", "workflow"].includes(String(body.kind)) ? String(body.kind) : "creative";
  const visibility = body.visibility === "public" ? "public" : "private";
  const content = safeStructuredContent(body.content || {}, 100_000);
  const id = String(body.id || "");
  if (isUuid(id)) {
    const { error } = await supabase.from("creative_templates").update({ title, kind, visibility, content }).eq("id", id).eq("user_id", userId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("creative_templates").insert({
      user_id: userId,
      project_id: body.projectId && isUuid(String(body.projectId)) ? body.projectId : null,
      brand_kit_id: body.brandKitId && isUuid(String(body.brandKitId)) ? body.brandKitId : null,
      source_generation_id: body.generationId && isUuid(String(body.generationId)) ? body.generationId : null,
      title,
      kind,
      visibility,
      content,
    });
    if (error) throw error;
  }
  await recordProductEvent(supabase, userId, "template_saved", { kind, visibility });
  return json({ templates: await list() });
}

type OAuthProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  authStyle?: "basic" | "body";
};

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  google_drive: { authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", scopes: ["openid", "email", "https://www.googleapis.com/auth/drive.readonly"], clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID", clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET" },
  slack: { authorizeUrl: "https://slack.com/oauth/v2/authorize", tokenUrl: "https://slack.com/api/oauth.v2.access", scopes: ["identity.basic", "files:read", "search:read"], clientIdEnv: "SLACK_OAUTH_CLIENT_ID", clientSecretEnv: "SLACK_OAUTH_CLIENT_SECRET" },
  notion: { authorizeUrl: "https://api.notion.com/v1/oauth/authorize", tokenUrl: "https://api.notion.com/v1/oauth/token", scopes: [], clientIdEnv: "NOTION_OAUTH_CLIENT_ID", clientSecretEnv: "NOTION_OAUTH_CLIENT_SECRET", authStyle: "basic" },
};

function oauthCallbackUrl() {
  return Deno.env.get("FLOWTUBE_OAUTH_CALLBACK_URL") || `${SUPABASE_URL}/functions/v1/flowtube-api/integrations/oauth/callback`;
}

function oauthConfig(provider: string) {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) throw new FlowtubeError(400, "Ce connecteur ne propose pas encore OAuth.", { code: "OAUTH_PROVIDER_UNSUPPORTED" });
  const clientId = Deno.env.get(config.clientIdEnv) || "";
  const clientSecret = Deno.env.get(config.clientSecretEnv) || "";
  if (!clientId || !clientSecret) throw new FlowtubeError(503, "OAuth n’est pas configuré pour ce connecteur.", { code: "OAUTH_NOT_CONFIGURED", provider });
  return { ...config, clientId, clientSecret };
}

async function connectorCryptoKey() {
  const raw = Deno.env.get("FLOWTUBE_CONNECTOR_ENCRYPTION_KEY") || "";
  if (!raw) throw new FlowtubeError(503, "Le coffre de connecteurs n’est pas configuré.", { code: "CONNECTOR_VAULT_NOT_CONFIGURED" });
  const bytes = base64UrlBytes(raw);
  if (bytes.length !== 32) throw new FlowtubeError(503, "La clé du coffre de connecteurs doit faire 32 octets.", { code: "CONNECTOR_VAULT_KEY_INVALID" });
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptConnectorSecret(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await connectorCryptoKey(), new TextEncoder().encode(value));
  return `${base64FromBytes(iv)}.${base64FromBytes(new Uint8Array(encrypted))}`;
}

async function decryptConnectorSecret(value: string) {
  const [ivRaw, cipherRaw] = String(value || "").split(".");
  if (!ivRaw || !cipherRaw) throw new FlowtubeError(500, "Secret de connecteur illisible.", { code: "CONNECTOR_SECRET_INVALID" });
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64UrlBytes(ivRaw) }, await connectorCryptoKey(), base64UrlBytes(cipherRaw));
  return new TextDecoder().decode(plain);
}

async function refreshConnectorAccessToken(supabase: any, userId: string, provider: string, secret: any) {
  const expiresAt = secret && secret.expires_at ? new Date(String(secret.expires_at)).getTime() : 0;
  const stillValid = expiresAt > Date.now() + 60_000;
  if (stillValid || !secret?.refresh_token_ciphertext) return decryptConnectorSecret(String(secret.access_token_ciphertext));
  const config = oauthConfig(provider);
  const refreshToken = await decryptConnectorSecret(String(secret.refresh_token_ciphertext));
  const form = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  const headers = new Headers({ 'content-type':'application/x-www-form-urlencoded', accept:'application/json' });
  if (config.authStyle === 'basic') headers.set('authorization', `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`);
  else { form.set('client_id', config.clientId); form.set('client_secret', config.clientSecret); }
  const response = await fetch(config.tokenUrl, { method:'POST', headers, body:form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new FlowtubeError(502, 'La session du connecteur a expiré. Reconnecte ce service.', { code:'CONNECTOR_REFRESH_FAILED', provider });
  const accessCiphertext = await encryptConnectorSecret(String(payload.access_token));
  const nextRefreshCiphertext = payload.refresh_token ? await encryptConnectorSecret(String(payload.refresh_token)) : secret.refresh_token_ciphertext;
  const nextExpiresAt = payload.expires_in ? new Date(Date.now() + Number(payload.expires_in) * 1000).toISOString() : null;
  const { error } = await supabase.from('integration_secrets').update({ access_token_ciphertext:accessCiphertext, refresh_token_ciphertext:nextRefreshCiphertext, expires_at:nextExpiresAt }).eq('user_id', userId).eq('provider', provider);
  if (error) throw error;
  return String(payload.access_token);
}

async function integrationsOAuthStart(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const provider = new URL(req.url).searchParams.get("provider") || "";
  const config = oauthConfig(provider);
  const rawState = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  await supabase.from("integration_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("integration_oauth_states").insert({ state_hash: await sha256Hex(rawState), user_id: userId, provider, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  if (error) throw error;
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: oauthCallbackUrl(), response_type: "code", state: rawState });
  if (config.scopes.length) params.set("scope", config.scopes.join(" "));
  if (provider === "google_drive") params.set("access_type", "offline");
  if (provider === "google_drive") params.set("prompt", "consent");
  return json({ authorizationUrl: `${config.authorizeUrl}?${params.toString()}`, provider, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
}

async function integrationsOAuthCallback(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const errorDescription = url.searchParams.get("error_description") || url.searchParams.get("error") || "";
  const supabase = adminClient();
  if (errorDescription) return new Response(`<script>location.replace(${JSON.stringify(`${APP_BASE_URL}/?oauth_error=${encodeURIComponent(errorDescription)}`)})</script>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  if (!code || !state) throw new FlowtubeError(400, "Réponse OAuth incomplète.", { code: "OAUTH_CALLBACK_INVALID" });
  const { data: oauthState } = await supabase.from("integration_oauth_states").select("id,user_id,provider,expires_at").eq("state_hash", await sha256Hex(state)).maybeSingle();
  if (!oauthState || new Date(String(oauthState.expires_at)).getTime() < Date.now()) throw new FlowtubeError(400, "Session OAuth expirée.", { code: "OAUTH_STATE_EXPIRED" });
  await supabase.from("integration_oauth_states").delete().eq("id", oauthState.id);
  const config = oauthConfig(String(oauthState.provider));
  const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: oauthCallbackUrl() });
  if (config.authStyle === "basic") {
    form.set("redirect_uri", oauthCallbackUrl());
  } else {
    form.set("client_id", config.clientId);
    form.set("client_secret", config.clientSecret);
  }
  const headers = new Headers({ "content-type": "application/x-www-form-urlencoded", accept: "application/json" });
  if (config.authStyle === "basic") headers.set("authorization", `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`);
  const tokenResponse = await fetch(config.tokenUrl, { method: "POST", headers, body: form });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenPayload.access_token) throw new FlowtubeError(502, "Le fournisseur a refusé l’autorisation.", { code: "OAUTH_TOKEN_EXCHANGE_FAILED" });
  const accessCiphertext = await encryptConnectorSecret(String(tokenPayload.access_token));
  const refreshCiphertext = tokenPayload.refresh_token ? await encryptConnectorSecret(String(tokenPayload.refresh_token)) : null;
  const expiresAt = tokenPayload.expires_in ? new Date(Date.now() + Number(tokenPayload.expires_in) * 1000).toISOString() : null;
  const provider = String(oauthState.provider);
  await supabase.from("integration_secrets").upsert({ user_id: oauthState.user_id, provider, access_token_ciphertext: accessCiphertext, refresh_token_ciphertext: refreshCiphertext, token_type: String(tokenPayload.token_type || "Bearer"), scope: String(tokenPayload.scope || config.scopes.join(" ")), expires_at: expiresAt }, { onConflict: "user_id,provider" });
  await supabase.from("integration_connections").upsert({ user_id: oauthState.user_id, provider, status: "connected", account_label: String(tokenPayload.team?.name || tokenPayload.workspace_name || tokenPayload.user?.name || provider), credentials_ref: `vault:${oauthState.user_id}:${provider}`, permissions: { scopes: String(tokenPayload.scope || config.scopes.join(" ")).split(/[ ,]+/).filter(Boolean) }, sync_status: "ready", connected_at: new Date().toISOString(), last_error: null }, { onConflict: "user_id,provider" });
  return new Response(`<script>location.replace(${JSON.stringify(`${APP_BASE_URL}/?oauth_connected=${encodeURIComponent(provider)}`)})</script>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function integrationsSync(req: Request, provider: string) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const { data: secret } = await supabase.from("integration_secrets").select("access_token_ciphertext,refresh_token_ciphertext,expires_at").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (!secret) throw new FlowtubeError(409, "Ce connecteur n’est pas connecté.", { code: "CONNECTOR_NOT_CONNECTED" });
  let accessToken = "";
  try {
    accessToken = await refreshConnectorAccessToken(supabase, userId, provider, secret);
  } catch (error) {
    await supabase.from("integration_connections").update({ status: "error", sync_status: "error", last_error: error instanceof Error ? error.message : "Session du connecteur expirée" }).eq("user_id", userId).eq("provider", provider);
    throw error;
  }
  const endpoints: Record<string, string> = { google_drive: "https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id,name,mimeType,modifiedTime)", slack: "https://slack.com/api/auth.test", notion: "https://api.notion.com/v1/users/me" };
  const endpoint = endpoints[provider];
  if (!endpoint) throw new FlowtubeError(409, "La synchronisation de ce fournisseur n’est pas encore activée.", { code: "CONNECTOR_SYNC_UNAVAILABLE" });
  const response = await fetch(endpoint, { headers: { authorization: `Bearer ${accessToken}`, ...(provider === "notion" ? { "Notion-Version": "2022-06-28" } : {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (provider === "slack" && payload.ok === false)) {
    await supabase.from("integration_connections").update({ status: "error", sync_status: "error", last_error: String(payload.error || "Synchronisation refusée") }).eq("user_id", userId).eq("provider", provider);
    throw new FlowtubeError(502, "La synchronisation du connecteur a échoué.", { code: "CONNECTOR_SYNC_FAILED" });
  }
  await supabase.from("integration_connections").update({ status: "connected", sync_status: "healthy", last_synced_at: new Date().toISOString(), last_error: null }).eq("user_id", userId).eq("provider", provider);
  await recordProductEvent(supabase, userId, "connector_synced", { provider });
  return json({ provider, syncedAt: new Date().toISOString(), summary: provider === "google_drive" ? { files: Array.isArray(payload.files) ? payload.files.length : 0 } : { ok: true } });
}

async function integrationsRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const providers = ["google_drive", "whatsapp_business", "meta_ads", "tiktok", "slack", "notion", "webhook"];
  const list = async () => {
    const { data, error } = await supabase.from("integration_connections").select("id,provider,status,account_label,configuration,permissions,sync_status,last_error,connected_at,updated_at,last_tested_at,last_synced_at").eq("user_id", userId).order("provider");
    if (error) throw error;
    const connected = new Map((data || []).map((item) => [item.provider, item]));
    return providers.map((provider) => connected.get(provider) || { provider, status: "disconnected", account_label: null, configuration: {}, permissions: {}, sync_status: "idle" });
  };
  if (req.method === "GET") return json({ connections: await list() });
  const body = await bodyJson(req);
  const provider = String(body.provider || "");
  if (!providers.includes(provider)) throw new FlowtubeError(400, "Connecteur invalide.", { code: "INVALID_CONNECTOR" });
  const action = String(body.action || "configure");
  if (action === "configure" || action === "reconnect" || action === "oauth_start") return await integrationsOAuthStart(new Request(`${new URL(req.url).origin}${new URL(req.url).pathname}?provider=${encodeURIComponent(provider)}`, { method: "GET", headers: req.headers }));
  if (action === "sync") return await integrationsSync(req, provider);
  if (action === "test") return await integrationsSync(req, provider);
  if (action === "reconnect") return await integrationsOAuthStart(new Request(`${new URL(req.url).origin}${new URL(req.url).pathname}?provider=${encodeURIComponent(provider)}`, { method: "GET", headers: req.headers }));
  if (action === "disconnect") {
    const { error } = await supabase.from("integration_connections").upsert({ user_id: userId, provider, status: "disconnected", account_label: null, credentials_ref: null, configuration: {}, permissions: {}, sync_status: "idle", last_error: null, connected_at: null, last_tested_at: null, last_synced_at: null }, { onConflict: "user_id,provider" });
    if (error) throw error;
    const { error: secretError } = await supabase.from("integration_secrets").delete().eq("user_id", userId).eq("provider", provider);
    if (secretError) throw secretError;
    await recordProductEvent(supabase, userId, "connector_disconnected", { provider });
    return json({ connections: await list() });
  }
  const configuration = safeStructuredContent(body.configuration || {}, 12_000);
  if (/(access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|password|private[_ -]?key)/i.test(JSON.stringify(configuration))) {
    throw new FlowtubeError(400, "Ne stocke pas de secret dans la configuration du connecteur. Utilise OAuth.", { code: "CONNECTOR_SECRET_NOT_ALLOWED" });
  }
  const permissions = safeStructuredContent(body.permissions || {}, 4_000);
  const { error } = await supabase.from("integration_connections").upsert({
    user_id: userId,
    provider,
    status: "pending",
    account_label: compactText(body.accountLabel || "", 120) || null,
    configuration,
    permissions,
    sync_status: "pending",
    last_error: null,
  }, { onConflict: "user_id,provider" });
  if (error) throw error;
  await recordProductEvent(supabase, userId, "connector_configuration_requested", { provider });
  return await integrationsOAuthStart(new Request(`${new URL(req.url).origin}${new URL(req.url).pathname}?provider=${encodeURIComponent(provider)}`, { method: "GET", headers: req.headers }));
}

async function exportPackageRoute(req: Request) {
  const body = await bodyJson(req);
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const projectId = String(body.projectId || "");
  if (!isUuid(projectId)) throw new FlowtubeError(400, "Projet introuvable.", { code: "INVALID_PROJECT_ID" });
  const { data: project, error: projectError } = await supabase.from("projects").select("id,title,created_at,updated_at").eq("id", projectId).eq("user_id", userId).maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new FlowtubeError(404, "Projet introuvable.", { code: "PROJECT_NOT_FOUND" });
  const [{ data: generations }, { data: messages }, { data: brands }] = await Promise.all([
    supabase.from("generations").select("id,type,status,model_label,prompt,aspect_ratio,duration_seconds,result_url,created_at").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("messages").select("role,content,created_at").eq("project_id", projectId).eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("brand_kits").select("id,name,profile,is_default").eq("user_id", userId).order("is_default", { ascending: false }).limit(1),
  ]);
  const manifest = {
    version: "1.0",
    exported_at: new Date().toISOString(),
    project,
    brand: (brands || [])[0] || null,
    assets: (generations || []).map((item) => ({ id: item.id, type: item.type, status: item.status, model: item.model_label, prompt: item.prompt, aspect_ratio: item.aspect_ratio, duration_seconds: item.duration_seconds, url: item.result_url, created_at: item.created_at })),
    conversation: (messages || []).map((item) => ({ role: item.role, content: item.content, created_at: item.created_at })),
  };
  const { data: record, error } = await supabase.from("export_packages").insert({ user_id: userId, project_id: projectId, status: "ready", format: "campaign_manifest", manifest }).select("id,created_at").single();
  if (error) throw error;
  await recordProductEvent(supabase, userId, "project_exported", { project_id: projectId, export_id: record?.id || null, asset_count: manifest.assets.length });
  return json({ exportId: record?.id || null, fileName: `${compactText(project.title, 48).replace(/[^a-z0-9-_]/gi, "-") || "huggyflow-project"}-package.json`, manifest });
}

async function feedbackRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  if (req.method === "GET") {
    const { data, error } = await supabase.from("user_feedback").select("id,kind,message,status,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    return json({ feedback: data || [] });
  }
  const body = await bodyJson(req);
  const message = String(body.message || "").trim().slice(0, 4000);
  if (message.length < 3) throw new FlowtubeError(400, "Ecris un peu plus de details.", { code: "FEEDBACK_MESSAGE_REQUIRED" });
  const kind = ["feedback", "bug", "feature_request", "billing"].includes(String(body.kind)) ? String(body.kind) : "feedback";
  const { data, error } = await supabase.from("user_feedback").insert({ user_id: userId, kind, message, metadata: safeStructuredContent(body.metadata || {}, 8_000) }).select("id,kind,message,status,created_at").single();
  if (error) throw error;
  await recordProductEvent(supabase, userId, "feedback_sent", { kind });
  return json({ feedback: data });
}

async function productEventRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  await enforceRateLimit(req, supabase, "product_event", userId, 120);
  const body = await bodyJson(req);
  const eventName = compactText(body.event || body.eventName, 100).toLowerCase();
  if (!/^[a-z0-9_:-]+$/.test(eventName)) throw new FlowtubeError(400, "Evenement invalide.", { code: "INVALID_EVENT" });
  await recordProductEvent(supabase, userId, eventName, safeStructuredContent(body.metadata || {}, 8_000), String(body.sessionId || ""));
  return json({ ok: true });
}

async function accountExportRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const [profile, projects, templates, brands, feedback, generations, messages, mediaAssets, connections] = await Promise.all([
    supabase.from("profiles").select("id,email,billing_email,display_name,plan,credits,credits_max,metadata,created_at,updated_at").eq("id", userId).maybeSingle(),
    supabase.from("projects").select("id,title,created_at,updated_at,archived").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("creative_templates").select("id,title,kind,visibility,content,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("brand_kits").select("id,name,profile,is_default,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("user_feedback").select("kind,message,status,created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("generations").select("id,project_id,type,status,model_id,model_label,prompt,aspect_ratio,duration_seconds,result_url,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("messages").select("id,project_id,conversation_id,role,content,created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("media_assets").select("id,generation_id,bucket,object_path,content_type,bytes,source_url,public_url,status,created_at,updated_at").eq("user_id", userId).order("created_at", { ascending: true }),
    supabase.from("integration_connections").select("provider,status,account_label,configuration,connected_at,updated_at").eq("user_id", userId).order("provider"),
  ]);
  const exportData = {
    exported_at: new Date().toISOString(),
    account: profile.data || null,
    projects: projects.data || [],
    templates: templates.data || [],
    brands: brands.data || [],
    feedback: feedback.data || [],
    generations: generations.data || [],
    messages: messages.data || [],
    media_assets: mediaAssets.data || [],
    integrations: connections.data || [],
  };
  await recordProductEvent(supabase, userId, "account_data_exported");
  return json({ fileName: "huggyflow-mon-compte.json", export: exportData });
}

async function deleteStoragePrefix(
  supabase: ReturnType<typeof adminClient>,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<void> {
  if (depth > 6) throw new FlowtubeError(500, "Organisation des fichiers invalide.", { code: "STORAGE_DELETE_DEPTH" });
  let offset = 0;
  const files: string[] = [];
  const folders: string[] = [];
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new FlowtubeError(500, "Impossible de preparer la suppression des fichiers.", { code: "STORAGE_LIST_FAILED" });
    const objects = data || [];
    for (const object of objects) {
      const path = `${prefix}/${object.name}`;
      if (object.id) files.push(path);
      else folders.push(path);
    }
    if (objects.length < 1000) break;
    offset += objects.length;
  }
  for (const folder of folders) await deleteStoragePrefix(supabase, bucket, folder, depth + 1);
  for (let index = 0; index < files.length; index += 1000) {
    const { error } = await supabase.storage.from(bucket).remove(files.slice(index, index + 1000));
    if (error) throw new FlowtubeError(500, "Impossible de supprimer les fichiers du compte.", { code: "STORAGE_REMOVE_FAILED" });
  }
}

async function deleteAccountRoute(req: Request) {
  const body = await bodyJson(req);
  const confirmation = String(body.confirmation || "").trim().toUpperCase();
  if (confirmation !== "SUPPRIMER") {
    throw new FlowtubeError(400, "Ecris SUPPRIMER pour confirmer cette action definitive.", { code: "DELETE_CONFIRMATION_REQUIRED" });
  }
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  await deleteStoragePrefix(supabase, MEDIA_BUCKET, userId);
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw new FlowtubeError(500, "Impossible de supprimer le compte pour le moment.", { code: "ACCOUNT_DELETE_FAILED" });
  return json({ ok: true });
}

async function healthRoute() {
  await refreshOpenRouterCatalog();
  const openRouterMediaReady = openRouterCatalogCache.image.length + openRouterCatalogCache.video.length > 0;
  return json({
    ok: true,
    service: "huggyflow",
    now: new Date().toISOString(),
    services: {
      models: openRouterCatalogCache.live ? "ready" : "degraded",
      media: openRouterMediaReady || falMediaConfigured() ? "ready" : "degraded",
    },
    });
}

async function authRoute(req: Request, action: string) {
  const body = await bodyJson(req);
  const supabase = adminClient();
  const authClient = publicClient();
  if (action === "signup" && req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || password.length < 8) throw new FlowtubeError(400, "Email et mot de passe de 8 caracteres minimum requis.", { code: "INVALID_AUTH_INPUT" });
    const { data, error } = await authClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${APP_BASE_URL}/`,
        data: { display_name: body.displayName || body.name || "Utilisateur" },
      },
    });
    if (error) throw new FlowtubeError(400, error.message, { code: "SIGNUP_FAILED" });
    if (data.user?.id) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email,
        billing_email: email,
        display_name: String(body.displayName || body.name || "Utilisateur"),
        plan: "free",
        credits: 100,
        credits_max: 100,
        currency: DEFAULT_BILLING_CURRENCY.toLowerCase(),
      }, { onConflict: "id" });
      await attachAffiliateReferral(supabase, data.user.id, email, String(body.referralCode || body.referral_code || ""));
    }
    return json({ user: data.user, session: data.session, needsEmailConfirmation: !data.session });
  }

  if (action === "refresh" && req.method === "POST") {
    const refreshToken = String(body.refreshToken || body.refresh_token || "").trim();
    if (!refreshToken) throw new FlowtubeError(400, "Session a renouveler introuvable.", { code: "REFRESH_TOKEN_REQUIRED" });
    const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) throw new FlowtubeError(401, error?.message || "Session expiree. Reconnecte-toi.", { code: "REFRESH_FAILED" });
    if (data.user?.id) await ensureProfile(supabase, data.user.id);
    return json({ user: data.user, session: data.session });
  }

  if (action === "login" && req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) throw new FlowtubeError(401, error.message, { code: "LOGIN_FAILED" });
    if (data.user?.id) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email,
        billing_email: email,
        display_name: data.user.user_metadata?.display_name || data.user.email || "Utilisateur",
        currency: DEFAULT_BILLING_CURRENCY.toLowerCase(),
      }, { onConflict: "id" });
    }
    return json({ user: data.user, session: data.session });
  }

  if (action === "recover" && req.method === "POST") {
    const email = String(body.email || "").trim().toLowerCase();
    const { error } = await authClient.auth.resetPasswordForEmail(email, { redirectTo: `${APP_BASE_URL}/` });
    if (error) throw new FlowtubeError(400, error.message, { code: "RECOVER_FAILED" });
    return json({ ok: true });
  }

  if (action === "me" && req.method === "GET") {
    const userId = await authenticatedUserIdFromRequest(req, supabase);
    const profile = await ensureProfile(supabase, userId);
    return json({ user: { id: profile.id, email: profile.email, name: profile.display_name, plan: profile.plan }, credits: profile.credits, creditsMax: profile.credits_max });
  }

  if (action === "logout" && req.method === "POST") {
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
    if (token) {
      try {
        await supabase.auth.admin.signOut(token);
      } catch (_err) {
        // Local logout still succeeds; the short-lived access token will expire naturally.
      }
    }
    return json({ ok: true });
  }

  return json({ error: { message: "Auth route not found" } }, 404);
}

async function createMoneyFusionCheckout(
  supabase: ReturnType<typeof adminClient>,
  profile: Record<string, unknown>,
  body: Record<string, unknown>,
  type: string,
  interval: string,
  successUrl: string,
  cancelUrl: string,
) {
  const userId = String(profile.id);
  const profileMetadata = (profile.metadata || {}) as Record<string, unknown>;
  const idempotencyKey = String(body.idempotencyKey || body.idempotency_key || "").trim().slice(0, 120);
  if (idempotencyKey) {
    const { data: existing } = await supabase.from("billing_checkout_sessions")
      .select("checkout_url,provider_session_id,provider_payment_token,status")
      .eq("user_id", userId)
      .eq("provider", "moneyfusion")
      .eq("status", "open")
      .contains("metadata", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existing?.checkout_url) {
      return json({ url: existing.checkout_url, sessionId: existing.provider_session_id, reused: true });
    }
  }
  const phone = moneyFusionPhone(body.customerPhone || body.phone || profile.billing_phone || profileMetadata.phone || "");
  if (!phone) {
    throw new FlowtubeError(400, "Entre un numero Mobile Money valide pour continuer.", { code: "MONEYFUSION_PHONE_REQUIRED" });
  }

  let amountUsd = 0;
  let article = `${APP_NAME} credits`;
  let plan: PlanLimits | null = null;
  let pack: Record<string, unknown> | null = null;
  let creditOption: Record<string, unknown> | null = null;
  const metadata: Record<string, unknown> = { provider: "moneyfusion", type, interval, ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}) };

  if (type === "credits") {
    const packId = String(body.creditPackId || body.packId || "");
    const { data } = await supabase.from("credit_packs").select("*").eq("id", packId).eq("active", true).maybeSingle();
    if (!data) throw new FlowtubeError(404, "Pack de credits introuvable.", { code: "PACK_NOT_FOUND" });
    pack = data;
    amountUsd = Number(data.price_usd || 0);
    article = `${APP_NAME} - ${data.label || "pack credits"}`;
    metadata.credit_pack_id = data.id;
  } else {
    const planId = normalizePlanId(String(body.planId || "basic"));
    plan = await resolvePlan(supabase, planId);
    if (plan.id === "free") throw new FlowtubeError(400, "Le plan Free ne necessite pas de checkout.", { code: "FREE_PLAN" });
    const optionId = String(body.creditOptionId || body.credit_option_id || "").trim();
    if (optionId) {
      const { data: option } = await supabase.from("pricing_plan_options")
        .select("id,plan_id,credits,monthly_price_xof,annual_price_xof,metadata")
        .eq("id", optionId)
        .eq("plan_id", plan.id)
        .eq("active", true)
        .maybeSingle();
      if (!option) throw new FlowtubeError(400, "Cette option de crédits n’est plus disponible.", { code: "CREDIT_OPTION_UNAVAILABLE" });
      creditOption = option;
    }
    amountUsd = interval === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd;
    article = `${APP_NAME} ${plan.displayName} ${interval}`;
    metadata.plan_id = plan.id;
    if (creditOption) metadata.credit_option_id = creditOption.id;
  }

  const reference = crypto.randomUUID();
  const baseAmountXof = plan
    ? creditOption
      ? Number(interval === "annual" ? creditOption.annual_price_xof : creditOption.monthly_price_xof)
      : planAmountXof(plan, interval === "annual" ? "annual" : "monthly")
    : Math.max(100, Number(pack?.amount_xof || moneyFusionAmount(amountUsd)));
  const amountXof = moneyFusionCheckoutAmountXof(baseAmountXof);
  metadata.base_amount_xof = baseAmountXof;
  metadata.moneyfusion_fee_xof = amountXof - baseAmountXof;
  metadata.moneyfusion_fee_config = moneyFusionFeeConfig();
  const pricingVersion = plan?.pricingVersion || String((pack?.metadata as Record<string, unknown> | undefined)?.pricing_version || "credit-pack");
  const callbackUrl = moneyFusionCallbackUrl();
  const returnUrl = moneyFusionSafeAppUrl(body.successUrl || successUrl, moneyFusionReturnUrl());
  const payload: Record<string, unknown> = {
    totalPrice: amountXof,
    article: [{ nom: article, montant: amountXof }],
    personal_Info: [{
      userId,
      orderId: reference,
      reference,
      type,
      plan_id: plan?.id || null,
      credit_pack_id: pack?.id || null,
      interval,
    }],
    nomclient: String(profile.display_name || profile.email || "Client Huggyflow"),
    return_url: returnUrl,
    webhook_url: callbackUrl,
    callback_url: callbackUrl,
    reference,
    currency: DEFAULT_BILLING_CURRENCY,
    metadata,
  };
  payload.numeroSend = phone;
  const session = await moneyFusionRequest(payload);
  const providerToken = session.token || reference;

  await supabase.from("billing_checkout_sessions").insert({
    user_id: userId,
    provider: "moneyfusion",
    provider_session_id: reference,
    provider_payment_token: providerToken,
    stripe_session_id: providerToken,
    mode: type === "credits" ? "payment" : "subscription",
    plan_id: plan?.id || null,
    credit_pack_id: pack?.id || null,
    credit_option_id: creditOption?.id || null,
    payment_phone: phone,
    billing_interval: type === "credits" ? null : interval,
    status: "open",
    amount_usd: amountUsd,
    amount_xof: amountXof,
    currency: DEFAULT_BILLING_CURRENCY.toLowerCase(),
    checkout_url: session.paymentUrl,
    pricing_version: pricingVersion,
    pricing_snapshot: plan ? { ...planPublic(plan), creditOption } : { pack },
    metadata: { moneyfusion: { configured: true }, payload: cleanMetadata(payload), amount_xof: amountXof, usd_xof_rate: DEFAULT_USD_XOF_RATE, pricing_version: pricingVersion, plan: plan ? planPublic(plan) : null, pack, credit_option_id: creditOption?.id || null },
    provider_payload: session.data,
  });

  return json({ url: session.paymentUrl, sessionId: reference, status: "pending" });
}

async function createFapshiCheckout(
  supabase: ReturnType<typeof adminClient>,
  profile: Record<string, unknown>,
  body: Record<string, unknown>,
  type: string,
  interval: string,
  successUrl: string,
) {
  const userId = String(profile.id);
  const profileMetadata = (profile.metadata || {}) as Record<string, unknown>;
  const idempotencyKey = String(body.idempotencyKey || body.idempotency_key || "").trim().slice(0, 120);
  if (idempotencyKey) {
    const { data: existing } = await supabase.from("billing_checkout_sessions")
      .select("checkout_url,provider_session_id,provider_payment_token,status,metadata")
      .eq("user_id", userId)
      .eq("provider", "fapshi")
      .contains("metadata", { idempotency_key: idempotencyKey })
      .maybeSingle();
    if (existing?.provider_session_id) {
      return json({
        url: existing.checkout_url || null,
        sessionId: existing.provider_session_id,
        status: existing.status,
        reused: true,
        direct: !existing.checkout_url,
      });
    }
  }

  let plan: PlanLimits | null = null;
  let pack: Record<string, unknown> | null = null;
  let creditOption: Record<string, unknown> | null = null;
  let amountXof = 0;
  if (type === "credits") {
    const packId = String(body.creditPackId || body.packId || "");
    const { data } = await supabase.from("credit_packs").select("*").eq("id", packId).eq("active", true).maybeSingle();
    if (!data) throw new FlowtubeError(404, "Pack de crédits introuvable.", { code: "PACK_NOT_FOUND" });
    pack = data;
    amountXof = Math.max(100, Number(data.amount_xof || Math.round(Number(data.price_usd || 0) * DEFAULT_USD_XOF_RATE)));
  } else {
    plan = await resolvePlan(supabase, String(body.planId || "basic"));
    if (plan.id === "free") throw new FlowtubeError(400, "Le plan Free ne nécessite pas de paiement.", { code: "FREE_PLAN" });
    const optionId = String(body.creditOptionId || body.credit_option_id || "").trim();
    if (optionId) {
      const { data: option } = await supabase.from("pricing_plan_options")
        .select("id,plan_id,credits,monthly_price_xof,annual_price_xof,metadata")
        .eq("id", optionId).eq("plan_id", plan.id).eq("active", true).maybeSingle();
      if (!option) throw new FlowtubeError(400, "Cette option de crédits n’est plus disponible.", { code: "CREDIT_OPTION_UNAVAILABLE" });
      creditOption = option;
    }
    amountXof = creditOption
      ? Number(interval === "annual" ? creditOption.annual_price_xof : creditOption.monthly_price_xof)
      : planAmountXof(plan, interval === "annual" ? "annual" : "monthly");
  }
  if (!Number.isFinite(amountXof) || amountXof < 100) throw new FlowtubeError(400, "Le montant du paiement est invalide.", { code: "PAYMENT_AMOUNT_INVALID" });

  const phone = fapshiPhone(body.customerPhone || body.phone || profile.billing_phone || profileMetadata.phone || "");
  const email = String(profile.billing_email || profile.email || "").trim().slice(0, 160);
  const externalId = crypto.randomUUID();
  const callbackUrl = Deno.env.get("FAPSHI_WEBHOOK_URL") || `${APP_BASE_URL}/api/billing/fapshi-webhook`;
  const returnUrl = moneyFusionSafeAppUrl(body.successUrl || successUrl, `${APP_BASE_URL}/?checkout=success`);
  const direct = FAPSHI_DIRECT_PAY_ENABLED && Boolean(phone);
  const providerPayload = direct
    ? { amount: amountXof, phone, medium: String(body.medium || "mobile money"), name: String(profile.display_name || "Client"), email, userId, externalId, message: `${APP_NAME} ${plan?.displayName || "crédits"}` }
    : { amount: amountXof, email, redirectUrl: returnUrl, userId, externalId, message: `${APP_NAME} ${plan?.displayName || "crédits"}` };
  const result = await fapshiRequest(direct ? "/direct-pay" : "/initiate-pay", providerPayload);
  const transactionId = String(result.transId || result.transactionId || result.trans_id || result.id || "");
  const paymentUrl = String(result.link || result.url || result.paymentUrl || "");
  if (!transactionId) throw new FlowtubeError(502, "Le paiement n’a pas renvoyé de référence.", { code: "PAYMENT_REFERENCE_MISSING" });
  if (!direct && !fapshiPublicUrl(paymentUrl)) throw new FlowtubeError(502, "La page de paiement est momentanément indisponible.", { code: "PAYMENT_URL_MISSING" });
  const metadata = {
    idempotency_key: idempotencyKey || null,
    provider: "fapshi",
    type,
    interval,
    plan_id: plan?.id || null,
    credit_pack_id: pack?.id || null,
    credit_option_id: creditOption?.id || null,
    amount_xof: amountXof,
    external_id: externalId,
    direct,
  };
  await supabase.from("billing_checkout_sessions").insert({
    user_id: userId,
    provider: "fapshi",
    provider_session_id: transactionId,
    provider_payment_token: transactionId,
    stripe_session_id: `fapshi:${transactionId}`,
    mode: type === "credits" ? "payment" : "subscription",
    plan_id: plan?.id || null,
    credit_pack_id: pack?.id || null,
    credit_option_id: creditOption?.id || null,
    payment_phone: phone || null,
    billing_interval: type === "credits" ? null : interval,
    status: "open",
    amount_usd: Number((amountXof / DEFAULT_USD_XOF_RATE).toFixed(2)),
    amount_xof: amountXof,
    currency: "xaf",
    checkout_url: paymentUrl || null,
    pricing_version: plan?.pricingVersion || "2026-08-launch-v2",
    pricing_snapshot: plan ? { ...planPublic(plan), creditOption } : { pack },
    metadata,
    provider_payload: { transactionId, direct },
  });
  return json({ url: paymentUrl || null, sessionId: transactionId, amountXof, direct, status: "pending" });
}

async function createCheckout(req: Request) {
  const body = await bodyJson(req);
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  await enforceRateLimit(req, supabase, "billing.checkout", userId, 12);
  const profile = await ensureProfile(supabase, userId);
  const testGrant = await activeTestGrant(supabase, userId);
  if (testGrant) {
    throw new FlowtubeError(409, "Cet accès de test est déjà actif. Aucun paiement n’est nécessaire.", { code: "TEST_GRANT_ACTIVE" });
  }
  const interval = String(body.interval || "monthly") === "annual" ? "annual" : "monthly";
  const type = String(body.type || (body.creditPackId ? "credits" : "subscription"));
  const successUrl = String(body.successUrl || `${APP_BASE_URL}/?checkout=success`);
  const cancelUrl = String(body.cancelUrl || `${APP_BASE_URL}/?checkout=cancelled`);
  const provider = String(
    body.provider || Deno.env.get("BILLING_PROVIDER") || (fapshiConfigured() ? "fapshi" : (moneyFusionConfigured() ? "moneyfusion" : "stripe")),
  ).toLowerCase();
  void recordProductEvent(supabase, userId, "checkout_started", {
    provider,
    type,
    interval,
    plan_id: body.planId || null,
    credit_pack_id: body.creditPackId || body.packId || null,
  });

  if (provider === "moneyfusion" || provider === "fusionpay") {
    return await createMoneyFusionCheckout(supabase, profile, body as Record<string, unknown>, type, interval, successUrl, cancelUrl);
  }
  if (provider === "fapshi") {
    return await createFapshiCheckout(supabase, profile, body as Record<string, unknown>, type, interval, successUrl);
  }

  if (type === "credits") {
    const customerId = await ensureBillingCustomer(supabase, profile);
    const packId = String(body.creditPackId || body.packId || "");
    const { data: pack } = await supabase.from("credit_packs").select("*").eq("id", packId).eq("active", true).maybeSingle();
    if (!pack) throw new FlowtubeError(404, "Pack de credits introuvable.", { code: "PACK_NOT_FOUND" });
    const priceId = stripePriceForPack(pack);
    if (!priceId) throw new FlowtubeError(503, "Price ID Stripe manquant pour ce pack.", { code: "STRIPE_PRICE_MISSING", packId });
    const session = await stripeRequest("/checkout/sessions", {
      mode: "payment",
      customer: customerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": 1,
      "metadata[user_id]": userId,
      "metadata[credit_pack_id]": pack.id,
      "metadata[type]": "credits",
    });
    await supabase.from("billing_checkout_sessions").insert({
      user_id: userId,
      stripe_session_id: session.id,
      mode: "payment",
      credit_pack_id: pack.id,
      status: session.status || "open",
      amount_usd: pack.price_usd,
      currency: session.currency || "usd",
      checkout_url: session.url,
      expires_at: session.expires_at ? new Date(Number(session.expires_at) * 1000).toISOString() : null,
      metadata: { pack },
    });
    return json({ url: session.url, sessionId: session.id });
  }

  const planId = normalizePlanId(String(body.planId || "basic"));
  const plan = await resolvePlan(supabase, planId);
  if (plan.id === "free") throw new FlowtubeError(400, "Le plan Free ne necessite pas de checkout.", { code: "FREE_PLAN" });
  const customerId = await ensureBillingCustomer(supabase, profile);
  const priceId = stripePriceForPlan(plan, interval);
  if (!priceId) throw new FlowtubeError(503, "Price ID Stripe manquant pour ce plan.", { code: "STRIPE_PRICE_MISSING", planId: plan.id, interval });
  const session = await stripeRequest("/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": 1,
    "metadata[user_id]": userId,
    "metadata[plan_id]": plan.id,
    "metadata[interval]": interval,
    "subscription_data[metadata][user_id]": userId,
    "subscription_data[metadata][plan_id]": plan.id,
    "subscription_data[metadata][interval]": interval,
  });
  await supabase.from("billing_checkout_sessions").insert({
    user_id: userId,
    stripe_session_id: session.id,
    mode: "subscription",
    plan_id: plan.id,
    billing_interval: interval,
    status: session.status || "open",
    amount_usd: interval === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd,
    currency: session.currency || "usd",
    checkout_url: session.url,
    expires_at: session.expires_at ? new Date(Number(session.expires_at) * 1000).toISOString() : null,
    metadata: { plan: planPublic(plan) },
  });
  return json({ url: session.url, sessionId: session.id });
}

async function billingStatus(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);
  const { data: transactions } = await supabase.from("credit_transactions")
    .select("id,amount,reason,balance_after,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const { data: subscription } = await supabase.from("subscriptions")
    .select("id,plan_id,status,billing_interval,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: invoices } = await supabase.from("invoices")
    .select("id,status,amount_due_usd,amount_paid_usd,currency,hosted_invoice_url,invoice_pdf,period_start,period_end,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const testGrant = publicTestGrant(await activeTestGrant(supabase, userId));
  const publicInvoices = (invoices || []).map((invoice) => ({
    id: invoice.id,
    status: invoice.status,
    amount_due: Math.max(0, Math.round(Number(invoice.amount_due_usd || 0) * 100)),
    amount_paid: Math.max(0, Math.round(Number(invoice.amount_paid_usd || 0) * 100)),
    currency: String(invoice.currency || "usd").toLowerCase(),
    hosted_invoice_url: invoice.hosted_invoice_url || null,
    invoice_pdf: invoice.invoice_pdf || null,
    period_start: invoice.period_start || null,
    period_end: invoice.period_end || null,
    created_at: invoice.created_at,
  }));
  return json({
    user: { id: profile.id, plan: profile.plan, billingStatus: profile.billing_status, currentPeriodEnd: profile.current_period_end },
    credits: profile.credits,
    creditsMax: profile.credits_max,
    currency: DEFAULT_BILLING_CURRENCY,
    usdXofRate: DEFAULT_USD_XOF_RATE,
    paymentConfigured: fapshiConfigured() || moneyFusionConfigured() || Boolean(stripeSecret()),
    paymentPhoneRequired: true,
    testGrant,
    subscription,
    invoices: publicInvoices,
    transactions: transactions || [],
  });
}

function normalizeTeamRole(value: unknown) {
  const role = String(value || "editor").toLowerCase();
  if (role === "admin") return "admin";
  if (role === "viewer" || role === "lecteur") return "viewer";
  return "editor";
}

function initialsFromName(name: string, email = "") {
  const source = (name || email || "HF").replace(/@.*/, "").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)).toUpperCase();
}

async function ensureOwnerTeamMember(supabase: ReturnType<typeof adminClient>, profile: Record<string, unknown>) {
  const email = String(profile.email || profile.billing_email || `user-${profile.id}@huggyflow.fun`).toLowerCase();
  const payload = {
    owner_id: profile.id,
    member_user_id: profile.id,
    email,
    display_name: String(profile.display_name || "Utilisateur HuggyFlow"),
    role: "owner",
    status: "active",
  };
  const { data: existing } = await supabase.from("team_members")
    .select("id")
    .eq("owner_id", profile.id)
    .ilike("email", email)
    .maybeSingle();
  if (existing?.id) await supabase.from("team_members").update(payload).eq("id", existing.id);
  else await supabase.from("team_members").insert(payload);
}

async function teamRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);
  await ensureOwnerTeamMember(supabase, profile);

  if (req.method === "POST") {
    const body = await bodyJson(req);
    const action = String(body.action || "invite");
    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new FlowtubeError(400, "Entre un e-mail valide.", { code: "INVALID_INVITE_EMAIL" });
      const role = normalizeTeamRole(body.role);
      await supabase.from("team_invites").insert({ owner_id: userId, email, role, status: "pending", metadata: { source: "dashboard" } });
    }
    if (action === "revoke") {
      const inviteId = String(body.inviteId || body.id || "");
      if (inviteId) await supabase.from("team_invites").update({ status: "revoked" }).eq("id", inviteId).eq("owner_id", userId);
    }
    if (action === "role") {
      const memberId = String(body.memberId || body.id || "");
      const role = normalizeTeamRole(body.role);
      if (memberId) await supabase.from("team_members").update({ role }).eq("id", memberId).eq("owner_id", userId).neq("role", "owner");
    }
    if (action === "grant_project_access") {
      const projectId = String(body.projectId || "");
      const memberId = String(body.memberUserId || body.memberId || "");
      if (!isUuid(projectId) || !isUuid(memberId)) throw new FlowtubeError(400, "Projet ou membre invalide.", { code: "INVALID_PROJECT_ACCESS" });
      const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
      if (!project) throw new FlowtubeError(404, "Projet introuvable.", { code: "PROJECT_NOT_FOUND" });
      const role = ["admin", "editor", "viewer"].includes(String(body.projectRole)) ? String(body.projectRole) : "viewer";
      const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : { read: true, edit: role !== "viewer", generate: role !== "viewer", publish: role === "admin" };
      await supabase.from("project_access_grants").upsert({ project_id: projectId, owner_id: userId, member_user_id: memberId, role, permissions }, { onConflict: "project_id,member_user_id" });
    }
    if (action === "revoke_project_access") {
      const projectId = String(body.projectId || "");
      const memberId = String(body.memberUserId || body.memberId || "");
      if (isUuid(projectId) && isUuid(memberId)) await supabase.from("project_access_grants").delete().eq("project_id", projectId).eq("member_user_id", memberId).eq("owner_id", userId);
    }
    if (action === "custom_role") {
      const name = compactText(body.name, 60);
      if (!name) throw new FlowtubeError(400, "Le nom du rôle est requis.", { code: "ROLE_NAME_REQUIRED" });
      const permissions = body.permissions && typeof body.permissions === "object" ? body.permissions : {};
      await supabase.from("team_custom_roles").upsert({ owner_id: userId, name, permissions }, { onConflict: "owner_id,name" });
    }
    if (action === "request_approval") {
      const projectId = String(body.projectId || "");
      const artifactId = String(body.artifactId || "");
      if (!isUuid(projectId)) throw new FlowtubeError(400, "Projet invalide.", { code: "INVALID_APPROVAL_PROJECT" });
      const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).eq("user_id", userId).maybeSingle();
      if (!project) throw new FlowtubeError(404, "Projet introuvable.", { code: "PROJECT_NOT_FOUND" });
      if (artifactId && !isUuid(artifactId)) throw new FlowtubeError(400, "Artifact invalide.", { code: "INVALID_APPROVAL_ARTIFACT" });
      if (artifactId) {
        const { data: artifact } = await supabase.from("artifacts").select("id").eq("id", artifactId).eq("project_id", projectId).eq("user_id", userId).maybeSingle();
        if (!artifact) throw new FlowtubeError(404, "Artifact introuvable.", { code: "ARTIFACT_NOT_FOUND" });
      }
      await supabase.from("project_approval_requests").insert({ project_id: projectId, owner_id: userId, requested_by: userId, artifact_id: artifactId || null, status: "pending", comment: compactText(body.comment, 1000) });
    }
    if (action === "approval") {
      const approvalId = String(body.approvalId || body.id || "");
      const status = ["approved", "rejected", "cancelled"].includes(String(body.status)) ? String(body.status) : "pending";
      if (isUuid(approvalId)) await supabase.from("project_approval_requests").update({ status, comment: compactText(body.comment, 1000), resolved_at: status === "pending" ? null : new Date().toISOString() }).eq("id", approvalId).eq("owner_id", userId);
    }
  }

  const { data: members } = await supabase.from("team_members").select("*").eq("owner_id", userId).order("created_at", { ascending: true });
  const { data: invites } = await supabase.from("team_invites").select("*").eq("owner_id", userId).eq("status", "pending").order("created_at", { ascending: false });
  const projectId = new URL(req.url).searchParams.get("projectId");
  const [{ data: projectAccess }, { data: customRoles }, { data: approvals }] = await Promise.all([
    projectId && isUuid(projectId) ? supabase.from("project_access_grants").select("*").eq("owner_id", userId).eq("project_id", projectId) : Promise.resolve({ data: [] }),
    supabase.from("team_custom_roles").select("id,name,permissions,created_at,updated_at").eq("owner_id", userId).order("name", { ascending: true }),
    supabase.from("project_approval_requests").select("id,project_id,requested_by,artifact_id,status,comment,created_at,resolved_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  return json({
    seatLimit: plan.seatLimit,
    members: (members || []).map((member) => ({
      id: member.id,
      name: member.display_name || member.email,
      email: member.email,
      initials: initialsFromName(String(member.display_name || ""), String(member.email || "")),
      role: member.role,
      status: member.status,
      isYou: String(member.member_user_id || "") === userId,
      createdAt: member.created_at,
    })),
    invites: (invites || []).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      createdAt: invite.created_at,
      expiresAt: invite.expires_at,
    })),
    projectAccess: (projectAccess || []).map((grant) => ({ id: grant.id, projectId: grant.project_id, memberUserId: grant.member_user_id, role: grant.role, permissions: grant.permissions || {} })),
    customRoles: customRoles || [],
    approvalRequests: approvals || [],
  });
}

async function apiKeysRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  await ensureProfile(supabase, userId);
  let createdKey = "";

  if (req.method === "POST") {
    const body = await bodyJson(req);
    const action = String(body.action || "create");
    if (action === "create") {
      createdKey = `hf_${randomToken(28)}`;
      const keyHash = await sha256Hex(createdKey);
      const name = String(body.name || "Cle API HuggyFlow").replace(/\s+/g, " ").trim().slice(0, 80) || "Cle API HuggyFlow";
      const allowedScopes = ["chat", "generate", "read", "publish", "team"];
      const requestedScopes = Array.isArray(body.scopes) ? body.scopes.map((scope: unknown) => String(scope)) : ["chat", "generate"];
      const scopes = [...new Set(requestedScopes.filter((scope: string) => allowedScopes.includes(scope)))];
      if (!scopes.length) throw new FlowtubeError(400, "Selectionne au moins une permission API.", { code: "API_SCOPES_REQUIRED" });
      const expirationDays = Math.max(0, Math.min(365, Number(body.expirationDays || body.expiration_days || 0)));
      const expiresAt = expirationDays ? new Date(Date.now() + expirationDays * 86400000).toISOString() : null;
      const dailyLimit = Math.max(1, Math.min(100000, Number(body.dailyLimit || body.daily_limit || 1000)));
      await supabase.from("api_keys").insert({
        user_id: userId,
        name,
        key_hash: keyHash,
        key_prefix: `${createdKey.slice(0, 10)}...`,
        scopes,
        expires_at: expiresAt,
        daily_limit: dailyLimit,
        last_rotated_at: new Date().toISOString(),
      });
    }
    if (action === "rotate") {
      const keyId = String(body.keyId || body.id || "");
      if (!keyId) throw new FlowtubeError(400, "Cle API introuvable.", { code: "API_KEY_REQUIRED" });
      await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId).eq("user_id", userId);
      createdKey = `hf_${randomToken(28)}`;
      const keyHash = await sha256Hex(createdKey);
      const expirationDays = Math.max(0, Math.min(365, Number(body.expirationDays || body.expiration_days || 0)));
      const expiresAt = expirationDays ? new Date(Date.now() + expirationDays * 86400000).toISOString() : null;
      const allowedScopes = ["chat", "generate", "read", "publish", "team"];
      const requestedScopes = Array.isArray(body.scopes) ? body.scopes.map((scope: unknown) => String(scope)) : ["chat", "generate"];
      const scopes = [...new Set(requestedScopes.filter((scope: string) => allowedScopes.includes(scope)))];
      if (!scopes.length) throw new FlowtubeError(400, "Selectionne au moins une permission API.", { code: "API_SCOPES_REQUIRED" });
      const dailyLimit = Math.max(1, Math.min(100000, Number(body.dailyLimit || body.daily_limit || 1000)));
      await supabase.from("api_keys").insert({ user_id: userId, name: String(body.name || "Cle API HuggyFlow").slice(0, 80), key_hash: keyHash, key_prefix: `${createdKey.slice(0, 10)}...`, scopes, expires_at: expiresAt, daily_limit: dailyLimit, last_rotated_at: new Date().toISOString() });
    }
    if (action === "revoke") {
      const keyId = String(body.keyId || body.id || "");
      if (keyId) await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId).eq("user_id", userId);
    }
  }

  const { data: keys } = await supabase.from("api_keys")
    .select("id,name,key_prefix,scopes,last_used_at,revoked_at,created_at,expires_at,last_rotated_at,daily_limit")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const keyIds = (keys || []).map((key) => key.id).filter(Boolean);
  const { data: usageRows } = keyIds.length ? await supabase.from("api_key_usage").select("api_key_id,route,method,status_code,credits,created_at").eq("user_id", userId).in("api_key_id", keyIds).order("created_at", { ascending: false }).limit(100) : { data: [] };
  const usageByKey = new Map<string, Record<string, unknown>[]>();
  for (const row of usageRows || []) usageByKey.set(String(row.api_key_id), [...(usageByKey.get(String(row.api_key_id)) || []), row]);
  return json({
    createdKey: createdKey || undefined,
    keys: (keys || []).map((key) => ({
      id: key.id,
      name: key.name,
      masked: key.key_prefix,
      scopes: key.scopes || [],
      createdAt: key.created_at,
      lastUsedAt: key.last_used_at,
      expiresAt: key.expires_at,
      lastRotatedAt: key.last_rotated_at,
      dailyLimit: Number(key.daily_limit || 1000),
      usageCount: (usageByKey.get(String(key.id)) || []).length,
      usageLogs: (usageByKey.get(String(key.id)) || []).slice(0, 10).map((row) => ({ route: row.route, method: row.method, statusCode: row.status_code, credits: row.credits, createdAt: row.created_at })),
      revoked: Boolean(key.revoked_at),
    })),
  });
}

async function affiliateClickRoute(req: Request) {
  if (req.method !== "POST") return json({ ok: true });
  const body = await bodyJson(req);
  const code = compactText(body.code || body.ref || "", 80).toLowerCase();
  if (!code) return json({ ok: true });
  const supabase = adminClient();
  const { data: account } = await supabase.from("affiliate_accounts")
    .select("user_id,code,status")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();
  if (!account?.user_id) return json({ ok: true });
  const ipHash = await sha256Hex(`${requestIp(req)}:${Deno.env.get("FLOWTUBE_RATE_LIMIT_SALT") || "flowtube"}`);
  const userAgentHash = await sha256Hex(req.headers.get("user-agent") || "unknown");
  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { count } = await supabase.from("affiliate_clicks")
    .select("id", { count: "exact", head: true })
    .eq("affiliate_user_id", account.user_id)
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (!count) {
    await supabase.from("affiliate_clicks").insert({
      affiliate_user_id: account.user_id,
      code,
      ip_hash: ipHash,
      user_agent_hash: userAgentHash,
      session_id: compactText(body.sessionId || "", 120) || null,
      landing_path: compactText(body.landingPath || "", 300) || null,
    });
  }
  return json({ ok: true });
}

async function attachAffiliateReferral(
  supabase: ReturnType<typeof adminClient>,
  referredUserId: string,
  email: string,
  referralCode: string,
) {
  const code = compactText(referralCode, 80).toLowerCase();
  if (!code) return;
  const { data: account } = await supabase.from("affiliate_accounts")
    .select("user_id,code,status")
    .eq("code", code)
    .eq("status", "active")
    .maybeSingle();
  if (!account?.user_id || String(account.user_id) === referredUserId) return;
  await supabase.from("affiliate_referrals").upsert({
    affiliate_user_id: account.user_id,
    referred_user_id: referredUserId,
    email: email || null,
    status: "trial",
    metadata: { code, attribution: "signup" },
  }, { onConflict: "referred_user_id" });
}

async function settleAffiliateConversion(
  supabase: ReturnType<typeof adminClient>,
  referredUserId: string,
  amountUsd: number,
  source: string,
  eventKey = "",
) {
  const gross = Math.max(0, Number(amountUsd || 0));
  if (!gross) return;
  const { data: referral } = await supabase.from("affiliate_referrals")
    .select("id,affiliate_user_id,status,amount_usd,metadata")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  if (!referral?.id) return;
  const existingMetadata = referral.metadata && typeof referral.metadata === "object" ? referral.metadata as Record<string, unknown> : {};
  if (eventKey && String(existingMetadata.commission_event_key || "") === eventKey) return;
  const commission = Number((gross * 0.30).toFixed(2));
  const nextAmount = Number((Number(referral.amount_usd || 0) + commission).toFixed(2));
  const referralPatch: Record<string, unknown> = {
    status: "active",
    amount_usd: nextAmount,
    metadata: { ...existingMetadata, source, gross_usd: gross, commission_rate: 0.30, commission_event_key: eventKey || `${source}:${referredUserId}:${gross}` },
  };
  if (referral.status !== "active") referralPatch.converted_at = new Date().toISOString();
  const { error: referralError } = await supabase.from("affiliate_referrals").update(referralPatch).eq("id", referral.id);
  if (referralError) throw referralError;
  await supabase.from("affiliate_risk_reviews").upsert({
    referral_id: referral.id,
    affiliate_user_id: referral.affiliate_user_id,
    score: 0,
    status: "clear",
    reasons: [],
  }, { onConflict: "referral_id" });
  await supabase.rpc("sync_affiliate_account_totals", { p_user_id: referral.affiliate_user_id });
}

function affiliateCode(profile: Record<string, unknown>) {
  const base = String(profile.display_name || profile.email || "huggyflow").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 14) || "huggyflow";
  return `${base}${String(profile.id || "").replace(/-/g, "").slice(0, 6)}`;
}

async function affiliateRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);

  if (req.method === "POST") {
    const body = await bodyJson(req);
    const action = String(body.action || "configure_payout");
    const payoutEmail = String(body.payoutEmail || body.email || "").trim().toLowerCase();
    if (payoutEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payoutEmail)) throw new FlowtubeError(400, "Entre un e-mail de paiement valide.", { code: "INVALID_PAYOUT_EMAIL" });
    if (action === "request_payout") {
      const { error: payoutError } = await supabase.rpc("request_affiliate_payout", { p_user_id: userId });
      if (payoutError) {
        const code = String(payoutError.message || "").includes("PAYOUT_THRESHOLD") ? "PAYOUT_THRESHOLD" : (String(payoutError.message || "").includes("PAYOUT_NOT_CONFIGURED") ? "PAYOUT_NOT_CONFIGURED" : "PAYOUT_FAILED");
        const message = code === "PAYOUT_THRESHOLD" ? "Le seuil minimum est de 50 USD." : (code === "PAYOUT_NOT_CONFIGURED" ? "Configure d abord ton moyen de paiement." : "Le versement n a pas pu etre prepare.");
        throw new FlowtubeError(400, message, { code });
      }
    }
    if (action === "open_dispute") {
      const referralId = String(body.referralId || body.id || "");
      const reason = compactText(body.reason, 1000);
      if (!isUuid(referralId) || !reason) throw new FlowtubeError(400, "Référence et motif requis.", { code: "DISPUTE_REQUIRED" });
      const { data: ownedReferral } = await supabase.from("affiliate_referrals").select("id").eq("id", referralId).eq("affiliate_user_id", userId).maybeSingle();
      if (!ownedReferral) throw new FlowtubeError(404, "Conversion introuvable.", { code: "REFERRAL_NOT_FOUND" });
      await supabase.from("affiliate_disputes").insert({ referral_id: referralId, affiliate_user_id: userId, reason, status: "open" });
    }
    const affiliatePatch: Record<string, unknown> = {
      user_id: userId,
      code: affiliateCode(profile),
      status: "active",
    };
    if (action !== "request_payout") {
      affiliatePatch.payout_email = payoutEmail || profile.billing_email || profile.email || null;
      affiliatePatch.payout_method = compactText(body.payoutMethod || "email", 30) || "email";
      affiliatePatch.payout_status = payoutEmail ? "configured" : "not_configured";
    }
    await supabase.from("affiliate_accounts").upsert(affiliatePatch, { onConflict: "user_id" });
  }

  const { data: account } = await supabase.from("affiliate_accounts").upsert({
    user_id: userId,
    code: affiliateCode(profile),
    payout_email: profile.billing_email || profile.email || null,
    status: "active",
  }, { onConflict: "user_id" }).select("*").single();
  const { data: referrals } = await supabase.from("affiliate_referrals").select("*").eq("affiliate_user_id", userId).order("created_at", { ascending: false });
  const { count: clicks } = await supabase.from("affiliate_clicks").select("id", { count: "exact", head: true }).eq("affiliate_user_id", userId);
  const [{ data: payouts }, { data: riskReviews }, { data: disputes }] = await Promise.all([
    supabase.from("affiliate_payouts").select("id,amount_usd,status,payout_method,destination_masked,requested_at,processed_at").eq("affiliate_user_id", userId).order("requested_at", { ascending: false }).limit(20),
    supabase.from("affiliate_risk_reviews").select("id,referral_id,score,status,reasons,reviewed_at,created_at").eq("affiliate_user_id", userId).order("created_at", { ascending: false }).limit(50),
    supabase.from("affiliate_disputes").select("id,referral_id,reason,status,resolution,created_at,resolved_at").eq("affiliate_user_id", userId).order("created_at", { ascending: false }).limit(50),
  ]);
  const rows = referrals || [];
  const active = rows.filter((row) => ["active", "paid"].includes(String(row.status))).length;
  const earnings = rows.reduce((sum, row) => sum + Number(row.amount_usd || 0), 0);
  return json({
    account,
    link: `${APP_BASE_URL}/?ref=${account.code}`,
    stats: {
      clicks: Number(clicks || 0),
      activeSubscribers: active,
      earningsUsd: earnings,
      pendingUsd: rows.filter((row) => ["pending", "trial"].includes(String(row.status))).reduce((sum, row) => sum + Number(row.amount_usd || 0), 0),
      availableUsd: rows.filter((row) => String(row.status) === "active").reduce((sum, row) => sum + Number(row.amount_usd || 0), 0),
      paidUsd: rows.filter((row) => String(row.status) === "paid").reduce((sum, row) => sum + Number(row.amount_usd || 0), 0),
    },
    referrals: rows.map((row) => ({
      id: row.id,
      name: row.email || "Invitation",
      status: row.status,
      amountUsd: Number(row.amount_usd || 0),
      createdAt: row.created_at,
    })),
    payouts: payouts || [],
    riskReviews: riskReviews || [],
    disputes: disputes || [],
  });
}

function requestSessionMetadata(req: Request) {
  const userAgent = req.headers.get("user-agent") || "";
  const deviceLabel = /mobile|android|iphone|ipad/i.test(userAgent) ? "Appareil mobile" : "Navigateur desktop";
  return {
    userAgent: userAgent.slice(0, 500),
    deviceLabel,
    ipHash: requestIp(req),
  };
}

async function securityRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const token = String((req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")).trim();
  const sessionHash = token ? await sha256Hex(token) : "";
  const meta = requestSessionMetadata(req);
  if (sessionHash) {
    const ipHash = await sha256Hex(`${meta.ipHash}:${Deno.env.get("FLOWTUBE_RATE_LIMIT_SALT") || "flowtube"}`);
    await supabase.from("user_security_sessions").update({ is_current: false }).eq("user_id", userId).neq("session_hash", sessionHash);
    await supabase.from("user_security_sessions").upsert({
      user_id: userId,
      session_hash: sessionHash,
      device_label: meta.deviceLabel,
      user_agent: meta.userAgent,
      ip_hash: ipHash,
      is_current: true,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "session_hash" });
  }

  if (req.method === "POST") {
    const body = await bodyJson(req);
    const action = String(body.action || "revoke");
    if (action === "revoke_all") {
      await supabase.from("user_security_sessions").update({ revoked_at: new Date().toISOString(), is_current: false }).eq("user_id", userId).neq("session_hash", sessionHash);
      await supabase.from("user_security_events").insert({ user_id: userId, event_type: "revoke_all_sessions", ip_hash: await sha256Hex(`${meta.ipHash}:${Deno.env.get("FLOWTUBE_RATE_LIMIT_SALT") || "flowtube"}`), user_agent: meta.userAgent });
    } else if (action === "revoke") {
      const sessionId = String(body.sessionId || "");
      if (!isUuid(sessionId)) throw new FlowtubeError(400, "Session invalide.", { code: "INVALID_SESSION_ID" });
      await supabase.from("user_security_sessions").update({ revoked_at: new Date().toISOString(), is_current: false }).eq("id", sessionId).eq("user_id", userId).neq("session_hash", sessionHash);
      await supabase.from("user_security_events").insert({ user_id: userId, event_type: "revoke_session", ip_hash: await sha256Hex(`${meta.ipHash}:${Deno.env.get("FLOWTUBE_RATE_LIMIT_SALT") || "flowtube"}`), user_agent: meta.userAgent, metadata: { session_id: sessionId } });
    }
  }

  const [{ data: sessions }, { data: events }] = await Promise.all([
    supabase.from("user_security_sessions").select("id,device_label,user_agent,is_current,last_seen_at,created_at,revoked_at").eq("user_id", userId).order("last_seen_at", { ascending: false }).limit(20),
    supabase.from("user_security_events").select("id,event_type,metadata,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
  ]);
  return json({
    sessions: (sessions || []).map((row) => ({ id: row.id, deviceLabel: row.device_label, userAgent: row.user_agent, current: Boolean(row.is_current), lastSeenAt: row.last_seen_at, createdAt: row.created_at, revoked: Boolean(row.revoked_at) })),
    events: (events || []).map((row) => ({ id: row.id, type: row.event_type, metadata: cleanMetadata(row.metadata), createdAt: row.created_at })),
  });
}

async function usageRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const url = new URL(req.url);
  const days = Math.max(7, Math.min(90, Number(url.searchParams.get("period") || 30)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: generations }, { data: profile }, { data: alert }] = await Promise.all([
    supabase.from("generations").select("id,type,status,credits,created_at,model_label,project_id").eq("user_id", userId).gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    supabase.from("profiles").select("credits,credits_max").eq("id", userId).maybeSingle(),
    supabase.from("usage_alerts").select("id,threshold_percent,enabled,last_triggered_at").eq("user_id", userId).maybeSingle(),
  ]);
  const rows = generations || [];
  const totalCredits = rows.reduce((sum, row) => sum + Number(row.credits || 0), 0);
  const dailyAverage = totalCredits / Math.max(1, days);
  if (url.searchParams.get("format") === "csv") {
    const header = "id,type,status,credits,model,project_id,created_at";
    const csvRows = rows.map((row) => [row.id, row.type, row.status, row.credits, row.model_label, row.project_id, row.created_at].map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","));
    return new Response([header, ...csvRows].join("\n"), { status: 200, headers: { ...corsHeaders, "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=huggyflow-usage.csv" } });
  }
  if (req.method === "POST") {
    const body = await bodyJson(req);
    const threshold = Math.max(1, Math.min(100, Number(body.thresholdPercent || body.threshold_percent || 80)));
    const enabled = body.enabled !== false;
    const { data: saved, error } = await supabase.from("usage_alerts").upsert({ user_id: userId, threshold_percent: threshold, enabled }, { onConflict: "user_id" }).select("id,threshold_percent,enabled,last_triggered_at").single();
    if (error) throw error;
    return json({ alert: saved });
  }
  const maxCredits = Number(profile?.credits_max || 0);
  const usedRatio = maxCredits > 0 ? totalCredits / maxCredits : 0;
  return json({
    period: days,
    summary: { credits: totalCredits, remainingCredits: Number(profile?.credits || 0), creditsMax: maxCredits, dailyAverage: Math.round(dailyAverage * 100) / 100, forecast30Days: Math.round(dailyAverage * 30 * 100) / 100, usedRatio: Math.round(usedRatio * 100) },
    alert: alert || { threshold_percent: 80, enabled: true },
    rows: rows.slice(0, 100).map((row) => ({ id: row.id, type: row.type, status: row.status, credits: Number(row.credits || 0), model: row.model_label, projectId: row.project_id, createdAt: row.created_at })),
  });
}

async function statsRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const days = Math.max(7, Math.min(90, Number(new URL(req.url).searchParams.get("period") || 30)));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data: generations } = await supabase.from("generations").select("type,status,credits,created_at,model_label").eq("user_id", userId).gte("created_at", since);
  const { count: projects } = await supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("archived", false);
  const rows = generations || [];
  const credits = rows.reduce((sum, row) => sum + Number(row.credits || 0), 0);
  const byType = (type: string) => rows.filter((row) => String(row.type || "") === type).length;
  const buckets = Array.from({ length: Math.min(days, 30) }, (_, index) => {
    const d = new Date(Date.now() - (Math.min(days, 30) - index - 1) * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const total = rows.filter((row) => String(row.created_at || "").slice(0, 10) === key).reduce((sum, row) => sum + Number(row.credits || 0), 0);
    return { label: d.toLocaleDateString("fr-FR", { weekday: "short" }), credits: total };
  });
  const maxCredits = Math.max(1, ...buckets.map((b) => b.credits));
  const modelTotals = new Map<string, number>();
  for (const row of rows) modelTotals.set(String(row.model_label || "HuggyFlow"), (modelTotals.get(String(row.model_label || "HuggyFlow")) || 0) + Number(row.credits || 0));
  return json({
    summary: {
      credits,
      images: byType("image") + byType("image_edit"),
      videos: byType("video") + byType("video_edit") + byType("lipsync"),
      voices: byType("audio") + byType("voice") + byType("music"),
      projects: projects || 0,
      completed: rows.filter((row) => String(row.status) === "completed").length,
    },
    chart: buckets.map((bucket) => ({ label: bucket.label, currentPct: Math.round((bucket.credits / maxCredits) * 100), previousPct: 0, credits: bucket.credits })),
    models: [...modelTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, credits: value })),
    highlights: rows.length
      ? ["Tes donnees sont synchronisees avec tes creations sauvegardees.", `${rows.length} creation(s) sur la periode selectionnee.`, `${credits} credits utilises sur cette periode.`]
      : ["Aucune creation sur cette periode pour le moment.", "Lance une creation pour remplir tes statistiques.", "Tes donnees apparaitront ici automatiquement."],
  });
}

async function pricingRoute() {
  const supabase = adminClient();
  const [plans, catalog] = await Promise.all([publicPricingPlans(supabase), pricingCatalog(supabase)]);
  const { data: creditPacks } = await supabase.from("credit_packs").select("*").eq("active", true).order("amount_xof", { ascending: true });
  return json({
    plans,
    models: publicPricingModels(catalog),
    pricing: {
      currency: DEFAULT_BILLING_CURRENCY,
      usdXofRate: DEFAULT_USD_XOF_RATE,
      creditsLabel: "Les credits sont calcules selon la tache.",
    },
    creditPacks: (creditPacks || []).map((pack) => ({
      id: pack.id,
      label: pack.label,
      credits: pack.credits,
      amountXof: Math.max(0, Number(pack.amount_xof || Math.round(Number(pack.price_usd || 0) * DEFAULT_USD_XOF_RATE))),
      checkoutEnabled: Boolean(pack.metadata?.checkout !== false),
    })),
    billing: {
      paymentConfigured: fapshiConfigured() || moneyFusionConfigured() || Boolean(stripeSecret()),
      currency: DEFAULT_BILLING_CURRENCY,
      usdXofRate: DEFAULT_USD_XOF_RATE,
      siteUrl: APP_BASE_URL,
    },
  });
}

async function requireAdmin(req: Request, supabase: ReturnType<typeof adminClient>) {
  const secret = Deno.env.get("FLOWTUBE_ADMIN_SECRET") || "";
  const provided = req.headers.get("x-flowtube-admin-secret") || req.headers.get("x-huggyflow-admin-secret");
  if (secret && provided === secret) return "service";

  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) throw new FlowtubeError(401, "Session admin invalide.", { code: "ADMIN_SESSION_INVALID" });
  const adminEmail = String(Deno.env.get("HUGGYFLOW_ADMIN_EMAIL") || "novacore629@gmail.com").trim().toLowerCase();
  if (String(data.user.email || "").trim().toLowerCase() !== adminEmail) {
    throw new FlowtubeError(403, "Acces administrateur refuse.", { code: "ADMIN_FORBIDDEN" });
  }
  return userId;
}

async function adminRoute(req: Request, action: string) {
  const supabase = adminClient();
  await requireAdmin(req, supabase);
  if (action === "dashboard" && req.method === "GET") {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [profilesResult, generationsResult, checkoutResult, moderationResult, modelsResult, plansResult, eventsResult] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name,plan,credits,credits_max,billing_status,metadata,created_at").order("created_at", { ascending: false }).limit(500),
      supabase.from("generations").select("id,type,status,model_id,model_label,provider,credits,cost_usd,created_at").gte("created_at", `${sevenDaysAgo}T00:00:00.000Z`).order("created_at", { ascending: false }).limit(5000),
      supabase.from("billing_checkout_sessions").select("id,provider,mode,plan_id,billing_interval,status,amount_usd,currency,metadata,created_at,completed_at").gte("created_at", monthStart).order("created_at", { ascending: false }).limit(5000),
      supabase.from("moderation_events").select("id,user_id,provider,decision,reason,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("pricing_models").select("id,label,provider,media_type,credits,cost_per_unit_usd,active").order("media_type", { ascending: true }),
      supabase.from("pricing_plans").select("id,display_name,monthly_price_usd,active,sort_order").eq("active", true).order("sort_order", { ascending: true }),
      supabase.from("payment_events").select("provider,event_type,processed,created_at").order("created_at", { ascending: false }).limit(100),
    ]);
    const queryResults = [profilesResult, generationsResult, checkoutResult, moderationResult, modelsResult, plansResult, eventsResult];
    const queryError = queryResults.find((result) => result.error)?.error;
    if (queryError) throw queryError;

    const profiles = profilesResult.data || [];
    const generations = generationsResult.data || [];
    const checkouts = checkoutResult.data || [];
    const moderation = moderationResult.data || [];
    const models = modelsResult.data || [];
    const plans = plansResult.data || [];
    const events = eventsResult.data || [];
    const planById = new Map(plans.map((plan) => [normalizePlanId(String(plan.id)), plan]));
    const planCounts = new Map<string, number>();
    let mrrUsd = 0;
    for (const profile of profiles) {
      const planId = normalizePlanId(String(profile.plan || "free"));
      planCounts.set(planId, (planCounts.get(planId) || 0) + 1);
      mrrUsd += Number(planById.get(planId)?.monthly_price_usd || 0);
    }

    const todayKey = now.toISOString().slice(0, 10);
    const chart = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      const count = generations.filter((row) => String(row.created_at || "").slice(0, 10) === key).length;
      return { label: date.toLocaleDateString("fr-FR", { weekday: "short" }), count };
    });
    const maxChart = Math.max(1, ...chart.map((item) => item.count));
    const completedPayments = checkouts.filter((row) => String(row.status) === "completed");
    const revenueUsd = completedPayments.reduce((sum, row) => sum + Number(row.amount_usd || 0), 0);
    const failedPayments = checkouts.filter((row) => ["failed", "cancelled", "expired"].includes(String(row.status))).length;
    const subscriptionAttempts = checkouts.filter((row) => String(row.mode) === "subscription");
    const churnRatio = subscriptionAttempts.length ? failedPayments / subscriptionAttempts.length : 0;
    const modelUsage = new Map<string, { count: number; credits: number }>();
    for (const row of generations) {
      const id = String(row.model_id || row.model_label || "unknown");
      const current = modelUsage.get(id) || { count: 0, credits: 0 };
      current.count += 1;
      current.credits += Number(row.credits || 0);
      modelUsage.set(id, current);
    }

    return json({
      generatedAt: now.toISOString(),
      summary: {
        mrrUsd: Number(mrrUsd.toFixed(2)),
        users: profiles.length,
        paidUsers: profiles.filter((profile) => normalizePlanId(String(profile.plan || "free")) !== "free").length,
        generationsToday: generations.filter((row) => String(row.created_at || "").slice(0, 10) === todayKey).length,
        paymentFailureRate: Number(churnRatio.toFixed(3)),
      },
      chart: chart.map((item) => ({ ...item, percent: Math.round((item.count / maxChart) * 100) })),
      health: [
        { label: "Base de donnees", value: "Connectee", ok: true },
        { label: "MoneyFusion", value: moneyFusionConfigured() ? "Configure" : "Non configure", ok: moneyFusionConfigured() },
        { label: "Generation media", value: Deno.env.get("FAL_KEY") ? "Configuree" : "Non configuree", ok: Boolean(Deno.env.get("FAL_KEY")) },
        { label: "Evenements paiement", value: `${events.filter((event) => event.processed).length} traites`, ok: events.every((event) => event.processed) },
      ],
      users: profiles.map((profile) => ({
        id: profile.id,
        name: profile.display_name || profile.email || "Utilisateur",
        email: profile.email || "",
        plan: normalizePlanId(String(profile.plan || "free")),
        credits: Number(profile.credits || 0),
        creditsMax: Number(profile.credits_max || 0),
        status: profile.billing_status || (normalizePlanId(String(profile.plan || "free")) === "free" ? "free" : "unknown"),
        suspended: Boolean((profile.metadata as Record<string, unknown> | null)?.admin_suspended),
        createdAt: profile.created_at,
      })),
      reports: moderation.map((item) => ({
        id: item.id,
        type: item.decision || "review",
        title: item.reason || "Evenement de moderation",
        meta: `${item.provider || "interne"} · ${new Date(item.created_at).toLocaleString("fr-FR")}`,
        level: String(item.decision || "").toLowerCase().includes("block") ? "high" : "normal",
      })),
      models: models.map((model) => ({
        id: model.id,
        name: model.label || model.id,
        group: model.media_type || model.provider,
        credits: Number(model.credits || 0),
        costPerUnitUsd: Number(model.cost_per_unit_usd || 0),
        active: Boolean(model.active),
        usage: modelUsage.get(String(model.id)) || { count: 0, credits: 0 },
      })),
      finance: {
        revenueUsd: Number(revenueUsd.toFixed(2)),
        averageOrderUsd: completedPayments.length ? Number((revenueUsd / completedPayments.length).toFixed(2)) : 0,
        completedPayments: completedPayments.length,
        failedPayments,
      },
      plans: plans.map((plan) => {
        const count = planCounts.get(normalizePlanId(String(plan.id))) || 0;
        return {
          id: plan.id,
          name: plan.display_name || plan.id,
          count,
          mrrUsd: Number((count * Number(plan.monthly_price_usd || 0)).toFixed(2)),
          percent: profiles.length ? Math.round((count / profiles.length) * 100) : 0,
        };
      }),
    });
  }
  if (action === "users" && req.method === "POST") {
    const body = await bodyJson(req);
    const userId = String(body.userId || "");
    const suspended = Boolean(body.suspended);
    if (!userId) throw new FlowtubeError(400, "Utilisateur invalide.", { code: "ADMIN_USER_REQUIRED" });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("metadata").eq("id", userId).maybeSingle();
    if (profileError) throw profileError;
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, { ban_duration: suspended ? "876000h" : "none" });
    if (authError) throw authError;
    const metadata = { ...((profile?.metadata || {}) as Record<string, unknown>), admin_suspended: suspended };
    const { error: updateError } = await supabase.from("profiles").update({ metadata }).eq("id", userId);
    if (updateError) throw updateError;
    await supabase.from("app_events").insert({ user_id: userId, event_name: suspended ? "admin_user_suspended" : "admin_user_reactivated" });
    return json({ ok: true, userId, suspended });
  }
  if (action === "moderation" && req.method === "POST") {
    const body = await bodyJson(req);
    const reportId = String(body.reportId || "");
    const resolution = String(body.resolution || "approved") === "removed" ? "removed" : "approved";
    const { data: report, error } = await supabase.from("moderation_events").select("id,generation_id,metadata").eq("id", reportId).maybeSingle();
    if (error) throw error;
    if (!report) throw new FlowtubeError(404, "Signalement introuvable.", { code: "REPORT_NOT_FOUND" });
    const metadata = { ...((report.metadata || {}) as Record<string, unknown>), resolution, resolved_at: new Date().toISOString() };
    const { error: reportError } = await supabase.from("moderation_events").update({ metadata }).eq("id", reportId);
    if (reportError) throw reportError;
    if (report.generation_id) {
      const { error: generationError } = await supabase.from("generations").update({ moderation_status: resolution }).eq("id", report.generation_id);
      if (generationError) throw generationError;
    }
    return json({ ok: true, reportId, resolution });
  }
  if (action === "pricing" && req.method === "GET") {
    const { data: plans } = await supabase.from("pricing_plans").select("*").order("sort_order", { ascending: true });
    const { data: models } = await supabase.from("pricing_models").select("*").order("media_type", { ascending: true });
    const { data: packs } = await supabase.from("credit_packs").select("*").order("price_usd", { ascending: true });
    return json({ plans, models, packs });
  }
  if (action === "pricing" && req.method === "POST") {
    const body = await bodyJson(req);
    const table = String(body.table || "");
    const allowed = new Set(["pricing_plans", "pricing_models", "credit_packs"]);
    if (!allowed.has(table)) throw new FlowtubeError(400, "Table pricing invalide.", { code: "INVALID_ADMIN_TABLE" });
    const id = String(body.id || "");
    const patch = (body.patch || {}) as Record<string, unknown>;
    delete patch.id;
    delete patch.created_at;
    const { data, error } = await supabase.from(table).update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    await supabase.from("app_events").insert({ event_name: "admin_pricing_update", metadata: { table, id, patch } });
    return json({ item: data });
  }
  if (action === "audit" && req.method === "GET") {
    const { data: recent } = await supabase.from("pricing_audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
    const { data: profiles } = await supabase.from("profiles").select("plan", { count: "exact" });
    const { data: events } = await supabase.from("payment_events").select("event_type,processed,created_at").order("created_at", { ascending: false }).limit(50);
    return json({ recentPricing: recent || [], profiles: profiles || [], paymentEvents: events || [] });
  }
  return json({ error: { message: "Admin route not found" } }, 404);
}

async function verifyStripeSignature(req: Request, raw: string) {
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
  if (!secret) throw new FlowtubeError(503, "Stripe webhook secret missing.", { code: "STRIPE_WEBHOOK_SECRET_MISSING" });
  const header = req.headers.get("stripe-signature") || "";
  const timestamp = (header.match(/t=([^,]+)/) || [])[1] || "";
  const signatures = [...header.matchAll(/v1=([^,]+)/g)].map((m) => m[1]);
  if (!timestamp || !signatures.length) throw new FlowtubeError(400, "Stripe signature missing.", { code: "STRIPE_SIGNATURE_MISSING" });
  const signedPayload = `${timestamp}.${raw}`;
  const expected = await hmacSha256Hex(secret, signedPayload);
  if (!signatures.some((signature) => safeEqual(signature, expected))) {
    throw new FlowtubeError(400, "Stripe signature invalid.", { code: "STRIPE_SIGNATURE_INVALID" });
  }
}

type BillingGrantContext = {
  creditsOverride?: number;
  amountUsd?: number;
  source?: string;
  metadata?: Record<string, unknown>;
};

function billingSnapshotCredits(session: Record<string, unknown>) {
  const snapshot = cleanMetadata(session.pricing_snapshot);
  const interval = String(session.billing_interval || "monthly") === "annual" ? "annual" : "monthly";
  const pack = cleanMetadata(snapshot.pack);
  const option = cleanMetadata(snapshot.creditOption || snapshot.credit_option);
  const baseCredits = Number(pack.credits || option.credits || snapshot.includedCredits || snapshot.included_credits || 0);
  if (!Number.isFinite(baseCredits) || baseCredits <= 0) return 0;
  return Math.round(baseCredits) * (interval === "annual" && !pack.credits ? 12 : 1);
}

function billingGrantContext(session: Record<string, unknown>, source: string): BillingGrantContext {
  return {
    creditsOverride: billingSnapshotCredits(session),
    amountUsd: Number(session.amount_usd || (Number(session.amount_xof || 0) / DEFAULT_USD_XOF_RATE) || 0),
    source,
    metadata: {
      checkout_session_id: session.id || null,
      provider_session_id: session.provider_session_id || null,
      amount_xof: session.amount_xof || null,
      pricing_version: session.pricing_version || null,
    },
  };
}

function billingPeriodEnd(interval: string, from = new Date()) {
  const end = new Date(from);
  if (interval === "annual") end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}

async function grantPlanCredits(supabase: ReturnType<typeof adminClient>, userId: string, planId: string, interval: string, subscriptionId?: string, periodEnd?: string, grantKey?: string, creditOptionId?: string, context: BillingGrantContext = {}) {
  const plan = await resolvePlan(supabase, planId);
  const idempotencyKey = String(grantKey || (subscriptionId ? `plan:${subscriptionId}:${interval}:${periodEnd || "initial"}` : `plan:${userId}:${plan.id}:${interval}:${new Date().toISOString().slice(0, 10)}`));
  let baseCredits = plan.includedCredits;
  if (!context.creditsOverride && creditOptionId) {
    const { data: option } = await supabase.from("pricing_plan_options")
      .select("credits,plan_id")
      .eq("id", creditOptionId)
      .eq("plan_id", plan.id)
      .eq("active", true)
      .maybeSingle();
    if (option) baseCredits = Number(option.credits || baseCredits);
  }
  const includedCredits = Math.max(0, Math.round(Number(context.creditsOverride || (baseCredits * (interval === "annual" ? 12 : 1)))));
  if (!includedCredits) throw new FlowtubeError(409, "Le quota de cet abonnement est invalide.", { code: "BILLING_CREDITS_INVALID" });
  const source = String(context.source || "billing");
  const effectivePeriodEnd = periodEnd || billingPeriodEnd(interval);
  const { data: grantRows, error: grantError } = await supabase.rpc("grant_billing_credits", {
    p_user_id: userId,
    p_credits: includedCredits,
    p_grant_key: idempotencyKey,
    p_reason: "subscription_renewal",
    p_plan_id: plan.id,
    p_interval: interval,
    p_subscription_id: subscriptionId || `${source}:${idempotencyKey}`,
    p_period_end: effectivePeriodEnd,
    p_credit_option_id: creditOptionId || null,
    p_source: source,
    p_metadata: context.metadata || {},
  });
  if (grantError) throw grantError;
  const grant = Array.isArray(grantRows) ? grantRows[0] : grantRows;
  if (!grant?.granted) return;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  await settleAffiliateConversion(supabase, userId,
    Number(context.amountUsd || (interval === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd) || 0),
    "subscription_renewal", idempotencyKey);
  if (profile?.email) await sendTransactionalEmail(supabase, userId, String(profile.email), "subscription_active", "Ton plan Huggyflow est actif", `<p>Ton plan ${plan.displayName} est actif avec ${includedCredits} credits.</p>`, { plan_id: plan.id, credit_option_id: creditOptionId || null });
}

async function grantCreditPack(supabase: ReturnType<typeof adminClient>, userId: string, packId: string, grantKey?: string, context: BillingGrantContext = {}) {
  const { data: pack } = await supabase.from("credit_packs").select("*").eq("id", packId).maybeSingle();
  if (!pack) return;
  const idempotencyKey = String(grantKey || `pack:${userId}:${pack.id}`);
  const credits = Math.max(0, Math.round(Number(context.creditsOverride || pack.credits || 0)));
  if (!credits) throw new FlowtubeError(409, "Le quota de cette recharge est invalide.", { code: "BILLING_CREDITS_INVALID" });
  const { data: grantRows, error: grantError } = await supabase.rpc("grant_billing_credits", {
    p_user_id: userId,
    p_credits: credits,
    p_grant_key: idempotencyKey,
    p_reason: "credit_pack_purchase",
    p_plan_id: null,
    p_interval: null,
    p_subscription_id: null,
    p_period_end: null,
    p_credit_option_id: null,
    p_source: String(context.source || "billing"),
    p_metadata: { pack_id: pack.id, price_usd: context.amountUsd || pack.price_usd, ...(context.metadata || {}) },
  });
  if (grantError) throw grantError;
  const grant = Array.isArray(grantRows) ? grantRows[0] : grantRows;
  if (!grant?.granted) return;
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", userId).single();
  if (profile?.email) await sendTransactionalEmail(supabase, userId, String(profile.email), "credit_pack", "Tes credits Huggyflow sont disponibles", `<p>${credits} credits ont ete ajoutes a ton compte.</p>`, { pack_id: pack.id });
}

async function stripeWebhook(req: Request) {
  const raw = await bodyText(req);
  await verifyStripeSignature(req, raw);
  const event = JSON.parse(raw);
  const supabase = adminClient();
  const { data: existing } = await supabase.from("payment_events").select("id,processed").eq("provider", "stripe").eq("provider_event_id", event.id).maybeSingle();
  if (existing?.processed) return json({ received: true, duplicate: true });

  const object = event.data?.object || {};
  const metadata = object.metadata || {};
  const userId = metadata.user_id || object.client_reference_id || null;
  await supabase.from("payment_events").upsert({
    provider: "stripe",
    provider_event_id: event.id,
    event_type: event.type,
    user_id: userId,
    processed: false,
    metadata: event,
  }, { onConflict: "provider,provider_event_id" });

  if (event.type === "checkout.session.completed") {
    const { data: checkoutSession } = await supabase.from("billing_checkout_sessions")
      .select("*").eq("stripe_session_id", object.id).maybeSingle();
    await supabase.from("billing_checkout_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: object,
    }).eq("stripe_session_id", object.id);
    if (metadata.type === "credits" && metadata.credit_pack_id && userId) {
      await grantCreditPack(supabase, String(userId), String(metadata.credit_pack_id), `stripe:credit:${event.id}`,
        checkoutSession ? billingGrantContext(checkoutSession, "stripe") : { source: "stripe" });
    } else if (metadata.plan_id && userId) {
      await grantPlanCredits(supabase, String(userId), String(metadata.plan_id), String(metadata.interval || "monthly"), object.subscription || undefined, undefined, `stripe:plan:${event.id}`,
        checkoutSession?.credit_option_id ? String(checkoutSession.credit_option_id) : undefined,
        checkoutSession ? billingGrantContext(checkoutSession, "stripe") : { source: "stripe" });
    }
    if (userId) void recordProductEvent(supabase, String(userId), "checkout_completed", { provider: "stripe", type: metadata.type || "subscription" });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subMetadata = object.metadata || {};
    const subUserId = subMetadata.user_id || userId;
    if (subUserId) {
      await supabase.from("subscriptions").upsert({
        user_id: subUserId,
        plan_id: normalizePlanId(String(subMetadata.plan_id || "basic")),
        stripe_subscription_id: object.id,
        stripe_customer_id: object.customer,
        status: object.status,
        billing_interval: String(subMetadata.interval || "monthly"),
        current_period_start: object.current_period_start ? new Date(Number(object.current_period_start) * 1000).toISOString() : null,
        current_period_end: object.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null,
        cancel_at_period_end: Boolean(object.cancel_at_period_end),
        metadata: object,
      }, { onConflict: "stripe_subscription_id" });
      await supabase.from("profiles").update({
        billing_status: object.status,
        current_period_end: object.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null,
      }).eq("id", subUserId);
    }
  }

  if (event.type === "invoice.payment_succeeded") {
    const subId = object.subscription || "";
    const { data: subscription } = subId ? await supabase.from("subscriptions").select("*").eq("stripe_subscription_id", subId).maybeSingle() : { data: null };
    const invoiceUserId = subscription?.user_id || userId;
    await supabase.from("invoices").upsert({
      user_id: invoiceUserId,
      stripe_invoice_id: object.id,
      stripe_customer_id: object.customer,
      stripe_subscription_id: subId || null,
      status: object.status || "paid",
      amount_due_usd: Number(object.amount_due || 0) / 100,
      amount_paid_usd: Number(object.amount_paid || 0) / 100,
      currency: object.currency || "usd",
      hosted_invoice_url: object.hosted_invoice_url || null,
      invoice_pdf: object.invoice_pdf || null,
      period_start: object.period_start ? new Date(Number(object.period_start) * 1000).toISOString() : null,
      period_end: object.period_end ? new Date(Number(object.period_end) * 1000).toISOString() : null,
      metadata: object,
    }, { onConflict: "stripe_invoice_id" });
  }

  await supabase.from("payment_events").update({ processed: true }).eq("provider", "stripe").eq("provider_event_id", event.id);
  return json({ received: true });
}

function moneyFusionPaymentRecord(value: Record<string, unknown>) {
  return cleanMetadata(value.data || value.result || value.payment || value);
}

function moneyFusionPaymentMatchesSession(
  session: Record<string, unknown>,
  verified: Record<string, unknown>,
) {
  const record = moneyFusionPaymentRecord(verified);
  const expectedToken = String(session.provider_payment_token || "");
  const verifiedToken = moneyFusionToken(verified);
  if (!expectedToken || !verifiedToken || expectedToken !== verifiedToken) return false;
  const metadata = cleanMetadata(session.metadata);
  const expectedAmount = Number(session.amount_xof || metadata.amount_xof || 0);
  const actualAmount = Number(record.Montant || record.montant || record.amount || record.totalPrice || 0);
  if (!expectedAmount || !actualAmount || expectedAmount !== actualAmount) return false;
  const personal = Array.isArray(record.personal_Info) ? cleanMetadata(record.personal_Info[0])
    : Array.isArray(verified.personal_Info) ? cleanMetadata(verified.personal_Info[0]) : {};
  const expectedUserId = String(session.user_id || "");
  const expectedReference = String(session.provider_session_id || "");
  const receivedUserId = String(personal.userId || personal.user_id || "");
  const receivedReference = String(personal.orderId || personal.order_id || personal.reference || "");
  return receivedUserId === expectedUserId && receivedReference === expectedReference;
}

async function moneyFusionCallback(req: Request) {
  const required = Deno.env.get("MONEYFUSION_CALLBACK_SECRET") || "";
  const url = new URL(req.url);
  const provided = req.headers.get("x-moneyfusion-secret") || url.searchParams.get("secret") || "";
  if (required && provided !== required) return unauthorized();

  const body = req.method === "GET" ? {} : await bodyJson(req);
  const supabase = adminClient();
  const personalInfo = Array.isArray(body.personal_Info) ? (body.personal_Info[0] || {}) as Record<string, unknown> : {};
  const token = String(body.token || body.tokenPay || body.token_pay || body.payment_token || body.paymentToken || body.transaction_id || body.reference || url.searchParams.get("token") || url.searchParams.get("tokenPay") || url.searchParams.get("reference") || "");
  const reference = String(body.reference || body.order_id || body.orderId || personalInfo.reference || personalInfo.orderId || personalInfo.order_id || url.searchParams.get("reference") || "");
  if (!token && !reference) throw new FlowtubeError(400, "Reference de paiement MoneyFusion manquante.", { code: "MONEYFUSION_CALLBACK_REFERENCE_MISSING" });

  let session: Record<string, unknown> | null = null;
  if (token) {
    const { data } = await supabase.from("billing_checkout_sessions").select("*").eq("provider", "moneyfusion").eq("provider_payment_token", token).maybeSingle();
    session = data as Record<string, unknown> | null;
  }
  if (!session && reference) {
    const { data } = await supabase.from("billing_checkout_sessions").select("*").eq("provider", "moneyfusion").eq("provider_session_id", reference).maybeSingle();
    session = data as Record<string, unknown> | null;
  }
  if (!session) {
    return json({ received: true, ignored: true });
  }

  let verified: Record<string, unknown>;
  try {
    verified = await moneyFusionLookupPayment(String(session.provider_payment_token || token));
  } catch (_err) {
    await supabase.from("payment_events").upsert({
      provider: "moneyfusion",
      provider_event_id: `${token || reference}:verification_pending`,
      event_type: "verification_pending",
      user_id: session.user_id,
      processed: false,
      metadata: { body, query: Object.fromEntries(url.searchParams.entries()) },
    }, { onConflict: "provider,provider_event_id" });
    return json({ received: true, verificationPending: true }, 503);
  }

  if (!moneyFusionPaymentMatchesSession(session, verified)) {
    await supabase.from("payment_events").upsert({
      provider: "moneyfusion",
      provider_event_id: `${token || reference}:verification_failed`,
      event_type: "verification_failed",
      user_id: session.user_id,
      processed: true,
      metadata: { body, verified },
    }, { onConflict: "provider,provider_event_id" });
    return json({ received: true, ignored: true, verified: false });
  }

  const rawStatus = moneyFusionStatusValue(verified) || moneyFusionStatusValue(body) || "callback";
  const eventType = String(body.event || rawStatus).toLowerCase().slice(0, 90);
  const eventId = `${String(session.provider_payment_token || token)}:${eventType}`;
  const { data: existingEvent } = await supabase.from("payment_events").select("processed").eq("provider", "moneyfusion").eq("provider_event_id", eventId).maybeSingle();
  if (existingEvent?.processed) return json({ received: true, duplicate: true });
  await supabase.from("payment_events").upsert({
    provider: "moneyfusion",
    provider_event_id: eventId,
    event_type: eventType,
    user_id: session.user_id,
    processed: false,
    metadata: { body, verified, query: Object.fromEntries(url.searchParams.entries()) },
  }, { onConflict: "provider,provider_event_id" });

  const paid = moneyFusionPaid(verified);
  if (paid) {
    const { data: claimed, error: claimError } = await supabase.from("billing_checkout_sessions").update({
      status: "processing",
      provider_payload: { body, verified },
      metadata: Object.assign({}, session.metadata || {}, { callback: body, verified }),
    }).eq("id", session.id).in("status", ["open", "pending", "failed"]).select("*").maybeSingle();
    if (claimError) throw claimError;
    if (claimed) {
      const userId = String(claimed.user_id || "");
      try {
        const context = billingGrantContext(claimed, "moneyfusion");
        if (claimed.credit_pack_id) await grantCreditPack(supabase, userId, String(claimed.credit_pack_id), `moneyfusion:credit:${eventId}`, context);
        else if (claimed.plan_id) await grantPlanCredits(supabase, userId, String(claimed.plan_id), String(claimed.billing_interval || "monthly"), `moneyfusion:${eventId}`, undefined, `moneyfusion:plan:${eventId}`, claimed.credit_option_id ? String(claimed.credit_option_id) : undefined, context);
        await supabase.from("billing_checkout_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", claimed.id);
        void recordProductEvent(supabase, userId, "checkout_completed", { provider: "moneyfusion", type: claimed.credit_pack_id ? "credits" : "subscription" });
      } catch (err) {
        await supabase.from("billing_checkout_sessions").update({ status: "open" }).eq("id", claimed.id);
        throw err;
      }
    }
  } else {
    await supabase.from("billing_checkout_sessions").update({
      status: rawStatus.includes("fail") || rawStatus.includes("cancel") || rawStatus.includes("no paid") ? "failed" : "pending",
      provider_payload: { body, verified },
      metadata: Object.assign({}, session.metadata || {}, { callback: body, verified }),
    }).eq("id", session.id);
  }

  await supabase.from("payment_events").update({ processed: true }).eq("provider", "moneyfusion").eq("provider_event_id", eventId);
  return json({ received: true, processed: paid });
}

async function fapshiWebhook(req: Request) {
  const expectedSecret = Deno.env.get("FAPSHI_WEBHOOK_SECRET") || "";
  const receivedSecret = req.headers.get("x-wh-secret") || req.headers.get("x-fapshi-secret") || "";
  if (expectedSecret && receivedSecret && !safeEqual(receivedSecret, expectedSecret)) return unauthorized();
  const body = await bodyJson(req);
  const transactionId = String(body.transId || body.transactionId || body.trans_id || body.id || body.externalId || "");
  if (!transactionId) throw new FlowtubeError(400, "Référence de paiement manquante.", { code: "PAYMENT_REFERENCE_MISSING" });
  const supabase = adminClient();
  const { data: session } = await supabase.from("billing_checkout_sessions")
    .select("*").eq("provider", "fapshi").eq("provider_session_id", transactionId).maybeSingle();
  if (!session) return json({ received: true, ignored: true });
  let verified: Record<string, unknown>;
  try {
    verified = await fapshiPaymentStatus(transactionId);
  } catch (_err) {
    await supabase.from("payment_events").upsert({
      provider: "fapshi",
      provider_event_id: `${transactionId}:verification_pending`,
      event_type: "verification_pending",
      user_id: session.user_id,
      processed: false,
      metadata: { transaction_id: transactionId },
    }, { onConflict: "provider,provider_event_id" });
    return json({ received: true, verificationPending: true }, 503);
  }
  if (!fapshiPaymentMatchesSession(session, verified)) {
    await supabase.from("payment_events").upsert({
      provider: "fapshi",
      provider_event_id: `${transactionId}:verification_failed`,
      event_type: "verification_failed",
      user_id: session.user_id,
      processed: true,
      metadata: { transaction_id: transactionId },
    }, { onConflict: "provider,provider_event_id" });
    return json({ received: true, ignored: true, verified: false });
  }
  const rawStatus = String(verified.status || "").toLowerCase();
  const eventId = `${transactionId}:${rawStatus || "update"}`;
  const { data: existingEvent } = await supabase.from("payment_events")
    .select("processed").eq("provider", "fapshi").eq("provider_event_id", eventId).maybeSingle();
  if (existingEvent?.processed) return json({ received: true, duplicate: true });
  await supabase.from("payment_events").upsert({
    provider: "fapshi", provider_event_id: eventId, event_type: rawStatus || "update",
    user_id: session.user_id, processed: false, metadata: { transaction_id: transactionId, status: rawStatus, verified: true },
  }, { onConflict: "provider,provider_event_id" });

  const successful = rawStatus === "successful";
  const failed = rawStatus === "failed" || rawStatus === "expired";
  if (successful) {
    const { data: claimed, error } = await supabase.from("billing_checkout_sessions")
      .update({ status: "processing", provider_payload: verified })
      .eq("id", session.id).in("status", ["open", "pending", "failed"]).select("*").maybeSingle();
    if (error) throw error;
    if (claimed) {
      const context = billingGrantContext(claimed, "fapshi");
      try {
        if (claimed.credit_pack_id) await grantCreditPack(supabase, String(claimed.user_id), String(claimed.credit_pack_id), `fapshi:credit:${eventId}`, context);
        else if (claimed.plan_id) await grantPlanCredits(supabase, String(claimed.user_id), String(claimed.plan_id), String(claimed.billing_interval || "monthly"), `fapshi:${transactionId}`, undefined, `fapshi:plan:${eventId}`, claimed.credit_option_id ? String(claimed.credit_option_id) : undefined, context);
        await supabase.from("billing_checkout_sessions").update({ status: "completed", completed_at: new Date().toISOString(), provider_payload: verified }).eq("id", claimed.id);
        void recordProductEvent(supabase, String(claimed.user_id), "checkout_completed", { provider: "fapshi", type: claimed.credit_pack_id ? "credits" : "subscription" });
      } catch (err) {
        await supabase.from("billing_checkout_sessions").update({ status: "open" }).eq("id", claimed.id);
        throw err;
      }
    }
  } else if (failed) {
    await supabase.from("billing_checkout_sessions").update({ status: rawStatus === "expired" ? "expired" : "failed", provider_payload: verified }).eq("id", session.id);
  } else {
    await supabase.from("billing_checkout_sessions").update({ status: "pending", provider_payload: verified }).eq("id", session.id);
  }
  await supabase.from("payment_events").update({ processed: true }).eq("provider", "fapshi").eq("provider_event_id", eventId);
  return json({ received: true, processed: successful });
}

async function consentRoute(req: Request) {
  const body = await bodyJson(req);
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const type = String(body.documentType || body.type || "terms");
  const version = String(body.version || "2026-06-29");
  const ipHash = await sha256Hex(requestIp(req));
  await supabase.from("user_consents").upsert({
    user_id: userId,
    document_type: type,
    version,
    ip_hash: ipHash,
    user_agent: req.headers.get("user-agent") || "",
    metadata: { source: "api" },
  }, { onConflict: "user_id,document_type,version" });
  const patch: Record<string, string> = {};
  if (type === "terms") patch.consented_terms_at = new Date().toISOString();
  if (type === "privacy") patch.consented_privacy_at = new Date().toISOString();
  if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("id", userId);
  return json({ ok: true });
}

async function falWebhook(req: Request) {
  const rawBody = new Uint8Array(await req.arrayBuffer());
  if (!(await verifyFalWebhook(req, rawBody))) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(new TextDecoder().decode(rawBody)) as Record<string, unknown>;
  } catch {
    throw new FlowtubeError(400, "Invalid provider webhook payload.", { code: "INVALID_PROVIDER_PAYLOAD" });
  }
  const supabase = adminClient();
  const requestId = String(body.request_id || body.requestId || body.fal_job_id || "");
  if (!requestId) throw new FlowtubeError(400, "Missing provider request id.", { code: "MISSING_PROVIDER_REQUEST_ID" });
  const { data: providerGeneration } = await supabase.from("generations").select("*").eq("provider_job_id", requestId).maybeSingle();
  const { data: legacyGeneration } = providerGeneration
    ? { data: null }
    : await supabase.from("generations").select("*").eq("fal_job_id", requestId).maybeSingle();
  const generation = providerGeneration || legacyGeneration;
  if (!generation) return json({ ok: true, ignored: true });
  const status = String(body.status || body.state || "").toUpperCase();
  if (status === "FAILED" || status === "ERROR") {
    const { data } = await supabase.from("generations").update({
      status: "failed",
      error_message: String(body.error || body.message || "Provider failed"),
      provider_payload: body,
      completed_at: new Date().toISOString(),
    }).eq("id", generation.id).select("*").single();
    await refundFailedGeneration(supabase, data);
    await trackGenerationJob(supabase, data, "failed", { error: data?.error_message || "provider_webhook_failed" });
    await advanceBatch(supabase, data);
    return json({ ok: true });
  }
  if (status === "OK" || status === "COMPLETED" || body.output || body.result || body.payload) {
    const providerPayload = body.payload || body.output || body.result || body;
    const resultUrl = extractUrl(providerPayload);
    if (!resultUrl) {
      const { data } = await supabase.from("generations").update({
        status: "failed",
        error_message: "Provider returned no media URL",
        provider_payload: body,
        completed_at: new Date().toISOString(),
      }).eq("id", generation.id).select("*").single();
      await refundFailedGeneration(supabase, data);
      await trackGenerationJob(supabase, data, "failed", { error: "provider_result_url_missing" });
      await advanceBatch(supabase, data);
      return json({ ok: true });
    }
    try {
      const stored = await fetchAndStoreProviderResult(supabase, generation, resultUrl);
      const completed = await completeProviderGeneration(supabase, generation, stored.signedUrl, body);
      return json({ ok: true, generationId: completed.id });
    } catch (error) {
      const failed = await failProviderGeneration(supabase, generation, error, error instanceof FlowtubeError ? String(error.payload.code || "provider_result_invalid") : "provider_result_invalid");
      return json({ ok: true, failed: failed === false });
    }
  }
  await supabase.from("generations").update({ status: "running", provider_payload: body }).eq("id", generation.id);
  await trackGenerationJob(supabase, generation, "running", { updated_via: "webhook" });
  return json({ ok: true });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secretFailure = checkSecret(req);
  if (secretFailure) return secretFailure;

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const fnIndex = parts.indexOf("flowtube-api");
    const route = fnIndex >= 0 ? parts.slice(fnIndex + 1) : parts;
    const first = route[0] || "bootstrap";

    if (first === "health" && req.method === "GET") return await healthRoute();
    if (first === "bootstrap" && req.method === "GET") return await bootstrap(req);
    if (first === "chat" && req.method === "POST") return await chat(req);
    if (first === "upload" && req.method === "POST") return await uploadRoute(req);
    if (first === "generate" && req.method === "POST") return await directGenerate(req);
    if (first === "explore" && (req.method === "GET" || req.method === "POST")) return await exploreRoute(req);
    if (first === "artifacts" && route[1] === "share" && route[2] && req.method === "GET") return await publicArtifactShareRoute(req, route[2]);
    if (first === "artifacts" && (req.method === "GET" || req.method === "POST")) return await artifactRoute(req, route[1]);
    if (first === "memory" && (req.method === "GET" || req.method === "POST")) return await agentMemoryRoute(req);
    if (first === "agent-tasks" && (req.method === "GET" || req.method === "POST")) return await agentTasksRoute(req);
    if (first === "runs" && route[1] && route[2] === "events" && req.method === "GET") return await agentRunEventsRoute(req, route[1]);
    if (first === "runs" && route[1] && route[2] === "cancel" && req.method === "POST") return await cancelAgentRun(req, route[1]);
    if (first === "skills" && (req.method === "GET" || req.method === "POST")) return await skillsRoute(req);
    if (first === "skill-evals" && (req.method === "GET" || req.method === "POST")) return await skillEvaluationsRoute(req, route[1]);
    if (first === "background-tasks" && req.method === "GET") return await backgroundTasksRoute(req);
    if (first === "generations" && route[1] === "batch" && route[2] && req.method === "GET") return await batchStatus(req, route[2]);
    if (first === "generations" && route[1] && route[2] === "cancel" && req.method === "POST") return await cancelGeneration(req, route[1]);
    if (first === "generations" && route[1] && req.method === "GET") return await generationStatus(req, route[1]);
    if (first === "projects" && req.method === "POST") return await createProjectRoute(req);
    if (first === "projects" && route[1] && (req.method === "PATCH" || req.method === "DELETE")) return await projectRoute(req, route[1]);
    if (first === "profile" && (req.method === "GET" || req.method === "POST")) return await profileRoute(req);
    if (first === "account" && route[1] === "export" && req.method === "GET") return await accountExportRoute(req);
    if (first === "account" && route[1] === "delete" && req.method === "POST") return await deleteAccountRoute(req);
    if (first === "brands" && (req.method === "GET" || req.method === "POST")) return await brandKitsRoute(req);
    if (first === "templates" && (req.method === "GET" || req.method === "POST")) return await templatesRoute(req);
    if (first === "exports" && req.method === "POST") return await exportPackageRoute(req);
    if (first === "integrations" && route[1] === "oauth" && route[2] === "callback" && req.method === "GET") return await integrationsOAuthCallback(req);
    if (first === "integrations" && (req.method === "GET" || req.method === "POST")) return await integrationsRoute(req);
    if (first === "feedback" && (req.method === "GET" || req.method === "POST")) return await feedbackRoute(req);
    if (first === "events" && req.method === "POST") return await productEventRoute(req);
    if (first === "team" && (req.method === "GET" || req.method === "POST")) return await teamRoute(req);
    if (((first === "api" && route[1] === "keys") || first === "keys") && (req.method === "GET" || req.method === "POST")) return await apiKeysRoute(req);
    if (first === "affiliate" && route[1] === "click" && req.method === "POST") return await affiliateClickRoute(req);
    if (first === "affiliate" && (req.method === "GET" || req.method === "POST")) return await affiliateRoute(req);
    if (first === "stats" && req.method === "GET") return await statsRoute(req);
    if (first === "usage" && (req.method === "GET" || req.method === "POST")) return await usageRoute(req);
    if (first === "security" && (req.method === "GET" || req.method === "POST")) return await securityRoute(req);
    if (first === "pricing" && req.method === "GET") return await pricingRoute();
    if (first === "auth" && route[1] === "mfa") return await mfaRoute(req);
    if (first === "auth" && route[1]) return await authRoute(req, route[1]);
    if (first === "billing" && route[1] === "checkout" && req.method === "POST") return await createCheckout(req);
    if (first === "billing" && route[1] === "status" && req.method === "GET") return await billingStatus(req);
    if (first === "billing" && route[1] === "test-grant" && !route[2] && req.method === "GET") return await testGrantStatus(req);
    if (first === "billing" && route[1] === "test-grant" && !route[2] && req.method === "POST") return await activateTestGrant(req);
    if (first === "billing" && route[1] === "test-grant" && route[2] === "revoke" && req.method === "POST") return await revokeTestGrant(req);
    if (first === "billing" && route[1] === "webhook" && req.method === "POST") return await stripeWebhook(req);
    if (first === "billing" && route[1] === "moneyfusion-callback" && (req.method === "POST" || req.method === "GET")) return await moneyFusionCallback(req);
    if (first === "billing" && route[1] === "fapshi-webhook" && req.method === "POST") return await fapshiWebhook(req);
    if (first === "legal" && route[1] === "consent" && req.method === "POST") return await consentRoute(req);
    if (first === "provider" && route[1] === "fal-webhook" && req.method === "POST") return await falWebhook(req);
    if (first === "admin" && route[1]) return await adminRoute(req, route[1]);
    return json({ error: { message: "Not found" } }, 404);
  } catch (err) {
    if (err instanceof FlowtubeError) return json(publicErrorPayload(err), err.status);
    return json({ error: { message: publicErrorMessage(err instanceof Error ? err.message : "Unexpected Edge error") } }, 500);
  }
});
