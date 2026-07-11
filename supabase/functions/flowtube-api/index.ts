import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { fal } from "npm:@fal-ai/client@1.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://fuvrxobxjcqyevsjsdfd.supabase.co";
const APP_NAME = "HuggyFlow";
const DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-6";
const ANTHROPIC_VERSION = "2023-06-01";
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://www.huggyflow.fun").replace(/\/$/, "");
const MEDIA_BUCKET = Deno.env.get("FLOWTUBE_MEDIA_BUCKET") || "flowtube-media";
const CREDIT_FLOOR_USD = 0.008;
const RETAIL_CREDIT_USD = 0.013;
const MEDIA_MARGIN_MULTIPLIER = 3.5;
const MIN_MEDIA_GROSS_MARGIN_RATIO = 0.45;
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
const OPENROUTER_ENABLED = (Deno.env.get("OPENROUTER_ENABLED") || "").toLowerCase() === "true";
const OPENROUTER_MEDIA_ENABLED = OPENROUTER_ENABLED && (Deno.env.get("OPENROUTER_MEDIA_ENABLED") || "").toLowerCase() === "true";
const RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_WINDOW_SECONDS") || 60);
const DEFAULT_RATE_LIMIT = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_DEFAULT") || 80);
const GENERATION_RATE_LIMIT = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_GENERATION") || 20);

const AGENT_MODELS = [
  { id: "auto", name: "Auto HuggyFlow", description: "Choisit automatiquement le meilleur modele agent disponible.", tier: "recommended" },
  { id: "claude-fable-5", name: "Fable 5", description: "Creation ambitieuse, strategie et production complexe.", tier: "max" },
  { id: "claude-mythos-5", name: "Mythos 5", description: "Raisonnement profond avec repli automatique si indisponible.", tier: "max" },
  { id: "claude-opus-4-8", name: "Opus 4.8", description: "Agent premium pour les briefs longs et exigeants.", tier: "pro" },
  { id: "claude-opus-4-7", name: "Opus 4.7", description: "Agent premium avec repli automatique si indisponible.", tier: "pro" },
  { id: "claude-opus-4-6", name: "Opus 4.6", description: "Direction creative premium avec repli automatique.", tier: "pro" },
  { id: "claude-sonnet-5", name: "Sonnet 5", description: "Equilibre fort entre vitesse, qualite et cout.", tier: "balanced" },
  { id: "claude-sonnet-4-6", name: "Sonnet 4.6", description: "Agent fiable pour les demandes quotidiennes.", tier: "balanced" },
  { id: "claude-haiku-4-5-20251001", name: "Haiku 4.5", description: "Reponses rapides et taches simples.", tier: "fast" },
] as const;

const AGENT_MODEL_FALLBACKS = [
  DEFAULT_MODEL,
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
  "claude-opus-4-8",
  "claude-fable-5",
];

const AGENT_CREDIT_RATES: Record<string, { credits: number; label: string; margin: "eco" | "standard" | "premium" | "max" }> = {
  "claude-haiku-4-5-20251001": { credits: 1, label: "1 cr", margin: "eco" },
  "claude-sonnet-4-6": { credits: 3, label: "3 cr", margin: "standard" },
  "claude-sonnet-5": { credits: 4, label: "4 cr", margin: "standard" },
  "claude-opus-4-6": { credits: 10, label: "10 cr", margin: "premium" },
  "claude-opus-4-7": { credits: 11, label: "11 cr", margin: "premium" },
  "claude-opus-4-8": { credits: 12, label: "12 cr", margin: "premium" },
  "claude-fable-5": { credits: 18, label: "18 cr", margin: "max" },
  "claude-mythos-5": { credits: 18, label: "18 cr", margin: "max" },
};

const AGENT_TOKEN_PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-mythos-5": { input: 10, output: 50 },
};

type AgentUsage = { inputTokens?: number; outputTokens?: number };

function agentTokenPriceForModel(modelId: string) {
  const resolved = resolveAgentModelId(modelId);
  return AGENT_TOKEN_PRICES[resolved] || AGENT_TOKEN_PRICES[DEFAULT_MODEL] || AGENT_TOKEN_PRICES["claude-sonnet-4-6"];
}

function agentCreditsForUsage(modelId: string, usage: AgentUsage, multiplier = 1) {
  const inputTokens = Math.max(0, Number(usage.inputTokens || 0));
  const outputTokens = Math.max(0, Number(usage.outputTokens || 0));
  const price = agentTokenPriceForModel(modelId);
  const providerCostUsd = Number(((inputTokens * price.input + outputTokens * price.output) / 1_000_000).toFixed(6));
  const protectedCostUsd = Math.max(providerCostUsd, 0.0005);
  const credits = Math.max(1, Math.ceil((protectedCostUsd * agentMarginMultiplierForModel(modelId) * Math.max(1, multiplier)) / CREDIT_FLOOR_USD));
  return { credits, providerCostUsd, inputTokens, outputTokens };
}

function estimatedAgentCreditsForPayload(modelId: string, payload: Record<string, unknown>, multiplier = 1) {
  const serialized = JSON.stringify(payload || {});
  const inputTokens = Math.max(1, Math.ceil((serialized.length / 3) * 1.15));
  const outputTokens = Math.max(1, Number(payload.max_tokens || 1200));
  return agentCreditsForUsage(modelId, { inputTokens, outputTokens }, multiplier).credits;
}

function agentCreditRateForModel(modelId: string) {
  const resolved = resolveAgentModelId(modelId);
  if (AGENT_CREDIT_RATES[resolved]) return AGENT_CREDIT_RATES[resolved];
  if (/opus/i.test(resolved)) return { credits: 12, label: "12 cr", margin: "premium" as const };
  if (/fable|mythos/i.test(resolved)) return { credits: 18, label: "18 cr", margin: "max" as const };
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

function publicAgentModels() {
  return AGENT_MODELS.map((model) => ({
    ...model,
    provider: "anthropic",
    creditsPerMessage: agentCreditsForUsage(model.id, { inputTokens: 2000, outputTokens: 800 }).credits,
    creditsLabel: model.id === "auto" ? "Selon les tokens" : `≈${agentCreditsForUsage(model.id, { inputTokens: 2000, outputTokens: 800 }).credits} cr*`,
    billingMode: "token_based",
    costClass: agentCreditRateForModel(model.id).margin,
    current: model.id !== "auto" && model.id === DEFAULT_MODEL,
  }));
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

function resolveAgentModelId(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw || raw === "auto" || raw === "huggy-auto") return DEFAULT_MODEL;
  if (/^claude-[a-z0-9][a-z0-9._-]*$/i.test(raw)) return raw;
  return DEFAULT_MODEL;
}

function agentModelFromBody(body: Record<string, unknown>) {
  return resolveAgentModelId(body.agentModelId || body.agent_model_id || body.anthropicModel || body.anthropic_model);
}

function agentModelFallbacks(preferred?: string) {
  const resolved = resolveAgentModelId(preferred);
  const maxCredits = agentCreditRateForModel(resolved).credits;
  return uniqueStrings([resolved, ...AGENT_MODEL_FALLBACKS]).filter((model) =>
    model === resolved || agentCreditRateForModel(model).credits <= maxCredits
  );
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
};

function agentCreditsForTurn(modelId: string, multiplier = 1) {
  return Math.max(1, Math.ceil(agentCreditRateForModel(modelId).credits * Math.max(1, multiplier)));
}

async function ensureAgentCreditsAvailable(billing: AgentBillingContext | undefined, modelId: string, requiredOverride?: number) {
  if (!billing) return;
  const creditsRequired = requiredOverride || agentCreditsForTurn(modelId, billing.multiplier);
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
  const usagePricing = usage
    ? agentCreditsForUsage(modelId, usage, billing.multiplier)
    : { credits: agentCreditsForTurn(modelId, billing.multiplier), providerCostUsd: 0, inputTokens: 0, outputTokens: 0 };
  const credits = usagePricing.credits;
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
    metadata: {
      provider: "anthropic",
      model_id: modelId,
      credit_rate_label: rate.label,
      cost_class: rate.margin,
      reason: billing.reason,
      multiplier: Math.max(1, billing.multiplier || 1),
      input_tokens: usagePricing.inputTokens,
      output_tokens: usagePricing.outputTokens,
      billing_mode: usage ? "actual_tokens" : "legacy_fallback",
    },
  });
  await billing.supabase.from("pricing_audit_logs").insert({
    user_id: billing.userId,
    credits_charged: credits,
    credit_floor_usd: CREDIT_FLOOR_USD,
    retail_credit_usd: RETAIL_CREDIT_USD,
    provider_cost_usd: usagePricing.providerCostUsd,
    status: "completed",
    metadata: {
      kind: "agent_message",
      provider: "anthropic",
      model_id: modelId,
      credit_rate_label: rate.label,
      cost_class: rate.margin,
      reason: billing.reason,
      margin_multiplier: agentMarginMultiplier,
      input_tokens: usagePricing.inputTokens,
      output_tokens: usagePricing.outputTokens,
      billing_mode: usage ? "actual_tokens" : "legacy_fallback",
    },
  });
  if (billing.send) billing.send("credits", { credits: balanceAfter, creditsMax: Number(updated.credits_max || profile?.credits_max || 100) });
  return { charged: credits, balance: balanceAfter };
}

function agentBilling(ctx: Omit<AgentBillingContext, "reason">, reason: string, multiplier = 1): AgentBillingContext {
  return { ...ctx, reason, multiplier };
}

async function anthropicMessages(payload: Record<string, unknown>, preferredModel?: string, billing?: AgentBillingContext) {
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
      await chargeAgentCredits(billing, model, usage);
      return {
        response: new Response(raw, { status: response.status, headers: response.headers }),
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flowtube-secret, x-huggyflow-secret, x-flowtube-admin-secret, x-huggyflow-admin-secret, stripe-signature, x-moneyfusion-secret, x-moneyfusion-signature, x-flowtube-provider-secret, x-fal-webhook-secret",
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
  if (/fal\.ai|fal-ai|endpoint|provider|fournisseur|FAL_KEY|anthropic|supabase|service key|api key|secret|server|internal|configuration|variable/i.test(raw)) {
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
  for (const key of ["code", "creditsRequired", "creditsAvailable", "requiresConfirmation", "planId", "packId", "modelId"]) {
    if (err.payload[key] !== undefined) payload[key] = err.payload[key];
  }
  return payload;
}

const FAL_ENDPOINTS = [
  "bytedance/seedance-2.0/image-to-video",
  "bytedance/seedance-2.0/fast/image-to-video",
  "bytedance/seedance-2.0/fast/reference-to-video",
  "bytedance/seedance-2.0/fast/text-to-video",
  "bytedance/seedance-2.0/mini/image-to-video",
  "bytedance/seedance-2.0/mini/reference-to-video",
  "bytedance/seedance-2.0/mini/text-to-video",
  "bytedance/seedance-2.0/reference-to-video",
  "bytedance/seedance-2.0/text-to-video",
  "fal-ai/krea-2/turbo",
  "fal-ai/krea-2/turbo/lora",
  "alibaba/happy-horse/v1.1/image-to-video",
  "alibaba/happy-horse/v1.1/reference-to-video",
  "alibaba/happy-horse/v1.1/text-to-video",
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/kling-video/v3/4k/image-to-video",
  "fal-ai/kling-video/v3/4k/text-to-video",
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/standard/image-to-video",
  "fal-ai/kling-video/v3/standard/text-to-video",
  "fal-ai/pixverse/v6/image-to-video",
  "fal-ai/nano-banana-2/edit",
  "fal-ai/nano-banana-2",
  "openai/gpt-image-2/edit",
  "openai/gpt-image-2",
  "fal-ai/nano-banana-pro/edit",
  "fal-ai/nano-banana-pro",
  "fal-ai/flux/schnell",
  "fal-ai/flux/dev",
  "fal-ai/flux/dev/image-to-image",
  "fal-ai/flux/dev/redux",
  "fal-ai/flux/schnell/redux",
  "fal-ai/bytedance/seedream/v4.5/edit",
  "fal-ai/bytedance/seedream/v4.5/text-to-image",
  "fal-ai/bytedance/seedream/v5/lite/text-to-image",
  "fal-ai/flux-2-pro",
  "fal-ai/flux-2-pro/edit",
  "fal-ai/flux-2-pro/outpaint",
  "fal-ai/bria/background/remove",
  "fal-ai/elevenlabs/voice-changer",
  "fal-ai/elevenlabs/dubbing",
  "fal-ai/elevenlabs/speech-to-text/scribe-v2",
  "fal-ai/elevenlabs/music",
  "fal-ai/elevenlabs/text-to-dialogue/eleven-v3",
  "fal-ai/heygen/avatar5/digital-twin",
  "fal-ai/heygen/v3/video-agent",
  "fal-ai/heygen/v3/lipsync/precision",
  "fal-ai/heygen/v3/lipsync/speed",
  "fal-ai/heygen/avatar4/image-to-video",
  "fal-ai/heygen/avatar4/digital-twin",
  "fal-ai/heygen/v2/translate/speed",
  "fal-ai/heygen/v2/translate/precision",
  "fal-ai/heygen/avatar3/digital-twin",
  "fal-ai/heygen/v2/video-agent",
  "google/gemini-omni-flash/image-to-video",
  "google/gemini-omni-flash/edit",
  "google/gemini-omni-flash",
  "fal-ai/veo3",
  "fal-ai/veo3/fast",
  "fal-ai/veo3.1/lite/first-last-frame-to-video",
  "fal-ai/veo3.1/lite/image-to-video",
  "fal-ai/veo3.1/fast/extend-video",
  "fal-ai/veo3.1/extend-video",
  "fal-ai/gemini-3.1-flash-image-preview/edit",
  "fal-ai/gemini-3.1-flash-image-preview",
  "fal-ai/lyria3/pro",
  "fal-ai/gemini-3.1-flash-tts",
  "luma/agent/ray/v3.2/video-to-video",
  "luma/agent/ray/v3.2/reframe",
  "luma/agent/ray/v3.2/text-to-video",
  "luma/agent/ray/v3.2/image-to-video",
  "luma/agent/uni-1/v1/edit",
  "luma/agent/uni-1/v1/max",
  "luma/agent/uni-1/v1/max/edit",
  "luma/agent/uni-1/v1/text-to-image",
  "bria/fibo-edit/edit",
  "fal-ai/minimax/speech-2.8-hd",
  "fal-ai/minimax/speech-2.8-turbo",
  "fal-ai/minimax/voice-clone",
  "xai/grok-imagine-video/v1.5/image-to-video",
  "xai/grok-imagine-image/quality/text-to-image",
  "xai/grok-imagine-image/quality/edit",
  "xai/grok-imagine-video/reference-to-video",
  "xai/grok-imagine-video/extend-video",
  "xai/grok-imagine-image/edit",
  "veed/subtitles",
  "veed/fabric-1.0/text",
  "veed/fabric-1.0",
  "veed/avatars/text-to-video",
  "veed/avatars/audio-to-video",
  "veed/video-background-removal/fast",
  "veed/video-background-removal",
  "veed/video-background-removal/green-screen",
  "fal-ai/creatify/aurora",
  "fal-ai/bytedance/omnihuman/v1.5",
  "fal-ai/sync-lipsync/v3/image-to-video",
  "fal-ai/sync-lipsync/v3",
  "fal-ai/seedvr/upscale/image",
  "fal-ai/topaz/upscale/video",
  "fal-ai/ideogram/remove-background",
  "sonilo/v1.1/text-to-music",
];

const FAL_ENDPOINT_OVERRIDES: Record<string, ModelOverride> = {
  "fal-ai/nano-banana-pro": { id: "nano", label: "Nano Banana Pro", costPerUnitUsd: 0.15, qualityTier: "premium" },
  "fal-ai/nano-banana-pro/edit": { id: "nano-pro-edit", label: "Nano Banana Pro Edit", costPerUnitUsd: 0.15, qualityTier: "premium" },
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
  "openai/gpt-image-2": { id: "gpt-image-2", label: "GPT Image 2", costPerUnitUsd: 0.211, qualityTier: "premium", metadata: { default_quality: "high", pricing_source: "fal.ai high 1024x1024" } },
  "openai/gpt-image-2/edit": { id: "gpt-image-2-edit", label: "GPT Image 2 Edit", costPerUnitUsd: 0.219, qualityTier: "premium", metadata: { default_quality: "high", pricing_source: "fal.ai high 1024x1024 edit" } },
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
  "google/gemini-omni-flash/image-to-video": { label: "Gemini Omni I2V", costPerUnitUsd: 0.13, pricingUnit: "second", qualityTier: "standard" },
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
  "fal-ai/topaz/upscale/video": { label: "Topaz Video Upscale", costPerUnitUsd: 0.02, pricingUnit: "second", qualityTier: "standard" },
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
      family: override.family || endpoint.split("/")[0],
      fal_only: true,
      cost_estimate: true,
      ...(override.metadata || {}),
    },
  };
}

const modelRegistry: PricingModel[] = FAL_ENDPOINTS.map((endpoint) => falModel(endpoint, FAL_ENDPOINT_OVERRIDES[endpoint]));

const OPENROUTER_PHASE2_MODELS: PricingModel[] = [
  {
    ...falModel("openrouter/xai/grok-imagine-video", {
      id: "or-grok-imagine-video",
      label: "Grok Imagine Video",
      type: "video",
      capabilities: ["text-to-video", "image-to-video", "reference-to-video"],
      costPerUnitUsd: 0.12,
      pricingUnit: "second",
      qualityTier: "standard",
      maximumUnits: 15,
      metadata: { phase: 2, provider: "openrouter", prepared_only: true },
    }),
    provider: "openrouter",
  },
  {
    ...falModel("openrouter/openai/gpt-image", {
      id: "or-gpt-image",
      label: "GPT Image",
      type: "image",
      capabilities: ["text-to-image", "edit"],
      costPerUnitUsd: 0.22,
      qualityTier: "premium",
      metadata: { phase: 2, provider: "openrouter", prepared_only: true },
    }),
    provider: "openrouter",
  },
  {
    ...falModel("openrouter/nvidia/nemotron", {
      id: "or-nemotron-triage",
      label: "Nemotron Triage",
      type: "agent",
      capabilities: ["agent-triage"],
      costPerUnitUsd: 0.001,
      qualityTier: "economy",
      metadata: { phase: 2, provider: "openrouter", prepared_only: true, role: "agent-triage" },
    }),
    provider: "openrouter",
  },
];

function enabledModelRegistry() {
  return OPENROUTER_MEDIA_ENABLED && Deno.env.get("OPENROUTER_API_KEY")
    ? [...modelRegistry, ...OPENROUTER_PHASE2_MODELS]
    : modelRegistry;
}

const FEATURED_MODEL_IDS: string[] = [];

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
  if (/fast|turbo|lite|mini|schnell/i.test(model.endpoint)) return "FAST";
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
    if (data.user?.id) return data.user.id;
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
    .select("id,user_id,scopes")
    .eq("key_hash", keyHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data?.user_id) return null;
  await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  await supabase.from("app_events").insert({
    user_id: data.user_id,
    event_name: "api_key_used",
    metadata: { route: new URL(req.url).pathname, method: req.method, key_id: data.id },
  });
  return String(data.user_id);
}

async function userIdFromRequest(req: Request, supabase: ReturnType<typeof adminClient>) {
  const userId = await optionalUserIdFromRequest(req, supabase);
  if (userId) return userId;
  throw new FlowtubeError(401, "Connecte-toi a Huggyflow pour continuer.", { code: "AUTH_REQUIRED" });
}

async function authenticatedUserIdFromRequest(req: Request, supabase: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user?.id) return data.user.id;
  }
  throw new FlowtubeError(401, "Connecte-toi pour continuer cette action.", { code: "AUTH_REQUIRED" });
}

function normalizePricingModel(row: Record<string, unknown>): PricingModel {
  const type = String(row.media_type || row.type || "image");
  const endpoint = row.fal_endpoint ? String(row.fal_endpoint) : undefined;
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  const qualityTier = String(metadata.quality_tier || row.quality_tier || qualityTierForEndpoint(endpoint || String(row.id || "")));
  const marginClass = marginClassForModel(type, qualityTier, endpoint || String(row.id || ""));
  const marginMultiplier = Number(row.margin_multiplier || QUALITY_MARGIN_MULTIPLIERS[marginClass] || MEDIA_MARGIN_MULTIPLIER);
  return {
    id: String(row.id),
    name: String(row.label || row.name || row.id),
    type,
    endpoint,
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
      ...metadata,
    },
  };
}

async function pricingCatalog(supabase: ReturnType<typeof adminClient>) {
  const baseRegistry = enabledModelRegistry();
  const { data, error } = await supabase.from("pricing_models").select("*").eq("active", true);
  if (!error && data?.length) {
    const dbModels = data.map(normalizePricingModel);
    const dbById = new Map(dbModels.map((model) => [model.id, model]));
    const merged = baseRegistry.map((registryModel) => {
      const dbModel = dbById.get(registryModel.id);
      if (!dbModel) return registryModel;
      dbById.delete(registryModel.id);
      return {
        ...registryModel,
        // Supabase is the single pricing source. The static registry only fills
        // capabilities and endpoint metadata when the database has no value.
        ...dbModel,
        name: dbModel.name || registryModel.name,
        endpoint: dbModel.endpoint || registryModel.endpoint,
        metadata: {
          ...registryModel.metadata,
          ...(dbModel.metadata || {}),
          provider: "fal.ai",
          fal_only: true,
          pricing_source: "supabase_pricing_models",
        },
      };
    });
    for (const model of dbById.values()) {
      if (model.endpoint) merged.push({
        ...model,
        metadata: { ...(model.metadata || {}), provider: "fal.ai", fal_only: true },
      });
    }
    return merged.filter((model) => Boolean(model.endpoint));
  }
  return baseRegistry;
}

function modelCapabilities(model: PricingModel) {
  const raw = (model.metadata || {}).capabilities;
  return Array.isArray(raw) ? raw.map(String) : capabilitiesForEndpoint(String(model.endpoint || ""));
}

function requestTypeFromBody(body: Record<string, unknown>, prompt: string) {
  const explicitType = String(body.type || "").toLowerCase();
  const raw = String(body.mode || "").toLowerCase();
  const allowedTypes = ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"];
  if (allowedTypes.includes(explicitType)) return explicitType;
  const text = stripAccents(prompt.toLowerCase());
  if (/lip[-\s]?sync|synchronise.*l[eè]vres|doublage.*l[eè]vres/.test(text)) return "lipsync";
  if (/clone.*voix|clonage.*voix|voice clone|digital twin/.test(text)) return "voice_clone";
  if (/musique|music|chanson|soundtrack|bande son|tts|voix off|voice over|audio|doublage|transcri/.test(text)) return "audio";
  if (/retouche|modifier|edite|edit|background|arriere-plan|upscale|agrandir|remove/.test(text) && raw === "image") return "image_edit";
  if (/reframe|extend|prolonge|upscale.*video|sous-titre|subtitle|fond.*video/.test(text) && raw === "video") return "video_edit";
  if (/\b(video|clip|reels?|tiktok|ugc|pub video|spot|storyboard anime|animation)\b/.test(text)) return "video";
  if (/\b(image|photo|visuel|affiche|poster|miniature|thumbnail|packshot)\b/.test(text)) return raw === "video" ? "video" : "image";
  if (allowedTypes.includes(raw)) return raw;
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
  return ranked[0]?.model || resolveModelFromCatalog(catalog, undefined, type);
}

function resolveModelFromCatalog(catalog: PricingModel[], modelId: string | undefined, type: string) {
  const cheapestCompatible = [...catalog.filter((m) => m.type === type)]
    .sort((a, b) => quoteFor(a).credits - quoteFor(b).credits)[0];
  const registry = enabledModelRegistry();
  const cheapestRegistry = [...registry.filter((m) => m.type === type)]
    .sort((a, b) => quoteFor(a).credits - quoteFor(b).credits)[0];
  return catalog.find((m) => m.id === modelId && m.type === type)
    || cheapestCompatible
    || registry.find((m) => m.id === modelId && m.type === type)
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
  const credits = Math.ceil((providerCostUsd * model.marginMultiplier) / model.creditFloorUsd);
  const revenueFloorUsd = Number((credits * model.creditFloorUsd).toFixed(4));
  const revenueRetailUsd = Number((credits * model.retailCreditUsd).toFixed(4));
  const grossMarginFloorUsd = Number((revenueFloorUsd - providerCostUsd).toFixed(4));
  const grossMarginRetailUsd = Number((revenueRetailUsd - providerCostUsd).toFixed(4));
  const grossMarginFloorRatio = ratioFromAmounts(revenueFloorUsd, providerCostUsd);
  const grossMarginRetailRatio = ratioFromAmounts(revenueRetailUsd, providerCostUsd);
  const minimumMarginRatio = minimumMarginRatioForModel(model);
  return {
    credits,
    units,
    providerCostUsd,
    revenueFloorUsd,
    revenueRetailUsd,
    grossMarginFloorUsd,
    grossMarginRetailUsd,
    grossMarginFloorRatio,
    grossMarginRetailRatio,
    minimumMarginRatio,
    marginMultiplier: model.marginMultiplier,
    profitable: grossMarginFloorRatio >= minimumMarginRatio,
    requiresConfirmation: model.requiresConfirmation || credits >= EXPENSIVE_CREDIT_THRESHOLD,
  };
}

function creditsFor(model: PricingModel, duration?: number) {
  return quoteFor(model, duration).credits;
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
  return plans.map(planPublic);
}

function planAmountXof(plan: PlanLimits, interval: "monthly" | "annual") {
  const explicit = interval === "annual" ? plan.annualPriceXof : plan.monthlyPriceXof;
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
  return usdToXof(interval === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd);
}

function planPublic(plan: PlanLimits) {
  const monthlyXof = plan.monthlyPriceUsd > 0 ? planAmountXof(plan, "monthly") : 0;
  const annualXof = plan.annualPriceUsd > 0 ? planAmountXof(plan, "annual") : 0;
  return {
    id: plan.id,
    displayName: plan.displayName,
    includedCredits: plan.includedCredits,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    annualPriceUsd: plan.annualPriceUsd,
    monthlyPriceXof: monthlyXof,
    annualPriceXof: annualXof,
    pricingVersion: plan.pricingVersion,
    currency: DEFAULT_BILLING_CURRENCY,
    usdXofRate: DEFAULT_USD_XOF_RATE,
    monthlyMessageLimit: plan.monthlyMessageLimit,
    dailyMessageLimit: plan.dailyMessageLimit,
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
    stripeConfigured: Boolean(plan.stripeMonthlyPriceId || plan.stripeAnnualPriceId),
    metadata: plan.metadata,
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

const CREATION_INTENT = /\b(genere|generes|cree|crees|fais|faire|produis|dessine|realise|lance|montre|construis|concois|imagine|anime|remixe?|retouche|transforme|decline|upscale|ameliore)\b|image|video|affiche|visuel|poster|photo|packshot|logo|animation|miniature|thumbnail|banniere|clip|ugc|storyboard|variante|declinaison|mockup|avatar|lipsync|voix|musique|jingle/;
const CONVERSATIONAL_ONLY = /^(salut|bonjour|bonsoir|coucou|hello|hey|merci|thanks|super|parfait|genial|top|cool|d'accord|dac|ca marche|bien recu|compris|je vois|ah ok|haha|lol)\b[\s!.,]*$/;
const QUESTION_OPENERS = /^(comment|pourquoi|combien|quand|qui|que\b|quoi\b|quel(le)?s?\b|est[- ]ce|c'est quoi|qu'est[- ]ce|peux[- ]tu|tu peux|sais[- ]tu|explique|dis[- ]moi)/;
const CAPABILITY_QUESTION = /\b(que sais[- ]tu faire|tu sais faire quoi|que peux[- ]tu faire|tu peux faire quoi|qu[' ]?est[- ]ce que tu peux faire|tes capacites|tes competences|aide[- ]moi|comment ca marche|comment fonctionne huggyflow|on cree quoi|on cree quoi aujourd'hui)\b/;

function shouldGenerateMedia(prompt: string, mode: string) {
  void mode;
  const text = stripAccents(prompt.toLowerCase().trim());
  if (!text) return false;
  // Politesses et acquiescements: on discute, on ne genere pas.
  if (CONVERSATIONAL_ONLY.test(text)) return false;
  // Questions sur l'agent ou l'interface: on explique, on ne lance pas de rendu.
  if (CAPABILITY_QUESTION.test(text)) return false;
  // Question sans intention de creation ("combien coute une video ?"): on repond, on ne genere pas.
  if (QUESTION_OPENERS.test(text) && !/\b(genere|cree|fais|produis|dessine|realise|lance|montre)\b/.test(text)) return false;
  if (text.endsWith("?") && !/\b(genere|cree|fais|produis|dessine|realise|lance|montre|peux[- ]tu)\b/.test(text)) return false;
  // Description visuelle ou verbe de creation: on produit.
  if (CREATION_INTENT.test(text)) return true;
  // Prompt descriptif type "un chat astronaute, lumiere neon": assez long et sans tournure de question.
  return text.split(/\s+/).length >= 4;
}

async function ensureProfile(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (data) return data;
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

function mediaFromGeneration(generation: Record<string, unknown>) {
  return {
    id: generation.id,
    generationId: generation.id,
    type: generation.type,
    status: generation.status,
    progress: generation.progress || 0,
    model: generation.model_label,
    modelLabel: generation.model_label,
    modelId: generation.model_id,
    prompt: generation.prompt || "",
    aspectRatio: generation.aspect_ratio,
    ratio: generation.aspect_ratio,
    scene: (generation.params as Record<string, unknown> | null)?.scene || sceneFromPrompt(String(generation.prompt || "")),
    dur: generation.duration_seconds ? `0:${String(generation.duration_seconds).padStart(2, "0")}` : undefined,
    resultUrl: generation.result_url || "",
    credits: generation.credits || 0,
  };
}

async function listProjectData(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data: projects, error } = await supabase.from("projects")
    .select("id,title,created_at")
    .eq("user_id", userId)
    .eq("archived", false)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!projects?.length) return [];

  const projectIds = projects.map((project) => project.id);
  const [conversationsResult, messagesResult] = await Promise.all([
    supabase.from("conversations").select("id,project_id,title").eq("user_id", userId).in("project_id", projectIds).order("created_at", { ascending: false }).limit(100),
    supabase.from("messages").select("id,project_id,role,content,metadata,created_at").eq("user_id", userId).in("project_id", projectIds).order("created_at", { ascending: true }).limit(2000),
  ]);
  if (conversationsResult.error) throw conversationsResult.error;
  if (messagesResult.error) throw messagesResult.error;
  const messages = messagesResult.data || [];
  const messageIds = messages.map((message) => message.id);
  const generationsResult = messageIds.length
    ? await supabase.from("generations").select("id,message_id,type,status,model_id,model_label,provider,prompt,aspect_ratio,duration_seconds,progress,result_url,error_message,credits,created_at,completed_at,params").in("message_id", messageIds).limit(2000)
    : { data: [], error: null };
  if (generationsResult.error) throw generationsResult.error;
  const conversationByProject = new Map((conversationsResult.data || []).map((conversation) => [conversation.project_id, conversation]));
  const messagesByProject = new Map<string, Record<string, unknown>[]>();
  for (const message of messages) {
    const list = messagesByProject.get(String(message.project_id)) || [];
    list.push(message);
    messagesByProject.set(String(message.project_id), list);
  }
  const genByMessage = new Map((generationsResult.data || []).map((generation) => [generation.message_id, generation]));

  return projects.map((project) => {
    const conv = conversationByProject.get(project.id);
    const projectMessages = messagesByProject.get(String(project.id)) || [];
    return {
      id: project.id,
      title: project.title,
      conversationId: conv?.id,
      messages: projectMessages.map((message) => ({
        id: message.id,
        role: message.role === "assistant" ? "agent" : message.role,
        text: message.content,
        attachments: (message.metadata as Record<string, unknown> | null)?.attachments || undefined,
        batch: (message.metadata as Record<string, unknown> | null)?.batch || undefined,
        media: !(message.metadata as Record<string, unknown> | null)?.batch && genByMessage.has(message.id)
          ? mediaFromGeneration(genByMessage.get(message.id)!)
          : ((message.metadata as Record<string, unknown> | null)?.media || undefined),
      })),
    };
  });
}

async function bootstrap(req: Request) {
  const supabase = adminClient();
  const userId = await optionalUserIdFromRequest(req, supabase);
  const [profile, projects, plans, creditPacksResult, subscriptionResult, generationCountResult] = await Promise.all([
    userId ? ensureProfile(supabase, userId) : Promise.resolve(null),
    userId ? listProjectData(supabase, userId) : Promise.resolve([]),
    publicPricingPlans(supabase),
    supabase.from("credit_packs").select("*").eq("active", true).order("price_usd", { ascending: true }),
    userId
      ? supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    userId
      ? supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", userId)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (creditPacksResult.error) throw creditPacksResult.error;
  if (subscriptionResult.error) throw subscriptionResult.error;
  if (generationCountResult.error) throw generationCountResult.error;
  const creditPacks = creditPacksResult.data || [];
  const subscription = subscriptionResult.data;
  const generationCount = generationCountResult.count || 0;
  return json({
    user: profile ? {
      id: profile.id,
      name: profile.display_name,
      email: profile.email,
      billingEmail: profile.billing_email,
      plan: profile.plan,
      billingStatus: profile.billing_status,
      currentPeriodEnd: profile.current_period_end,
      preferences: cleanMetadata(cleanMetadata(profile.metadata).preferences),
    } : null,
    credits: profile?.credits || 0,
    creditsMax: profile?.credits_max || 100,
    stats: {
      projects: projects.length,
      generations: generationCount || 0,
    },
    pricing: {
      creditFloorUsd: CREDIT_FLOOR_USD,
      retailCreditUsd: RETAIL_CREDIT_USD,
      marginMultiplier: MEDIA_MARGIN_MULTIPLIER,
      minimumMediaGrossMarginRatio: MIN_MEDIA_GROSS_MARGIN_RATIO,
      qualityMarginMultipliers: QUALITY_MARGIN_MULTIPLIERS,
      expensiveCreditThreshold: EXPENSIVE_CREDIT_THRESHOLD,
      currency: DEFAULT_BILLING_CURRENCY,
      usdXofRate: DEFAULT_USD_XOF_RATE,
      agentCreditRates: AGENT_CREDIT_RATES,
      agentDefaultModel: DEFAULT_MODEL,
      providers: {
        mediaPrivatePipeline: Boolean(Deno.env.get("FAL_KEY")),
        openRouterPrepared: true,
        openRouterEnabled: OPENROUTER_ENABLED,
        openRouterMediaEnabled: OPENROUTER_MEDIA_ENABLED && Boolean(Deno.env.get("OPENROUTER_API_KEY")),
      },
    },
    agentModels: publicAgentModels(),
    // Les moteurs media fal.ai restent backend-only. Le frontend affiche seulement les modeles agent.
    models: [],
    plans,
    creditPacks: (creditPacks || []).map((pack) => ({
      id: pack.id,
      label: pack.label,
      credits: pack.credits,
      priceUsd: pack.price_usd,
      checkoutEnabled: Boolean(pack.metadata?.checkout !== false),
      stripeConfigured: Boolean(pack.stripe_price_id || stripePriceForPack(pack)),
    })),
    billing: {
      stripeConfigured: Boolean(stripeSecret()),
      moneyFusionConfigured: moneyFusionConfigured(),
      moneyFusionCallbackUrl: moneyFusionCallbackUrl(),
      currency: DEFAULT_BILLING_CURRENCY,
      usdXofRate: DEFAULT_USD_XOF_RATE,
      siteUrl: APP_BASE_URL,
      subscription: subscription ? {
        planId: subscription.plan_id,
        status: subscription.status,
        interval: subscription.billing_interval,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      } : null,
    },
    production: {
      auth: true,
      aiAssistant: Boolean(Deno.env.get("ANTHROPIC_API_KEY")),
      aiModel: DEFAULT_MODEL,
      aiModels: publicAgentModels(),
      billing: true,
      storage: true,
      providerWebhooks: true,
      moderation: true,
      transactionalEmail: Boolean(Deno.env.get("RESEND_API_KEY")),
    },
    projects,
  });
}

const HUGGYFLOW_SYSTEM_PROMPT = [
  "Tu es HuggyFlow, super-agent autonome de creation et d'execution de niveau mondial, concurrent direct des meilleurs agents de production.",
  "HuggyFlow est un SaaS de creation media par IA: strategie, code, images, videos, retouches, avatars, lipsync, voix, musique, storyboards, campagnes visuelles et deploiement de workflows.",
  "Tu es l'orchestrateur creatif et operationnel qui transforme une intention simple en livrable professionnel sans demander a l'utilisateur de faire du prompt engineering.",
  "Tu reponds en francais, avec un ton amical, direct, pragmatique et utile. Tu es un partenaire de travail chaleureux mais tres oriente execution.",
  "Style strict: reponse directe d'abord, phrases courtes, listes a puces ultra-courtes pour toute reponse multi-idee, zero bloc dense, zero jargon inutile.",
  "",
  "Mission:",
  "- Comprendre l'intention: sujet, usage, public, format, style, references, budget credits et niveau de finition.",
  "- Decomposer chaque demande en workflow interne: objectif, etapes, meilleur chemin, execution, verification, prochaine action.",
  "- Choisir automatiquement le meilleur chemin: image, retouche, video, video depuis image, lipsync, voix, musique, storyboard ou variante.",
  "- Construire un prompt technique dense, propre et exploitable par les modeles.",
  "- Avancer vite: peu de questions, choix par defaut raisonnables, iterations concretes.",
  "- Livrer quelque chose de directement exploitable: brief, script, prompt, plan, media, devis ou action suivante.",
  "",
  "Protocole d'execution non negociable:",
  "- Classe chaque demande en silence: conseil, recherche, creation, retouche, production multi-etapes, publication ou gestion de compte.",
  "- Choisis au maximum trois skills utiles. N'enchaine des skills que si chaque etape apporte un resultat concret au livrable.",
  "- Avant un rendu couteux, verifie les references, le format, les contraintes de marque, le cout et le consentement. Demande une seule information si elle bloque vraiment la qualite ou la legalite.",
  "- Utilise un outil reel avant d'affirmer qu'une recherche, une analyse, une sauvegarde, une generation ou une publication est terminee. Ne simule jamais un resultat.",
  "- Apres toute creation, controle le livrable contre le brief: objectif, lisibilite, coherence de marque, produit, realisme, format, CTA et absence d'artefacts. Corrige seulement l'etape en cause.",
  "- Pour un workflow reutilisable, memorise uniquement une preference stable ou un playbook explicitement demande ou clairement recurrent. Chaque skill appris doit rester court, reversible, sans secret et sans donnee de paiement.",
  "",
  "Principes:",
  "- Avance par defaut. Si une information manque mais peut etre deduite, annonce l'hypothese et continue.",
  "- Pose une seule question seulement si elle change fortement le resultat ou si un fichier/reference indispensable manque.",
  "- Pour un premier essai, privilegie un rendu rapide ou une image cle. Pour un rendu final, utilise les meilleurs modeles disponibles.",
  "- Ne noie jamais l'utilisateur dans une liste de modeles. Explique le choix retenu seulement si cela aide.",
  "- Respecte les credits: confirme avant video premium, 4K, generation en lot, lipsync, clonage vocal, longue duree ou operation couteuse.",
  "- Ne dis jamais que tu es une maquette ou un prototype. Agis comme le produit HuggyFlow en production.",
  "",
  "Capacites HuggyFlow:",
  "- Images: photorealisme, produit, affiche, miniature, portrait, packshot, typographie courte, concept art.",
  "- Edition image: edit, image-to-image, outpaint, remove background, upscale, reference style.",
  "- Videos: text-to-video, image-to-video, reference-to-video, first-last-frame, extend-video, video-to-video, reframe, upscale.",
  "- Lecture video uploadee: resume, timestamps, hook, rythme, audio, scenes, moments forts, remix, critique creative et recommandations 9:16.",
  "- Audio: voix off, TTS, dialogue, musique, doublage, transcription.",
  "- Avatars: lipsync, personnage parlant, clone vocal uniquement avec consentement explicite.",
  "- Production: scripts courts, storyboards, variations, templates remixables, coherence personnage/marque/campagne.",
  "- Recherche: analyse d'URLs/pages produits fournies, synthese fiable avec labels de confiance, benchmark marche via connecteur de recherche quand disponible.",
  "",
  "Workflow:",
  "1. Lis la demande et deduis le format probable: 9:16 social, 16:9 YouTube/pub/presentation, 1:1 feed, 4:5 Instagram, 3:4 portrait/e-commerce.",
  "2. Si le brief est suffisant, ne pose pas de question: annonce une hypothese courte et lance la direction.",
  "3. Pour une image: sujet + action + cadrage + lumiere + style + contraintes negatives utiles.",
  "4. Pour une video: duree + format + mouvement camera + rythme + action principale + ambiance + reference si presente.",
  "5. Pour une retouche: conserve ce qui doit rester stable, modifie seulement ce qui est demande.",
  "6. Apres resultat: propose une ou deux iterations nettes: plus premium, autre cadrage, autre lumiere, version pub, format social, remix template.",
  "7. Pour une pub UGC realiste: collecte obligatoirement produit, video UGC de reference, au moins deux references faciales, public cible et type d'accroche. Ne demande jamais la duree, le format, l'outil de montage, le modele image ou le modele video: HuggyFlow choisit et produit en 15s vertical 9:16.",
  "",
  "Selection modele:",
  "- Tous les modeles media passent par le pipeline prive HuggyFlow. Ne cite jamais les fournisseurs, endpoints, couts internes ou details d'infrastructure a l'utilisateur.",
  "- Utilise Auto HuggyFlow par defaut: le backend choisit le meilleur moteur selon type, reference, cout, qualite, vitesse et credits.",
  "- Modeles a privilegier quand pertinents: GPT Image 2 pour image propre, GPT Image Edit/Nano/Flux pour retouche, Veo 3 ou Kling 3 pour video premium, Seedance 2 pour vitesse/qualite, Ray/PixVerse pour variations et mouvement, MiniMax/Gemini pour voix, Lyria/Sonilo pour musique, HeyGen/Sync pour lipsync.",
  "- Premium/final commercial: prefere Veo 3, Kling 3 Pro/4K, GPT Image 2, Nano Pro, Lyria Pro, HeyGen Precision.",
  "- Pub UGC 15s: cree d'abord un script horodate, puis un createur fictif coherent depuis les references faciales, puis un clip vertical realiste avec coupes controlees. Si un element obligatoire manque, demande-le avant de lancer.",
  "- Draft/test rapide: prefere fast, turbo, lite, mini ou schnell.",
  "- Reference ou personnage recurrent: prefere image-to-video, reference-to-video, avatar, lipsync ou modeles coherents avec reference.",
  "- Retouche: prefere edit, image-to-image, outpaint, remove-background ou upscale.",
  "",
  "Prompt technique:",
  "- N'envoie pas la phrase brute si elle est vague. Enrichis-la en 2 a 4 phrases denses.",
  "- Priorise sujet, action, decor, cadrage, lumiere, style, camera, mouvement, matiere, couleur, atmosphere et sortie attendue.",
  "- Evite les listes d'adjectifs sans direction, les scenes surchargees, les textes longs dans l'image et les contradictions.",
  "- Negative prompt si utile: watermark, texte deforme, mains difformes, visage instable, flou, artefacts, logos non demandes.",
  "",
  "Couts:",
  "- Formule courte: Cette option coute environ [X] credits. Je recommande ce rendu car [raison]. Tu confirmes ?",
  "- Si l'utilisateur semble economiser, propose une version moins chere: image cle, draft, duree courte ou modele fast.",
  "- Ne debite jamais mentalement des credits: attends le devis backend et le resultat confirme.",
  "- Pour les modeles agent couteux, protege la marge: utilise la grille credits backend, reserve les cerveaux premium aux briefs complexes, et privilegie Auto HuggyFlow quand le besoin est simple.",
  "",
  "Style de reponse:",
  "- Commence par le resultat ou l'information critique.",
  "- Mode rapide: Je pars sur [hypothese]. Je cree [media, format, style].",
  "- Mode concept: 3 options maximum, chacune avec intention visuelle et usage.",
  "- Mode storyboard: 3 a 6 plans courts, pas un roman.",
  "- Mode prompt: prompt principal + variante courte si utile.",
  "- Mode resultat: phrase courte + prochaine iteration concrete.",
  "- N'utilise pas de Markdown decoratif visible: pas de **gras**, pas de titres ###, pas de separateurs ---. Utilise des tirets simples et des phrases courtes.",
  "- Termine toujours par la prochaine action immediate pour valider, fournir une reference, confirmer un devis ou lancer l'etape suivante.",
  "",
  "Securite:",
  "- Refuse contenu sexuel impliquant mineurs, deepfake trompeur, usurpation, clonage vocal sans consentement, harcelement, haine, violence graphique non autorisee, contenu illegal ou dangereux.",
  "- Refuse l'image/video realiste d'une personne reelle identifiable dans un contexte compromettant, politique trompeur, sexuel ou humiliant.",
  "- Pour marques/personnages proteges, propose une alternative originale si la demande vise une copie reconnaissable.",
  "- Donne une raison courte et une alternative sure.",
  "",
  "Production en lot:",
  "- Si l'utilisateur demande plusieurs creations d'un coup (ex: 20 variantes, 50 UGC, une serie de visuels), HuggyFlow sait produire jusqu'a 50 medias en continu dans un meme lot.",
  "- Annonce le nombre, le cout total estime et demande une confirmation avant de lancer le lot.",
  "- Le lot avance par vagues selon le plan de l'utilisateur: les rendus s'enchainent automatiquement jusqu'a la fin, il n'a rien a relancer.",
  "- Pour un lot, propose une direction creative declinable: meme structure, variations de personnage, d'accroche, de decor ou d'angle.",
  "- Pour une video longue: decompose le script en mini-scenes de 5 a 15 secondes, propose une timeline claire, puis lance un lot de clips si l'utilisateur confirme.",
  "- Coherence video longue: verrouille le personnage/produit via @elements, references visuelles et first-last-frame quand disponible. Chaque scene doit avoir debut, fin, mouvement et raccord visuel.",
  "",
  "Continuite de conversation:",
  "- Tu recois l'historique recent de la conversation: appuie-toi dessus et ne redemande jamais une information deja donnee.",
  "- Ne te presente pas et ne salue pas a chaque tour: continue le fil comme un partenaire de production deja engage.",
  "- Si l'utilisateur dit \"pareil\", \"refais\", \"la meme mais...\", retrouve la derniere creation evoquee et applique la variation demandee.",
  "- Si l'utilisateur change de sujet, suis-le sans commenter le changement.",
  "- Tu recois en contexte interne le plan, le solde de credits, le projet et les dernieres creations: utilise-les pour recommander juste, sans jamais les reciter mecaniquement.",
  "- Memoire multi-couches: session courte (historique recent), episodique (dernieres creations, resultats, playbooks gagnants), long terme (identite de marque, couleurs, audience, voix, preferences). Utilise ces couches en silence pour contextualiser chaque action.",
  "- Tu disposes d'une memoire durable (marque, couleurs, audience, voix, preferences). Applique-la spontanement a chaque creation sans la reafficher. Si l'utilisateur dit \"retiens...\", \"ma marque s'appelle...\", \"mes couleurs sont...\", confirme en une phrase que c'est memorise.",
  "- Si l'utilisateur reference une creation passee (\"refais le 3e\", \"la meme mais...\", \"comme le dernier\"), tu retrouves la creation visee et tu appliques la variation demandee en gardant la coherence.",
  "- Les elements epingles (@nom) sont des references visuelles reutilisables (personnage, produit, logo, decor). Quand l'utilisateur mentionne @nom, la reference est jointe automatiquement: appuie-toi dessus pour la coherence. Il peut epingler une creation avec \"epingle ca comme @nom\".",
  "- Tu apprends des skills: quand un enchainement gagnant se repete, tu peux l'enregistrer comme playbook reutilisable (\"cree un skill X pour...\"). Quand un skill appris correspond a la demande, tu recois son playbook en contexte: applique-le. L'utilisateur peut aussi le lancer avec /nom.",
  "- Apprentissage autonome controle: si un motif de travail revient ou qu'un workflow devient reutilisable, enregistre un skill prive court avec declencheurs, playbook et garde-fous. N'apprends jamais de donnees sensibles, secrets, cles API ou informations de paiement.",
  "- Tu peux analyser un visuel de reference (hook, composition, angle), lire une page web (produit/marque/concurrent) et utiliser la recherche marche quand elle est disponible. Fais la recherche AVANT de generer quand c'est pertinent.",
  "- Quand aucune generation n'est prevue pour ce message, reponds utile et court: pas de fausse promesse de rendu.",
  "",
  "Skills internes HuggyFlow:",
  "- Avant de repondre, choisis en silence la ou les competences utiles selon la demande: video reader, UGC pipeline, UGC scriptwriter, psychologie marketing, real-time web scanner, fact-checker, trend analyst, market research, multi-scene long video generator, visual coherence engine, marketing video generator, video analyzer, soul character training, cinematic asset creator, viral clip cutter, direction image, direction video, storyboard, publicite, reseaux sociaux, copywriting, musique, voix, retouche, extraction d'objet, miniature, B-roll, UGC, personnage, strategie, automatisation ou connecteur ecosysteme disponible.",
  "- Combine plusieurs skills quand c'est plus fort: exemple analyse produit + script pub + storyboard + video, copywriting + direction image pour affiche, UGC + lipsync pour avatar parlant.",
  "- Si plusieurs skills sont pertinents, choisis le plus rentable et le plus direct. Combine seulement quand cela augmente clairement la qualite ou le taux de conversion.",
  "- Fact-checking: separe toujours ce qui est observe dans une source, ce qui est deduit, et ce qui demande verification. Ne presente jamais une supposition comme un fait.",
  "- Tendances marche: utilise les donnees web disponibles. Si le connecteur temps reel n'est pas disponible ou si aucune source n'est fournie, demande une URL/source ou donne une recommandation generale clairement marquee comme non verifiee en temps reel.",
  "- N'affiche jamais les noms techniques des skills, endpoints, fournisseurs ou parametres a l'utilisateur. Reste sur les benefices, le resultat et l'orchestration HuggyFlow.",
  "- Adapte tous les workflows joints a HuggyFlow et aux modeles disponibles via le pipeline prive HuggyFlow. Si un skill mentionne un outil externe, garde la methode creative mais execute via le pipeline HuggyFlow.",
  "- Confidentialite: si l'utilisateur demande quel fournisseur, API, serveur ou outil interne est utilise, reponds simplement que HuggyFlow orchestre ses propres moteurs de creation. Ne mentionne jamais de fournisseur media, meme pour corriger l'utilisateur.",
  "- Connecteur ecosysteme: si un fichier, lien ou integration disponible apporte du contexte, extrais les informations utiles puis avance. Si l'integration n'est pas disponible, demande seulement la source manquante.",
  "- Self-learning workflow: repere les motifs repetitifs, propose d'enregistrer un playbook reutilisable, puis applique-le automatiquement quand le contexte revient.",
  "- Si la demande parle marketing, remplace le jargon par un benefice clair: gain de temps, meilleure qualite, declinaisons rapides, coherence de marque, publication plus facile.",
  "- Video uploadee: si l'utilisateur joint une video et demande de la lire, analyser, resumer, decouper ou remixer, utilise l'analyse video avant de proposer une creation. Restitue timestamps, hook, rythme, scenes et opportunites de remix.",
  "- Production UGC 15s: collecte les donnees obligatoires, ecris un script horodate, cree un createur fictif coherent, prepare le plan vertical, puis demande confirmation du devis avant generation couteuse.",
  "- Sites, landing pages et mini-outils: livre une structure claire et des assets HuggyFlow. Ne promets une URL live que si un connecteur de deploiement est configure.",
  "",
  "Regle finale: a chaque tour, fais avancer la production HuggyFlow. Cadre, choisis, produis, ameliore.",
].join("\n");

function huggyflowSystemPromptText() {
  return Array.isArray(HUGGYFLOW_SYSTEM_PROMPT)
    ? HUGGYFLOW_SYSTEM_PROMPT.join("\n")
    : String(HUGGYFLOW_SYSTEM_PROMPT || "");
}

type HuggySkill = {
  id: string;
  label: string;
  triggers: string[];
  use: string;
};

type HuggySkillRecipe = {
  requiredInputs?: string[];
  workflow: string[];
  routing?: string[];
  output: string;
  safeguards?: string[];
};

const HUGGYFLOW_SKILL_LIBRARY: HuggySkill[] = [
  { id: "video-reader-creative-analyst", label: "lecture et analyse video", triggers: ["video uploadee", "fichier video", "analyse cette video", "lis cette video", "timestamp", "moments forts", "hook video", "pacing", "rythme video", "transcription video"], use: "lire une video fournie, extraire scenes, timestamps, hook, audio, rythme et recommandations de remix sans demander une capture." },
  { id: "ugc-15s-production-pipeline", label: "pipeline pub UGC 15s", triggers: ["ugc", "pub ugc", "video ugc", "createur ugc", "testimonial", "temoignage", "tiktok ad", "reels ad", "pub realiste", "produit face camera"], use: "collecter produit, video UGC reference, deux visages, cible et accroche; ecrire script horodate; creer personnage fictif; preparer clip vertical 15s realiste." },
  { id: "ugc-scriptwriter", label: "script createur naturel", triggers: ["script ugc", "creator script", "talking head", "script tiktok", "script reels", "temoignage script", "influencer script"], use: "ecrire un script parle naturel avec hook, probleme, preuve, benefice, gestes et CTA doux." },
  { id: "marketing-psychology-mental-models", label: "psychologie marketing", triggers: ["psychologie marketing", "mental model", "preuve sociale", "urgence", "objection", "confiance", "conversion", "prix", "pricing", "desir", "achat"], use: "choisir les bons leviers: preuve sociale, contraste, urgence ethique, friction, confiance, benefice immediat et objection principale." },
  { id: "market-research-decision-brief", label: "etude de marche decisionnelle", triggers: ["etude de marche", "market research", "analyse concurrent", "tam", "sam", "som", "investisseur", "veille", "categorie", "industrie"], use: "produire une synthese sourcée avec faits, deductions, risques, opportunites et decision recommandee." },
  { id: "media-orchestrator-private", label: "orchestration media privee", triggers: ["genere image", "cree video", "audio", "voix", "musique", "retouche", "upscale", "remove background", "sous titres", "avatar"], use: "router vers le meilleur moteur prive HuggyFlow selon qualite, cout, reference, duree et plan utilisateur, sans exposer le fournisseur." },
  { id: "interactive-motion-designer", label: "micro-interactions et fluidite UI", triggers: ["animation", "motion", "transition", "micro interaction", "skeleton", "shimmer", "bouton sensible", "drag", "swipe", "loading"], use: "ameliorer les interactions avec transitions douces, feedback immediat, skeletons et animations sobres." },
  { id: "real-time-web-scanner-fact-checker", label: "recherche web et verification", triggers: ["recherche web", "fact check", "fact-check", "verifie", "source", "sources", "url", "page produit", "site", "benchmark", "concurrent"], use: "lire les sources disponibles, separer faits observes, deductions et points a verifier, puis produire un brief fiable." },
  { id: "trend-market-analyst", label: "tendances et marche", triggers: ["tendance", "trends", "marche", "market", "benchmark", "ads performantes", "formats publicitaires", "analyse marche", "veille"], use: "etudier les signaux disponibles et transformer les tendances en angles, hooks et formats creatifs exploitables." },
  { id: "multi-scene-long-video-generator", label: "video longue multi-scenes", triggers: ["video longue", "film complet", "plusieurs scenes", "timeline", "sequence longue", "spot complet", "mini clips", "multi scene"], use: "decomposer un script global en scenes de 5 a 15 secondes, definir la timeline, puis preparer un lot de clips raccords." },
  { id: "visual-coherence-engine", label: "coherence visuelle avancee", triggers: ["coherence", "soul id", "first last frame", "first-and-last", "raccord", "transition parfaite", "meme produit", "meme personnage"], use: "verrouiller personnage/produit, references et raccords debut-fin pour garder la continuite entre clips." },
  { id: "marketing-video-generator", label: "video publicitaire", triggers: ["lien produit", "page produit", "site produit", "video publicitaire", "video marketing", "script pub", "plan pub", "advertising video"], use: "extraire l'offre, l'audience, les benefices et produire un script court avec plan video pret a lancer." },
  { id: "video-analyzer-optimizer", label: "analyse et optimisation video", triggers: ["analyse cette video", "optimise la video", "hook video", "rythme", "retention", "montage", "clip a ameliorer"], use: "analyser accroche, rythme, structure, lisibilite et proposer des corrections concretes pour augmenter l'impact." },
  { id: "soul-character-training", label: "coherence personnage et marque", triggers: ["personnage recurrent", "meme personnage", "coherence personnage", "charte visuelle", "identite visuelle", "mascotte"], use: "maintenir traits, style, voix, codes visuels et references d'un projet a l'autre." },
  { id: "cinematic-asset-creator", label: "asset cinematographique", triggers: ["ultra realiste", "cinematique", "asset produit", "animation produit", "hero shot", "film produit"], use: "concevoir une scene premium avec matiere, lumiere, camera, mouvement et direction artistique claire." },
  { id: "viral-clip-cutter", label: "clips courts viraux", triggers: ["shorts", "tiktok", "reels", "decoupe", "moments forts", "clip viral", "contenu long"], use: "identifier hooks, moments forts, coupes verticales, sous-titres et ordre de montage pour formats courts." },
  { id: "ecosystem-connector", label: "contexte depuis fichiers et liens", triggers: ["google drive", "drive", "slack", "figma", "notion", "gmail", "fichier", "document", "lien", "url", "site"], use: "utiliser les sources disponibles pour extraire un brief, une charte, un produit ou des contraintes avant de produire." },
  { id: "self-learning-workflow", label: "playbook reutilisable", triggers: ["automatiser", "repete", "a chaque fois", "workflow", "playbook", "skill", "sauvegarde cette methode"], use: "transformer un enchainement repetitif en methode reutilisable et l'appliquer quand le contexte revient." },
  { id: "gpt-image-2-director", label: "direction image premium", triggers: ["image", "affiche", "poster", "portrait", "packshot", "mockup", "texte dans l'image", "miniature"], use: "transformer l'idee en prompt visuel precis, avec cadrage, lumiere, style et contraintes de texte court." },
  { id: "kling-3-prompt-director", label: "direction video premium", triggers: ["kling", "video premium", "cinematique", "camera", "mouvement", "film"], use: "structurer la video avec sujet, action, camera, rythme, ambiance, duree, format et details de scene." },
  { id: "seedance-prompting-skills-for-cinematic-films", label: "video rapide et cinematographique", triggers: ["seedance", "video rapide", "image en video", "reference video", "scene courte"], use: "creer un prompt court, stable et tres visuel pour obtenir un mouvement lisible rapidement." },
  { id: "storyboard-cheatcode", label: "storyboard et plan de production", triggers: ["storyboard", "script", "scenario", "previs", "plans", "sequence"], use: "decouper l'idee en plans simples, puis proposer l'image cle ou la video la plus utile en premier." },
  { id: "static-ads", label: "publicite statique", triggers: ["pub", "annonce", "ad", "banniere", "meta ad", "visuel publicitaire"], use: "reutiliser une structure gagnante, clarifier l'offre et produire un visuel publicitaire pret a tester." },
  { id: "ugc-ad-production", label: "UGC et avatar parlant", triggers: ["ugc", "temoignage", "avatar", "parlant", "influenceur", "script face camera"], use: "preparer accroche, script court, intention du personnage, voix et lipsync si besoin." },
  { id: "ugc-model-swap", label: "variation de personnage", triggers: ["changer personnage", "model swap", "remplacer visage", "nouveau talent"], use: "garder le style et la structure tout en changeant proprement le personnage ou la reference." },
  { id: "ai-short-drama-flow", label: "mini-fiction", triggers: ["drama", "mini serie", "episode", "scene emotion", "tension"], use: "organiser l'histoire en moments courts avec emotion claire et progression visuelle." },
  { id: "soul-character-studio", label: "personnage coherent", triggers: ["personnage", "character", "mascotte", "identite visuelle", "reference sheet"], use: "definir traits, tenue, attitude, expressions et coherence de reference pour les iterations." },
  { id: "b-roll-shot-planner", label: "B-roll", triggers: ["b-roll", "plans de coupe", "montage", "sequence produit", "cinematic broll"], use: "proposer cinq plans courts, lisibles et raccords pour enrichir un montage." },
  { id: "video-stitching", label: "transition video", triggers: ["stitch", "transition", "relier deux videos", "avant apres"], use: "decrire le pont visuel entre debut et fin avec mouvement continu et raccord de lumiere." },
  { id: "video-advanced-pipelines", label: "boucle et extension video", triggers: ["loop", "boucle", "extend", "prolonger", "reframe", "upscale video"], use: "choisir entre boucle, extension, recadrage ou amelioration selon le resultat vise." },
  { id: "video-editor-commands", label: "edition video", triggers: ["couper", "monter", "assembler", "ralentir", "accelerer", "sous titres"], use: "traduire la demande en operation simple et confirmer le rendu attendu." },
  { id: "cinematic-motion-language", label: "mouvement cinematographique", triggers: ["camera", "travelling", "dolly", "drone", "zoom", "cinematique"], use: "nommer le mouvement camera, le rythme et la sensation sans surcharger le prompt." },
  { id: "asset-extraction", label: "objet propre et transparent", triggers: ["png", "fond transparent", "detourer", "logo", "asset", "sticker", "element ui"], use: "isoler un objet propre, net et reutilisable avec fond transparent ou arriere-plan retire." },
  { id: "google-flow-composer", label: "musique et ambiance sonore", triggers: ["musique", "jingle", "soundtrack", "audio", "chanson", "ambiance sonore"], use: "decrire rythme, instruments, energie, duree et evolution pour accompagner le visuel." },
  { id: "cod-ultimate-thumbnail", label: "miniature accrocheuse", triggers: ["thumbnail", "miniature", "youtube", "cover", "vignette"], use: "creer une composition simple, lisible, contrastree et orientee clic sans texte trop long." },
  { id: "product-photoshoot-studio", label: "shooting produit", triggers: ["photo produit", "product photoshoot", "packshot premium", "ecommerce", "produit studio", "hero product", "visuel produit"], use: "transformer une photo ou un brief produit en visuel studio/lifestyle propre, vendable et reutilisable en pub." },
  { id: "landing-page-composer", label: "page de vente", triggers: ["landing page", "page de vente", "page produit", "mini site", "site produit", "funnel", "web creator"], use: "composer une page claire avec promesse, benefices, preuves, tarifs, FAQ et CTA sans casser l'interface HuggyFlow." },
  { id: "copywriting", label: "texte commercial clair", triggers: ["texte", "copy", "landing", "pricing", "accroche", "slogan", "description"], use: "ecrire des phrases simples, rassurantes et orientees benefice." },
  { id: "ad-creative", label: "idees publicitaires", triggers: ["creative", "headline", "variante pub", "crochet", "angle publicitaire"], use: "proposer des angles courts, testables et faciles a decliner." },
  { id: "paid-ads", label: "campagne payante", triggers: ["google ads", "meta ads", "tiktok ads", "linkedin ads", "campagne"], use: "adapter format, message et appel a l'action au canal vise." },
  { id: "social-content", label: "contenu social", triggers: ["instagram", "tiktok", "linkedin", "facebook", "x/twitter", "post"], use: "adapter format, rythme et message a la plateforme." },
  { id: "content-strategy", label: "strategie de contenu", triggers: ["strategie", "calendrier", "contenu", "plan editorial", "audience"], use: "transformer l'objectif en themes, formats et prochaines creations." },
  { id: "marketing-ideas", label: "idees marketing", triggers: ["idee marketing", "campagne", "lancement", "promotion", "acquisition"], use: "trouver des concepts simples, vendables et faciles a produire." },
  { id: "marketing-psychology", label: "psychologie marketing", triggers: ["preuve sociale", "urgence", "desir", "confiance", "objection"], use: "renforcer le message avec une motivation claire sans manipulation obscure." },
  { id: "creative-brief-compiler", label: "brief creatif exploitable", triggers: ["brief", "idee vague", "je veux creer", "campagne", "concept", "aide moi a creer"], use: "transformer une intention courte en objectif, audience, promesse, format, references, livrables et prochaine etape claire." },
  { id: "brand-sentinel", label: "controle de marque", triggers: ["ma marque", "brand kit", "charte", "identite", "couleurs", "ton de marque", "coherent avec ma marque"], use: "verifier ton, audience, promesse, produit, couleurs et interdits avant de produire une nouvelle creation." },
  { id: "creative-quality-assurance", label: "controle qualite creatif", triggers: ["qualite", "verifie", "controle", "corrige", "artefact", "ameliore ce rendu", "validation"], use: "evaluer le rendu par rapport au brief, relever les ecarts et relancer uniquement l'etape necessaire." },
  { id: "cost-aware-production-router", label: "production rentable", triggers: ["budget", "credits", "moins cher", "cout", "rentable", "devis", "qualite prix"], use: "proposer le meilleur niveau de production selon le budget, les credits restants et la qualite attendue." },
  { id: "file-intelligence", label: "lecture de fichiers", triggers: ["pdf", "document", "fichier", "audio uploade", "video uploadee", "analyse le fichier", "piece jointe"], use: "extraire le contexte utile d'un document, d'une image, d'un audio ou d'une video avant de formuler une recommandation ou une creation." },
  { id: "campaign-repurposer", label: "declinaisons de campagne", triggers: ["decline", "repurpose", "recycler", "formats", "reels", "shorts", "variantes", "plusieurs plateformes"], use: "transformer un asset ou une campagne en versions adaptees aux reseaux, avec accroches, captions, miniatures et CTA." },
  { id: "african-market-localizer", label: "adaptation marche africain", triggers: ["afrique", "africain", "fcfa", "xof", "mobile money", "abidjan", "dakar", "lagos", "localiser"], use: "adapter le message, la devise, les exemples, la langue et les freins d'achat au marche cible sans caricature." },
  { id: "rights-consent-guard", label: "droits et consentement", triggers: ["consentement", "visage", "voix", "clone", "droit", "autorisation", "personne reelle"], use: "verifier les droits d'usage, le consentement et les promesses marketing avant une creation sensible." },
  { id: "prompt-engineering-expert", label: "amelioration de prompt", triggers: ["prompt", "systeme", "instruction", "ameliorer le prompt", "agent"], use: "clarifier role, contexte, contraintes, sortie attendue et criteres de qualite." },
  { id: "nike-air-force-ad", label: "style campagne mode", triggers: ["sneaker", "chaussure", "mode", "streetwear", "campagne produit"], use: "adapter l'energie publicitaire mode a une creation originale, sans copier une marque protegee." },
];

const HUGGYFLOW_SKILL_RECIPES: Record<string, HuggySkillRecipe> = {
  "ugc-15s-production-pipeline": {
    requiredInputs: ["produit nom/URL/image", "video UGC de reference", "2 references faciales", "public cible", "accroche ou Auto"],
    workflow: ["analyser produit et reference", "ecrire trois hooks puis choisir le plus adapte", "ecrire script 0-15s", "creer personnage fictif coherent", "preparer frame createur/produit", "generer clip vertical", "controler naturel, produit, CTA et sous-titres", "sauvegarder template remixable"],
    routing: ["agent pour script", "image premium pour createur/produit", "video humaine realiste", "voix/lipsync si utile"],
    output: "script horodate + devis credits + generation apres confirmation",
    safeguards: ["ne jamais demander duree/format/modele", "15s vertical 9:16 par defaut", "consentement si visage/voix reels", "ne jamais inventer une preuve, un avis client ou un resultat medical"],
  },
  "marketing-video-generator": {
    requiredInputs: ["produit ou URL", "audience si disponible", "objectif si disponible"],
    workflow: ["analyser offre", "choisir angle", "ecrire hooks", "decliner scripts", "preparer visuel/video", "proposer A/B test"],
    routing: ["research si URL", "agent pour angles", "image/video selon format"],
    output: "campagne avec angles, hooks, CTA, formats et devis",
  },
  "media-orchestrator-private": {
    workflow: ["classifier la demande", "choisir type media", "estimer cout", "selectionner moteur prive", "generer ou demander confirmation"],
    routing: ["Auto HuggyFlow", "draft economique si test", "premium si usage commercial final"],
    output: "media cree via pipeline prive, sans exposer fournisseurs ni endpoints",
    safeguards: ["ne jamais afficher les fournisseurs media au frontend", "confirmer avant operation couteuse"],
  },
  "ugc-scriptwriter": {
    requiredInputs: ["hook", "produit", "message cle", "audience"],
    workflow: ["ouvrir avec hook exact", "montrer probleme", "introduire produit naturellement", "prouver avec details", "terminer CTA doux"],
    output: "script parle naturel de 15 a 45 secondes avec gestes et ton createur",
  },
  "video-reader-creative-analyst": {
    requiredInputs: ["video ou lien video"],
    workflow: ["identifier scenes", "extraire hook et rythme", "noter timestamps", "diagnostiquer retention", "proposer remix ou pub"],
    output: "brief video lisible avec moments forts, faiblesses, recommandations et prochaine action",
  },
  "real-time-web-scanner-fact-checker": {
    requiredInputs: ["URL ou sujet a verifier"],
    workflow: ["lire source", "extraire faits", "marquer confiance", "separer deduction", "proposer decision"],
    output: "brief fiable avec faits observes, deductions et points a verifier",
  },
  "trend-market-analyst": {
    requiredInputs: ["niche, produit ou marche"],
    workflow: ["collecter signaux", "identifier formats performants", "trouver angles", "proposer tests creatifs"],
    output: "tendances exploitables en hooks, formats et prochaines creations",
  },
  "storyboard-cheatcode": {
    workflow: ["decomposer en 3 a 6 plans", "definir camera/lumiere/action", "creer keyframes low-cost", "lancer video seulement apres validation"],
    output: "storyboard valide avant generation couteuse",
  },
  "multi-scene-long-video-generator": {
    workflow: ["decouper script en mini-scenes", "estimer cout total", "demander confirmation", "generer par lots", "preparer assemblage"],
    output: "timeline multi-scenes avec clips raccords et cout total",
    safeguards: ["bloquer avant generation si cout important"],
  },
  "visual-coherence-engine": {
    workflow: ["classer references produit/personnage/style", "verrouiller @elements", "choisir reference-to-video ou first-last-frame", "controler raccords"],
    output: "coherence personnage/produit entre variantes et scenes",
  },
  "market-research-decision-brief": {
    workflow: ["collecter sources", "separer faits/deductions", "identifier opportunites", "lister risques", "terminer par decision"],
    output: "brief decisionnel avec recommandations actionnables",
  },
  "marketing-psychology-mental-models": {
    workflow: ["identifier comportement vise", "trouver frein principal", "choisir 1 a 3 leviers", "appliquer au script/visuel/CTA"],
    output: "recommandations marketing simples, ethiques et testables",
  },
  "product-photoshoot-studio": {
    requiredInputs: ["photo produit ou description produit", "usage: pub, fiche produit, hero, miniature"],
    workflow: ["nettoyer produit", "choisir decor utile", "definir lumiere/cadrage", "creer packshot ou lifestyle", "preparer variante video si utile"],
    routing: ["image premium pour final", "edit/outpaint si photo source", "video image-to-video si animation demandee"],
    output: "visuel produit vendable, propre et coherent avec la marque",
  },
  "landing-page-composer": {
    requiredInputs: ["produit/offre", "audience", "prix ou CTA si connu"],
    workflow: ["promesse claire", "benefices", "preuves", "offres/pricing", "FAQ objections", "CTA principal"],
    output: "copy et structure de page pretes a integrer sans modifier l'interface actuelle",
    safeguards: ["ne pas promettre de deploiement live si aucun connecteur n'est configure"],
  },
  "soul-character-studio": {
    requiredInputs: ["reference personnage ou description", "style marque"],
    workflow: ["definir traits stables", "creer reference sheet", "epingler @personnage", "reutiliser dans images/videos"],
    output: "personnage coherent reutilisable",
    safeguards: ["ne pas cloner visage reel sans consentement"],
  },
  "google-flow-composer": {
    workflow: ["definir energie", "choisir rythme/instruments", "adapter duree", "generer ou proposer ambiance sonore"],
    output: "direction audio claire pour voix, musique ou ambiance",
  },
  "asset-extraction": {
    workflow: ["identifier objet", "retirer fond", "nettoyer contours", "preparer PNG/asset reutilisable"],
    output: "asset propre pour scenes, pubs ou landing page",
  },
  "video-analyzer-optimizer": {
    requiredInputs: ["video ou reference"],
    workflow: ["analyser hook", "mesurer rythme", "repere baisse d'attention", "proposer coupes", "decliner version courte"],
    output: "plan d'optimisation video avec timestamps et actions concretes",
  },
  "creative-brief-compiler": {
    requiredInputs: ["objectif ou idee", "format ou canal si connu", "produit ou sujet"],
    workflow: ["clarifier resultat attendu", "deduire audience et format", "lister contraintes et references", "choisir skills utiles", "produire un plan d'execution court"],
    output: "brief de production actionnable, avec hypotheses explicites et prochaine action",
  },
  "brand-sentinel": {
    workflow: ["charger memoire de marque", "verifier produit, ton, audience et interdits", "injecter contraintes dans le brief", "signaler seulement les conflits importants"],
    output: "creation coherente avec la marque sans reexpliquer la charte a l'utilisateur",
  },
  "creative-quality-assurance": {
    workflow: ["comparer au brief", "noter hook, lisibilite, realisme, produit, format et CTA", "identifier un seul correctif prioritaire", "proposer ou lancer une variation ciblee"],
    output: "validation courte et correction ciblee, jamais une regeneration aveugle",
  },
  "cost-aware-production-router": {
    workflow: ["lire credits et objectif", "estimer cout", "choisir test, standard ou final", "proposer une alternative si la marge ou le solde ne suffit pas"],
    output: "devis clair et production adaptee au budget, sans exposer les details fournisseur",
  },
  "file-intelligence": {
    requiredInputs: ["fichier ou lien"],
    workflow: ["identifier type de fichier", "extraire contenu utile", "resumer contraintes et references", "proposer action la plus utile"],
    output: "brief fiable base sur le contenu fourni, avec limites explicites si le fichier est incomplet",
  },
  "campaign-repurposer": {
    requiredInputs: ["asset, script ou campagne source", "plateformes cibles"],
    workflow: ["extraire idee forte", "decliner hooks et formats", "adapter captions, CTA et miniatures", "preparer les exports"],
    output: "kit multi-plateforme coherent et pret a publier",
  },
  "african-market-localizer": {
    requiredInputs: ["pays ou marche cible", "produit et audience"],
    workflow: ["adapter devise, langue et contexte", "verifier sensibilites", "simplifier l'offre et le CTA", "proposer variantes locales"],
    output: "message localise, clair et respectueux pour le marche cible",
  },
  "rights-consent-guard": {
    workflow: ["identifier visage, voix, marque ou promesse sensible", "demander consentement seulement si necessaire", "retirer les elements non autorises", "proposer une alternative sure"],
    output: "creation utilisable avec garde-fous de consentement et de droits",
  },
  "gpt-image-2-director": {
    workflow: ["definir objectif de l'image", "fixer sujet, composition, lumiere et hierarchie", "prevoir zone texte et lisibilite", "controler produit, visage, mains et artefacts"],
    output: "image ou packshot propre, lisible et pret a decliner",
  },
  "kling-3-prompt-director": {
    workflow: ["decouper scene, action et camera", "verrouiller reference et format", "definir rythme et raccord", "controler mouvement, produit et lisibilite"],
    output: "brief video court, stable et pret a produire",
  },
  "seedance-prompting-skills-for-cinematic-films": {
    workflow: ["choisir action unique", "decrire mouvement lisible", "garder prompt visuel court", "preparer premiere et derniere image si raccord necessaire"],
    output: "clip rapide et coherent, utilisable dans une sequence plus longue",
  },
  "cinematic-asset-creator": {
    workflow: ["clarifier sujet", "choisir camera/lumiere", "definir matiere et mouvement", "generer asset premium"],
    output: "scene ou asset produit a rendu commercial",
  },
  "viral-clip-cutter": {
    workflow: ["trouver moments forts", "creer hook 1-3s", "couper en vertical", "ajouter rythme/CTA"],
    output: "plan de clips courts prets pour Reels, TikTok ou Shorts",
  },
  "ecosystem-connector": {
    workflow: ["lire fichiers/liens disponibles", "extraire contraintes utiles", "injecter contexte dans brief", "avancer sans redemander"],
    output: "brief enrichi par les sources fournies",
  },
  "copywriting": {
    workflow: ["remplacer jargon", "clarifier benefice", "reduire friction", "donner CTA simple"],
    output: "texte utilisateur clair, court et vendable",
  },
  "self-learning-workflow": {
    workflow: ["detecter motif repetitif", "resumer playbook", "sauvegarder declencheurs", "appliquer au prochain contexte"],
    output: "skill prive reutilisable, sans secrets ni donnees sensibles",
  },
  "prompt-engineering-expert": {
    workflow: ["clarifier role", "lister capacites", "definir routage", "ajouter garde-fous", "specifier format de reponse", "proteger UX existante"],
    output: "prompt systeme robuste, oriente execution, compatible production HuggyFlow",
  },
};

function scoreSkill(skill: HuggySkill, text: string, type: string) {
  const hay = ` ${text.toLowerCase()} ${type.toLowerCase()} `;
  let score = 0;
  for (const trigger of skill.triggers) {
    if (hay.includes(trigger.toLowerCase())) score += trigger.length > 8 ? 3 : 2;
  }
  if (type === "video" && /video|camera|scene|film|storyboard|ugc|lipsync/.test(skill.triggers.join(" "))) score += 1;
  if (type === "image" && /image|affiche|packshot|thumbnail|asset|poster/.test(skill.triggers.join(" "))) score += 1;
  return score;
}

function skillHintsForPrompt(prompt: string, type: string) {
  const ranked = HUGGYFLOW_SKILL_LIBRARY
    .map((skill) => ({ skill, score: scoreSkill(skill, prompt, type) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  const defaults = type === "video"
    ? ["kling-3-prompt-director", "seedance-prompting-skills-for-cinematic-films", "cinematic-motion-language"]
    : ["gpt-image-2-director", "copywriting", "asset-extraction"];
  const picked = ranked.length ? ranked.map((row) => row.skill) : defaults
    .map((id) => HUGGYFLOW_SKILL_LIBRARY.find((skill) => skill.id === id))
    .filter(Boolean) as HuggySkill[];
  return picked.slice(0, 5).map((skill) => {
    const recipe = HUGGYFLOW_SKILL_RECIPES[skill.id];
    const lines = [`- ${skill.label}: ${skill.use}`];
    if (recipe?.requiredInputs?.length) lines.push(`  Inputs requis: ${recipe.requiredInputs.join("; ")}`);
    if (recipe?.workflow?.length) lines.push(`  Workflow: ${recipe.workflow.join(" -> ")}`);
    if (recipe?.routing?.length) lines.push(`  Routage: ${recipe.routing.join(" -> ")}`);
    if (recipe?.output) lines.push(`  Sortie: ${recipe.output}`);
    if (recipe?.safeguards?.length) lines.push(`  Garde-fous: ${recipe.safeguards.join("; ")}`);
    return lines.join("\n");
  }).join("\n");
}

function fallbackReply(prompt: string, type: string, credits: number) {
  if (/storyboard|script|scenario|plan/.test(prompt.toLowerCase())) {
    return "Je structure ton idee en 6 plans courts: accroche visuelle, contexte, probleme, solution, preuve, puis appel a l'action. Chaque plan pourra devenir une image ou une video.";
  }
  return type === "video"
    ? `Je pars sur une video courte, claire et prete a ameliorer. Cout estime: ${credits} credits.`
    : `Je pars sur une image propre et exploitable, avec un rendu soigne. Cout estime: ${credits} credits.`;
}

type ChatTurn = { role: "user" | "assistant"; content: string };

async function conversationHistory(supabase: ReturnType<typeof adminClient>, conversationId: string, limit = 20): Promise<ChatTurn[]> {
  const { data } = await supabase.from("messages")
    .select("role,content,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  const turns: ChatTurn[] = [];
  for (const row of (data || []).reverse()) {
    const role = row.role === "assistant" ? "assistant" : "user";
    const content = String(row.content || "").trim();
    if (!content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += `\n\n${content}`;
    else turns.push({ role, content });
  }
  while (turns.length && turns[0].role === "assistant") turns.shift();
  return turns;
}

type ReplyContext = {
  planName?: string;
  creditsBalance?: number;
  projectTitle?: string;
  recentCreations?: string[];
  willGenerate?: boolean;
  batchCount?: number;
  memory?: string[];
  elements?: AgentElement[];
  learnedSkill?: string;
  attachments?: string[];
};

function normalizeRequestAttachments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((item) => {
    const obj = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    const url = String(obj.url || obj.publicUrl || obj.public_url || "").trim();
    return {
      id: String(obj.id || ""),
      name: safeUploadName(obj.name || obj.fileName || "Fichier"),
      kind: String(obj.kind || "file").slice(0, 24),
      url,
      contentType: String(obj.contentType || obj.content_type || ""),
      textPreview: String(obj.textPreview || obj.text_preview || "").slice(0, 4000),
    };
  }).filter((item) => item.url || item.textPreview);
}

function attachmentContextFromBody(body: Record<string, unknown>) {
  const items = normalizeRequestAttachments(body.attachments);
  const pushUrl = (name: string, kind: string, value: unknown) => {
    const url = String(value || "").trim();
    if (url && !items.some((item) => item.url === url)) items.push({ id: "", name, kind, url, contentType: "", textPreview: "" });
  };
  pushUrl("Image jointe", "image", body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url);
  pushUrl("Video jointe", "video", body.videoUrl || body.video_url);
  pushUrl("Audio joint", "audio", body.audioUrl || body.audio_url);
  const refs = Array.isArray(body.referenceUrls || body.reference_urls) ? (body.referenceUrls || body.reference_urls) as unknown[] : [];
  refs.slice(0, 6).forEach((url, idx) => pushUrl(`Reference ${idx + 1}`, "reference", url));
  return items.map((item) => {
    const preview = item.textPreview ? `\nExtrait:\n${item.textPreview}` : "";
    return `${item.name} (${item.kind}${item.contentType ? `, ${item.contentType}` : ""})${item.url ? `: ${item.url}` : ""}${preview}`.slice(0, 4500);
  });
}

function isVideoAttachment(item: { kind: string; contentType: string; url: string }) {
  return item.kind === "video" || item.contentType.startsWith("video/") || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(item.url);
}

function isImageAttachment(item: { kind: string; contentType: string; url: string }) {
  return item.kind === "image" || item.contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(item.url);
}

function isUgcPipelineRequest(prompt: string) {
  const text = stripAccents(prompt.toLowerCase());
  return /\bugc\b|creator content|createur face camera|temoignage video|pub realiste|video publicitaire realiste|tiktok ad|reels ad/.test(text);
}

function ugcPipelineMissingInputs(prompt: string, attachments: ReturnType<typeof normalizeRequestAttachments>) {
  const text = stripAccents(prompt.toLowerCase());
  const urls = [...prompt.matchAll(/https?:\/\/[^\s<>"']+/gi)].map((m) => m[0]);
  const imageCount = attachments.filter(isImageAttachment).length;
  const referenceUrlPattern = /tiktok|youtube|youtu\.be|pinterest|instagram|mp4|mov|webm/i;
  const hasVideoReference = attachments.some(isVideoAttachment) || urls.some((url) => referenceUrlPattern.test(url));
  const hasProductUrlOrName = urls.some((url) => !referenceUrlPattern.test(url)) || /\b(produit|marque|boutique|shop|lien produit|url produit|photo produit|nom du produit)\b.{0,80}\S/.test(text);
  const hasProductImageHint = imageCount >= 1 && /\b(produit|packshot|article|photo produit|image produit)\b/.test(text);
  const hasProduct = hasProductUrlOrName || hasProductImageHint;
  const hasFaceRefs = imageCount >= (hasProductUrlOrName ? 2 : 3) || /\b(deux|2)\b.{0,30}\b(visages?|faces?|references? faciales?|photos? de personnes?)\b/.test(text);
  const hasAudience = /\b(cible|audience|public|client(?:e)?s?|femmes?|hommes?|ados?|parents?|entrepreneurs?|age|ans)\b/.test(text);
  const missing: string[] = [];
  if (!hasProduct) missing.push("Produit: nom, URL ou image du produit.");
  if (!hasVideoReference) missing.push("Video UGC de reference: lien TikTok, Pinterest, YouTube ou fichier video.");
  if (!hasFaceRefs) missing.push("References faciales: au moins 2 images de personnes reelles coherentes avec la marque.");
  if (!hasAudience) missing.push("Public cible: qui doit acheter, avec age/probleme/desir si possible.");
  return missing;
}

function ugcPipelineMissingReply(missing: string[]) {
  return [
    "Je peux lancer la pub UGC 15s, mais il manque des elements obligatoires.",
    ...missing.map((item) => `- ${item}`),
    "- Accroche: tu peux choisir probleme/solution, avant/apres, temoignage, transformation, ou me laisser decider.",
    "",
    "Des que tu m'envoies ces elements, je prepare le script, le visage createur fictif, puis le clip vertical 9:16.",
  ].join("\n");
}

type MemoryDirective = { kind: "brand" | "fact" | "preference" | "style"; label: string; content: string };

// Detecte une consigne memoire dans le message ("retiens X", "ma marque s'appelle Y", "mes couleurs sont Z").
function extractMemoryDirectives(prompt: string): MemoryDirective[] {
  const out: MemoryDirective[] = [];
  const raw = prompt.trim();
  const text = stripAccents(raw.toLowerCase());
  const push = (kind: MemoryDirective["kind"], label: string, content: string) => {
    const c = content.trim().replace(/^["'«»]+|["'«».]+$/g, "").trim();
    if (c) out.push({ kind, label, content: c });
  };
  // Marque
  let m = raw.match(/(?:ma marque s['\s]?appelle|le nom de (?:ma|la) marque est|brand name is)\s+([^.,\n]{1,80})/i);
  if (m) push("brand", "nom de marque", m[1]);
  m = raw.match(/(?:mes? couleurs?(?: de marque)? (?:sont|est|:)|couleurs? principales?(?: sont| :)?|primary colors? (?:are|:))\s+([^.\n]{1,120})/i);
  if (m) push("brand", "couleurs de marque", m[1]);
  m = raw.match(/(?:ma cible|mon audience|mon public(?: cible)?|target audience is)(?:\s+est)?\s*:?\s+([^.\n]{1,140})/i);
  if (m) push("brand", "audience cible", m[1]);
  m = raw.match(/(?:ma tagline est|slogan\s*:|tagline is)\s+([^.\n]{1,120})/i);
  if (m) push("brand", "tagline", m[1]);
  m = raw.match(/(?:ma voix(?: de marque)? est|brand voice is|ton de voix\s*:?)\s+([^.\n]{1,140})/i);
  if (m) push("brand", "voix de marque", m[1]);
  // Consigne explicite generique: "retiens / souviens-toi / note / remember (that) ..."
  if (/\b(retiens|souviens[- ]toi|note (?:que|bien)|remember(?: that| this)?|garde en memoire)\b/.test(text)) {
    m = raw.match(/(?:retiens(?:\s+que|\s+bien|\s+ceci\s*:)?|souviens[- ]toi(?:\s+que)?|note (?:que|bien)|remember(?: that| this)?(?:\s*:)?|garde en memoire(?:\s+que)?)\s+([^\n]{2,240})/i);
    if (m && !out.length) push("fact", "note", m[1]);
    else if (m) push("fact", "note", m[1]);
  }
  return out;
}

async function loadAgentMemory(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  projectId?: string,
): Promise<string[]> {
  let query = supabase.from("agent_memory").select("kind,label,content,project_id,updated_at").eq("user_id", userId);
  if (projectId) query = query.or(`project_id.is.null,project_id.eq.${projectId}`);
  else query = query.is("project_id", null);
  const { data } = await query.order("updated_at", { ascending: false }).limit(40);
  return (data || []).map((row) => `${row.label}: ${row.content}`);
}

async function saveAgentMemory(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  projectId: string | null,
  directives: MemoryDirective[],
) {
  for (const d of directives) {
    const scope = d.kind === "brand" ? null : projectId; // la marque est globale (couche 1)
    let query = supabase.from("agent_memory").select("id").eq("user_id", userId).ilike("label", d.label);
    query = scope ? query.eq("project_id", scope) : query.is("project_id", null);
    const { data: existing } = await query.maybeSingle();
    if (existing?.id) {
      await supabase.from("agent_memory").update({ content: d.content, kind: d.kind }).eq("id", existing.id);
    } else {
      await supabase.from("agent_memory").insert({
        user_id: userId, project_id: scope, kind: d.kind, label: d.label, content: d.content,
      });
    }
  }
}

// ===== Elements: references nommees reutilisables (@nom) pour la coherence visuelle =====
type AgentElement = { name: string; kind: string; media_url: string };

async function loadElements(supabase: ReturnType<typeof adminClient>, userId: string): Promise<AgentElement[]> {
  const { data } = await supabase.from("agent_elements")
    .select("name,kind,media_url")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(30);
  return (data || []) as AgentElement[];
}

async function saveElement(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  projectId: string | null,
  name: string,
  kind: string,
  mediaUrl: string,
  sourceGenerationId?: string,
) {
  const safeKind = ["character", "product", "logo", "environment", "style", "reference"].includes(kind) ? kind : "reference";
  const { data: existing } = await supabase.from("agent_elements")
    .select("id").eq("user_id", userId).ilike("name", name).maybeSingle();
  if (existing?.id) {
    await supabase.from("agent_elements").update({ kind: safeKind, media_url: mediaUrl, source_generation_id: sourceGenerationId || null }).eq("id", existing.id);
  } else {
    await supabase.from("agent_elements").insert({
      user_id: userId, project_id: projectId, name, kind: safeKind, media_url: mediaUrl, source_generation_id: sourceGenerationId || null,
    });
  }
}

// Trouve les @mentions du prompt qui correspondent a un element enregistre.
function resolveElementMentions(prompt: string, elements: AgentElement[]): AgentElement[] {
  if (!elements.length) return [];
  const found: AgentElement[] = [];
  const mentions = [...prompt.matchAll(/@([\p{L}0-9_-]{2,40})/gu)].map((m) => stripAccents(m[1].toLowerCase()));
  for (const mention of mentions) {
    const hit = elements.find((el) => stripAccents(el.name.toLowerCase()) === mention);
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}

// Detecte "epingle/enregistre/sauvegarde (ca|la derniere|le 2e) comme (element) @nom [type personnage]".
function extractElementDirective(prompt: string): { name: string; kind: string } | null {
  const text = stripAccents(prompt.toLowerCase());
  const m = text.match(/(?:epingle|enregistre|sauvegarde|garde|pin)\b[^\n]{0,60}?\bcomme\s+(?:element\s+)?@?([\p{L}0-9_-]{2,40})/u);
  if (!m) return null;
  const name = m[1];
  const kind = /personnage|character|avatar|visage/.test(text) ? "character"
    : /produit|product|packshot/.test(text) ? "product"
    : /logo/.test(text) ? "logo"
    : /decor|environnement|lieu|scene/.test(text) ? "environment"
    : /style/.test(text) ? "style"
    : "reference";
  return { name, kind };
}

// ===== Skills auto-appris: playbooks reutilisables (couche "ceiling" de la memoire) =====
type AgentSkill = { name: string; triggers: string[]; playbook: string };

async function loadLearnedSkills(supabase: ReturnType<typeof adminClient>, userId: string): Promise<AgentSkill[]> {
  const { data } = await supabase.from("agent_skills")
    .select("name,triggers,playbook")
    .eq("user_id", userId)
    .order("uses", { ascending: false })
    .limit(30);
  return (data || []).map((row) => ({
    name: String(row.name),
    triggers: Array.isArray(row.triggers) ? row.triggers.map(String) : [],
    playbook: String(row.playbook || ""),
  }));
}

async function saveLearnedSkill(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  projectId: string | null,
  name: string,
  triggers: string[],
  playbook: string,
  autoLearned: boolean,
) {
  const { data: existing } = await supabase.from("agent_skills")
    .select("id").eq("user_id", userId).ilike("name", name).maybeSingle();
  if (existing?.id) {
    await supabase.from("agent_skills").update({ triggers, playbook, auto_learned: autoLearned }).eq("id", existing.id);
  } else {
    await supabase.from("agent_skills").insert({ user_id: userId, project_id: projectId, name, triggers, playbook, auto_learned: autoLearned });
  }
}

// Selectionne le meilleur skill appris selon les mots-cles de la demande (ou une invocation /nom).
function matchLearnedSkill(prompt: string, skills: AgentSkill[]): AgentSkill | null {
  if (!skills.length) return null;
  const text = stripAccents(prompt.toLowerCase());
  const slash = text.match(/(?:^|\s)\/([\p{L}0-9_-]{2,40})/u);
  if (slash) {
    const invoked = skills.find((s) => stripAccents(s.name.toLowerCase()) === slash[1]);
    if (invoked) return invoked;
  }
  let best: AgentSkill | null = null;
  let bestScore = 0;
  for (const skill of skills) {
    let score = 0;
    for (const trigger of skill.triggers) {
      const t = stripAccents(String(trigger).toLowerCase()).trim();
      if (t && text.includes(t)) score += t.length > 6 ? 2 : 1;
    }
    if (stripAccents(skill.name.toLowerCase()) && text.includes(stripAccents(skill.name.toLowerCase()))) score += 2;
    if (score > bestScore) { bestScore = score; best = skill; }
  }
  return bestScore >= 2 ? best : null;
}

// Detecte "cree/enregistre un skill (nomme) X [pour ...]" ou "retiens ce workflow comme skill X".
function extractSkillDirective(prompt: string): { name: string; triggers: string[] } | null {
  const text = stripAccents(prompt.toLowerCase());
  const m = text.match(/(?:cree|enregistre|sauvegarde|retiens)\b[^\n]{0,40}?\bskill\s+(?:nomme\s+|appele\s+|:\s*)?@?([\p{L}0-9_-]{2,40})/u);
  if (!m) return null;
  const name = m[1];
  // Triggers = mots significatifs apres "pour"/"quand", sinon le nom.
  const after = text.split(new RegExp(`skill\\s+(?:nomme\\s+|appele\\s+|:\\s*)?@?${name}`, "u"))[1] || "";
  const triggers = [...new Set(after.replace(/[^\p{L}0-9\s-]/gu, " ").split(/\s+/).filter((w) => w.length >= 4 && !/pour|quand|avec|dans|cette|comme|workflow/.test(w)))].slice(0, 6);
  return { name, triggers: triggers.length ? triggers : [name] };
}

function autoLearnSkillCandidate(prompt: string, attachments: ReturnType<typeof normalizeRequestAttachments>): { name: string; triggers: string[]; playbook: string } | null {
  const raw = String(prompt || "").trim();
  const text = stripAccents(raw.toLowerCase());
  if (/(token|cle api|clé api|secret|mot de passe|password|carte bancaire|numero de carte|cvv|private key|access token)/i.test(raw)) return null;
  const reusable = /\b(a chaque fois|chaque fois|toujours|repete|repeter|workflow|playbook|template|modele reutilisable|process|pipeline|pour mes pubs|pour mes videos|pour ma marque)\b/.test(text);
  const ugc = isUgcPipelineRequest(raw);
  if (!reusable) return null;
  const baseName = ugc ? "ugc-15s-production" : "workflow-huggyflow";
  const triggers = uniqueStrings([
    ugc ? "ugc" : "",
    ugc ? "pub ugc" : "",
    ...raw.replace(/[^\p{L}0-9\s-]/gu, " ").split(/\s+/).filter((w) => w.length >= 5 && !/chaque|toujours|workflow|template|faire|avec|pour|dans|cette|cette/.test(stripAccents(w.toLowerCase()))),
  ]).slice(0, 8);
  const attachmentKinds = uniqueStrings(attachments.map((item) => item.kind || item.contentType).filter(Boolean));
  const playbook = [
    `Workflow appris depuis la demande utilisateur: ${raw.slice(0, 700)}`,
    attachmentKinds.length ? `Fichiers typiques attendus: ${attachmentKinds.join(", ")}.` : "",
    ugc ? "Regle UGC: verifier produit, video reference, deux visages, cible et accroche avant generation; produire script horodate puis clip vertical 15s." : "Regle: appliquer les preferences et etapes de cette demande quand un contexte similaire revient.",
    "Garde-fou: ne jamais reutiliser secrets, cles API, donnees de paiement ou informations sensibles.",
  ].filter(Boolean).join("\n");
  return { name: baseName, triggers: triggers.length ? triggers : [baseName], playbook };
}

// ===== Analyse visuelle (vision): breakdown d'une image/pub de reference =====
async function anthropicVision(imageUrl: string, question: string, preferredModel?: string, billing?: AgentBillingContext): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return "";
  const { response } = await anthropicMessages({
    max_tokens: 900,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "url", url: imageUrl } },
        { type: "text", text: question },
      ],
    }],
  }, preferredModel, billing);
  const data = await response.json();
  return (data.content || []).map((part: { text?: string }) => part.text || "").join("").trim();
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function geminiVideoAnalysis(videoUrl: string, question: string, preferredModel?: string, billing?: AgentBillingContext): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_AI_API_KEY") || "";
  if (!apiKey) return "";
  const maxMb = Math.max(5, Number(Deno.env.get("HUGGYFLOW_VIDEO_ANALYSIS_MAX_MB") || 24));
  const video = await fetch(videoUrl, { headers: { Accept: "video/*,*/*" } });
  if (!video.ok) throw new Error(`video fetch ${video.status}`);
  const contentType = video.headers.get("content-type") || "video/mp4";
  const bytes = new Uint8Array(await video.arrayBuffer());
  if (bytes.byteLength > maxMb * 1024 * 1024) {
    return `Video recue, mais trop lourde pour l'analyse instantanee (${Math.round(bytes.byteLength / 1024 / 1024)} Mo). Envoie un extrait plus court ou demande un decoupage en scenes.`;
  }
  const model = Deno.env.get("GEMINI_VIDEO_MODEL") || "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { inline_data: { mime_type: contentType, data: base64FromBytes(bytes) } },
          { text: question },
        ],
      }],
      generationConfig: { temperature: 0.35, maxOutputTokens: 1200 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`video analysis ${res.status}`);
  const text = (data.candidates || [])
    .flatMap((candidate: Record<string, unknown>) => ((candidate.content as Record<string, unknown> | undefined)?.parts || []) as Record<string, unknown>[])
    .map((part: Record<string, unknown>) => String(part.text || ""))
    .join("")
    .trim();
  if (text && billing) await chargeAgentCredits(billing, preferredModel || DEFAULT_MODEL);
  return text;
}

const VISION_ANALYSIS_QUESTION = [
  "Tu es directeur creatif. Analyse ce visuel/creative comme un pro de la performance, pas en resume descriptif.",
  "Donne un breakdown actionnable: 1) le hook (ce qui capte l'oeil en premier et pourquoi), 2) la composition et le cadrage,",
  "3) la lumiere/palette, 4) le message et l'angle, 5) ce qui le rend efficace ou faible, 6) comment m'en inspirer pour ma propre creation.",
  "Sois concret et court, en francais.",
].join(" ");

function isVisualAnalysisRequest(prompt: string) {
  const t = stripAccents(prompt.toLowerCase());
  return /\b(analyse|analyze|decortique|breakdown|regarde|etudie|lis|resume|resumer|transcris|transcription|moments forts|inspire[- ]toi de)\b/.test(t) &&
    /\b(image|visuel|photo|pub|publicite|creative|ad|affiche|video|clip|reference|concurrent|hook|rythme|timestamp)\b/.test(t);
}

async function runVisualAnalysis(url: string, isVideo: boolean, preferredModel?: string, billing?: AgentBillingContext): Promise<string> {
  try {
    if (isVideo) {
      const out = await geminiVideoAnalysis(url, VIDEO_ANALYSIS_QUESTION, preferredModel, billing);
      if (out) return out;
    }
    if (!isVideo) {
      const out = await anthropicVision(url, VISION_ANALYSIS_QUESTION, preferredModel, billing);
      if (out) return out;
    }
  } catch (err) {
    if (err instanceof FlowtubeError) throw err;
    /* degrade ci-dessous */
  }
  return isVideo
    ? "Video recue. L'analyse video instantanee n'est pas encore configuree sur ce workspace. Ajoute la cle d'analyse video ou envoie un extrait plus court, et je te fais le breakdown complet."
    : "Je n'ai pas pu lire ce visuel. Verifie que l'URL de l'image est publique et reessaie.";
}

// ===== Recherche web: lit une page (produit/marque/concurrent) et en tire un brief =====
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

async function fetchPageText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 HuggyFlowBot", Accept: "text/html" }, signal: controller.signal });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const html = await res.text();
    return htmlToText(html);
  } finally {
    clearTimeout(timer);
  }
}

function extractFirstUrl(prompt: string): string | null {
  const m = prompt.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

function isResearchRequest(prompt: string) {
  const t = stripAccents(prompt.toLowerCase());
  return /\b(etudie|analyse|recherche|research|apprends|learn|brief|tendance|trend|scrape|lis|inspire[- ]toi|concurrent|marche|verifie|verify|fact[- ]?check|source|sources)\b/.test(t);
}

function isTrendResearchRequest(prompt: string) {
  const t = stripAccents(prompt.toLowerCase());
  return /\b(tendance|trends?|marche|market|benchmark|veille|ads? performantes?|formats? publicitaires?|concurrent(?:s)?|secteur|niche)\b/.test(t);
}

const RESEARCH_BRIEF_INSTRUCTION = [
  "A partir du contenu de page ci-dessous, produis un brief de recherche exploitable en francais.",
  "Format obligatoire: 1) Synthese courte, 2) Faits observes [confiance haute/moyenne/faible], 3) Deductions utiles [a verifier si besoin],",
  "4) Angles/messages cles, 5) 3 a 5 idees de creations (format, hook, scene), 6) Manques/opportunites.",
  "N'invente pas ce qui n'est pas dans la page. Si une information n'est pas visible, dis-le clairement.",
].join(" ");

const VIDEO_ANALYSIS_QUESTION = [
  "Tu es directeur creatif UGC et monteur performance. Analyse cette video uploadee comme reference de production.",
  "Donne un rapport actionnable en francais: 1) resume court, 2) scenes/timestamps approximatifs, 3) hook et moment fort,",
  "4) rythme et structure, 5) gestuelle/personnalite du createur, 6) audio/voix/sous-titres si perceptibles,",
  "7) ce qu'il faut reproduire pour une pub HuggyFlow, 8) idees de remix 9:16.",
  "Ne cite aucun fournisseur technique. Sois clair, court et utile.",
].join(" ");

const MARKET_BRIEF_INSTRUCTION = [
  "Produis un brief de tendances marche exploitable en francais a partir des sources/search snippets disponibles.",
  "Format obligatoire: 1) Tendances observees, 2) Ce qui semble performant, 3) Angles publicitaires a tester,",
  "4) Formats recommandes, 5) Risques/points a verifier, 6) Prochaine creation HuggyFlow.",
  "Ajoute un label de confiance par bloc: haute si plusieurs sources concordent, moyenne si signal partiel, faible si information indirecte.",
].join(" ");

async function fetchSearchText(query: string): Promise<string> {
  const endpoint = Deno.env.get("HUGGYFLOW_SEARCH_ENDPOINT") || "";
  if (!endpoint) return "";
  const url = endpoint.includes("{query}")
    ? endpoint.replace("{query}", encodeURIComponent(query))
    : `${endpoint}${endpoint.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 14000);
  try {
    const headers: Record<string, string> = { Accept: "application/json,text/plain,text/html" };
    const key = Deno.env.get("HUGGYFLOW_SEARCH_API_KEY") || "";
    if (key) headers.Authorization = `Bearer ${key}`;
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`search ${res.status}`);
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return JSON.stringify(data).slice(0, 7000);
    }
    return htmlToText(await res.text()).slice(0, 7000);
  } finally {
    clearTimeout(timer);
  }
}

async function runWebResearch(url: string, userPrompt: string, preferredModel?: string, billing?: AgentBillingContext): Promise<string> {
  let pageText = "";
  try {
    pageText = await fetchPageText(url);
  } catch (_err) {
    return `Je n'ai pas pu ouvrir ${url} (page privee, bloquee ou indisponible). Colle le texte de la page ou une autre URL et je te fais le brief.`;
  }
  if (!pageText || pageText.length < 40) {
    return `La page ${url} n'expose pas de texte lisible (souvent une SPA/JS). Donne-moi une URL avec du contenu HTML ou colle le texte.`;
  }
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return `Contenu recupere de ${url} :\n${pageText.slice(0, 800)}...`;
  try {
    const { response } = await anthropicMessages({
      max_tokens: 1000,
      system: huggyflowSystemPromptText(),
      messages: [{ role: "user", content: `${RESEARCH_BRIEF_INSTRUCTION}\n\nDemande utilisateur: ${userPrompt}\n\nContenu de ${url}:\n${pageText}` }],
    }, preferredModel, billing);
    const data = await response.json();
    const brief = (data.content || []).map((part: { text?: string }) => part.text || "").join("").trim();
    return brief || `Contenu recupere de ${url}.`;
  } catch (err) {
    if (err instanceof FlowtubeError) throw err;
    return `J'ai lu ${url} mais l'analyse est indisponible pour le moment. Reessaie dans un instant.`;
  }
}

async function runMarketResearch(query: string, userPrompt: string, preferredModel?: string, billing?: AgentBillingContext): Promise<string> {
  let corpus = "";
  try {
    corpus = await fetchSearchText(query);
  } catch (_err) {
    corpus = "";
  }
  if (!corpus || corpus.length < 80) {
    return [
      "Recherche marche temps reel indisponible pour l'instant.",
      "- Source: aucun connecteur de recherche global actif.",
      "- Action: envoie une URL produit, une page concurrente ou branche un connecteur de recherche.",
      "- Je peux quand meme transformer une source fournie en brief avec labels de confiance.",
    ].join("\n");
  }
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return `Signaux recuperes pour "${query}" :\n${corpus.slice(0, 1000)}...`;
  try {
    const { response } = await anthropicMessages({
      max_tokens: 1100,
      system: huggyflowSystemPromptText(),
      messages: [{ role: "user", content: `${MARKET_BRIEF_INSTRUCTION}\n\nDemande utilisateur: ${userPrompt}\n\nRequete: ${query}\n\nSources/search snippets:\n${corpus}` }],
    }, preferredModel, billing);
    const data = await response.json();
    const brief = (data.content || []).map((part: { text?: string }) => part.text || "").join("").trim();
    return brief || `Signaux recuperes pour "${query}".`;
  } catch (err) {
    if (err instanceof FlowtubeError) throw err;
    return "J'ai recupere des signaux marche, mais l'analyse est indisponible pour le moment. Reessaie dans un instant.";
  }
}

// Stage "rapport de cout": bilan credits du projet vs equivalent production traditionnelle.
function isCostReportRequest(prompt: string) {
  const t = stripAccents(prompt.toLowerCase());
  return /\b(rapport de cout|bilan (?:de )?(?:credits|couts?)|combien (?:j'?ai|on a) (?:depense|consomme)|cout total|cost report|resume des couts)\b/.test(t);
}

function buildCostReport(gens: { type: string; status: string; credits: number }[], creditsBalance: number) {
  const done = gens.filter((g) => g.status === "completed");
  const failed = gens.filter((g) => g.status === "failed" || g.status === "cancelled").length;
  const running = gens.filter((g) => g.status === "pending" || g.status === "running").length;
  const totalCredits = done.reduce((sum, g) => sum + Number(g.credits || 0), 0);
  const videos = done.filter((g) => g.type === "video" || g.type === "video_edit" || g.type === "lipsync").length;
  const images = done.length - videos;
  // Equivalent traditionnel (fourchettes agence/createurs): ~250-900$/video produite, ~40-120$/visuel.
  const tradLow = videos * 250 + images * 40;
  const tradHigh = videos * 900 + images * 120;
  const lines = [
    `Bilan de production du projet :`,
    `- ${done.length} creation${done.length > 1 ? "s" : ""} terminee${done.length > 1 ? "s" : ""} (${videos} video${videos > 1 ? "s" : ""}, ${images} image${images > 1 ? "s" : ""})${running ? `, ${running} en cours` : ""}${failed ? `, ${failed} echouee${failed > 1 ? "s" : ""} (remboursees)` : ""}.`,
    `- Credits consommes : ${totalCredits}. Solde restant : ${creditsBalance}.`,
  ];
  if (done.length) {
    lines.push(`- Equivalent production traditionnelle (createurs/agence) : environ $${tradLow.toLocaleString("en-US")} a $${tradHigh.toLocaleString("en-US")}.`);
  } else {
    lines.push(`- Aucune creation terminee pour l'instant : lance ta premiere production et je tiendrai les comptes.`);
  }
  return lines.join("\n");
}

// Resout une reference ordinale ("le 3e", "la derniere", "le premier", "la meme") vers une creation recente.
function resolveReferencedIndex(prompt: string, count: number): number | null {
  if (count <= 0) return null;
  const text = stripAccents(prompt.toLowerCase());
  if (/\b(la|le)?\s*(derniere?|dernier|precedent(?:e)?|last|previous)\b/.test(text)) return count - 1;
  if (/\b(le|la)?\s*(premier(?:e)?|first)\b/.test(text)) return 0;
  const ord = text.match(/\b(\d{1,2})\s*(?:e|er|eme|ere|nd|rd|th)?\b/);
  if (ord) {
    const n = parseInt(ord[1], 10);
    if (n >= 1 && n <= count) return n - 1;
  }
  const words: Record<string, number> = { premier: 1, premiere: 1, deuxieme: 2, second: 2, seconde: 2, troisieme: 3, quatrieme: 4, cinquieme: 5 };
  for (const [w, n] of Object.entries(words)) {
    if (new RegExp(`\\b${w}\\b`).test(text) && n <= count) return n - 1;
  }
  if (/\b(la meme|le meme|pareil|comme (?:ca|avant|celle|celui)|same (?:one|thing))\b/.test(text)) return count - 1;
  return null;
}

async function anthropicReply(
  prompt: string,
  type: string,
  credits: number,
  history: ChatTurn[] = [],
  onDelta?: (delta: string) => void,
  context: ReplyContext = {},
  preferredModel?: string,
  billing?: AgentBillingContext,
) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const emit = (text: string) => { if (onDelta && text) onDelta(text); };
  if (!apiKey) {
    const text = fallbackReply(prompt, type, credits);
    emit(text);
    return text;
  }
  const historyTail = history.slice(-4).filter((turn) => turn.role === "user").map((turn) => turn.content).join(" ");
  const skillContext = skillHintsForPrompt(`${prompt} ${historyTail}`.slice(0, 2000), type);
  const contextLines = [
    `Type de creation: ${type}.`,
    `Credits estimes pour ce rendu: ${credits}.`,
    context.planName ? `Plan de l'utilisateur: ${context.planName}.` : "",
    context.creditsBalance !== undefined ? `Solde de credits: ${context.creditsBalance}.` : "",
    context.projectTitle ? `Projet en cours: ${context.projectTitle}.` : "",
    context.memory && context.memory.length ? `Memoire durable (marque, preferences, faits a respecter sans les reciter):\n${context.memory.map((line) => `  - ${line}`).join("\n")}` : "",
    context.elements && context.elements.length ? `Elements epingles (references reutilisables via @nom): ${context.elements.map((el) => `@${el.name} (${el.kind})`).join(", ")}.` : "",
    context.learnedSkill ? `Skill appris a appliquer pour cette demande:\n${context.learnedSkill}` : "",
    context.attachments && context.attachments.length ? `Fichiers joints par l'utilisateur:\n${context.attachments.map((line) => `  - ${line}`).join("\n")}` : "",
    context.recentCreations && context.recentCreations.length ? `Dernieres creations du projet:\n${context.recentCreations.map((line) => `  - ${line}`).join("\n")}` : "",
    context.willGenerate ? "Une generation va etre lancee apres ta reponse: annonce la direction creative, pas de question inutile." : "Aucune generation ne sera lancee pour ce message: reponds a la question ou fais avancer le brief.",
    context.batchCount && context.batchCount >= 2 ? `Lot demande: ${context.batchCount} creations.` : "",
    `Skills a utiliser si pertinents:\n${skillContext}`,
  ].filter(Boolean).join("\n");
  const userTurn = `${prompt}\n\nContexte interne HuggyFlow:\n${contextLines}`;
  const messages: ChatTurn[] = [];
  for (const turn of [...history, { role: "user" as const, content: userTurn }]) {
    const last = messages[messages.length - 1];
    if (last && last.role === turn.role) last.content += `\n\n${turn.content}`;
    else messages.push({ role: turn.role, content: turn.content });
  }
  let full = "";
  try {
    const { response } = await anthropicMessages({
      max_tokens: 1024,
      stream: true,
      system: huggyflowSystemPromptText(),
      messages,
    }, preferredModel, billing);
    if (!response.body) throw new Error("anthropic empty stream");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);
            if (event?.type === "content_block_delta" && typeof event?.delta?.text === "string" && event.delta.text) {
              full += event.delta.text;
              emit(event.delta.text);
            }
          } catch (_err) { /* frame partiel ou ping: ignorer */ }
        }
      }
    }
    if (full.trim()) return full.trim();
    throw new Error("anthropic empty stream");
  } catch (err) {
    if (err instanceof FlowtubeError) throw err;
    if (full.trim()) return full.trim();
    const text = fallbackReply(prompt, type, credits);
    emit(text);
    return text;
  }
}

// ===== Boucle agentique (clone de l'architecture "supercomputer") =====
// Active via AGENT_LOOP_ENABLED=true. L'agent raisonne, appelle des outils, observe, itere.
function agentLoopEnabled() {
  return (Deno.env.get("AGENT_LOOP_ENABLED") || "").toLowerCase() === "true";
}

const AGENT_LOOP_MAX_ITERATIONS = 4;

const AGENT_TOOLS = [
  {
    name: "generate_media",
    description: "Lance la creation d'un media (image ou video) avec un prompt visuel dense et complet. Si le cout est eleve, une confirmation sera demandee a l'utilisateur — dans ce cas relaie le message de confirmation et arrete-toi.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Prompt visuel dense: sujet, action, cadrage, lumiere, style" },
        type: { type: "string", enum: ["image", "video", "image_edit", "audio"] },
        aspect_ratio: { type: "string", description: "Ex: 9:16, 16:9, 1:1, 4:5" },
        model_id: { type: "string", description: "Optionnel, laisser vide pour l'orchestrateur auto" },
        reference_element: { type: "string", description: "Nom d'un element epingle a utiliser comme reference visuelle (coherence personnage/produit)" },
        first_frame_url: { type: "string", description: "URL publique de l'image de depart pour un raccord video" },
        last_frame_url: { type: "string", description: "URL publique de l'image finale visee pour un raccord video" },
      },
      required: ["prompt", "type"],
    },
  },
  {
    name: "save_element",
    description: "Epingle une creation terminee comme element nomme reutilisable (@nom) pour garder la coherence visuelle sur les prochains rendus.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom court sans espaces, ex: hero, logo-nova" },
        kind: { type: "string", enum: ["character", "product", "logo", "environment", "style", "reference"] },
        media_url: { type: "string", description: "URL du media a epingler. Laisser vide pour epingler la derniere creation terminee du projet." },
      },
      required: ["name", "kind"],
    },
  },
  {
    name: "create_batch",
    description: "Prepare un lot de 2 a 50 creations declinees automatiquement en formats varies (content plan). Retourne un devis: l'utilisateur devra confirmer avec 'oui' avant le lancement. Relaie le devis et arrete-toi.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Brief de campagne commun a tout le lot" },
        count: { type: "integer", minimum: 2, maximum: 50 },
        type: { type: "string", enum: ["image", "video"] },
        aspect_ratio: { type: "string" },
        first_frame_url: { type: "string", description: "Reference de depart a reutiliser pour coherer les clips" },
        last_frame_url: { type: "string", description: "Reference finale visee pour coherer les transitions" },
      },
      required: ["prompt", "count", "type"],
    },
  },
  {
    name: "remember",
    description: "Sauvegarde une information durable dans la memoire (marque, preference, fait, style). A utiliser quand l'utilisateur partage une info reutilisable.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["brand", "fact", "preference", "style"] },
        label: { type: "string", description: "Cle courte, ex: 'nom de marque'" },
        content: { type: "string" },
      },
      required: ["kind", "label", "content"],
    },
  },
  {
    name: "estimate_cost",
    description: "Estime le cout en credits d'une creation ou d'un lot sans rien lancer.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        type: { type: "string", enum: ["image", "video", "image_edit", "audio"] },
        count: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["type"],
    },
  },
  {
    name: "list_recent_creations",
    description: "Liste les dernieres creations du projet (type, statut, prompt, url du resultat) pour t'y referer ou proposer des variations.",
    input_schema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 12 } },
    },
  },
  {
    name: "analyze_reference",
    description: "Analyse une image/pub de reference (URL) et renvoie un breakdown creatif: hook, composition, lumiere, angle, ce qui marche. Utilise pour etudier une creative concurrente.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL publique de l'image a analyser" },
        is_video: { type: "boolean" },
      },
      required: ["url"],
    },
  },
  {
    name: "research_url",
    description: "Lit une page web (produit, marque, concurrent) et en tire un brief fiable avec labels de confiance. Utilise pour etudier une marque a partir de son URL avant de creer.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
  },
  {
    name: "market_research",
    description: "Recherche des tendances marche et formats publicitaires performants via le connecteur configure. Si aucun connecteur n'est actif, demande une URL/source au lieu d'inventer.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Sujet, niche, produit ou marche a analyser" } },
      required: ["query"],
    },
  },
  {
    name: "save_skill",
    description: "Enregistre un workflow reutilisable comme skill nomme (playbook + declencheurs). A utiliser quand un enchainement gagnant merite d'etre rejoue plus tard.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        triggers: { type: "array", items: { type: "string" } },
        playbook: { type: "string", description: "La methode etape par etape a rejouer" },
      },
      required: ["name", "playbook"],
    },
  },
];

const AGENT_LOOP_SYSTEM_EXTRA = [
  "",
  "Mode agent outille:",
  "- Tu disposes d'outils reels. Utilise-les au lieu de decrire ce que tu ferais: generate_media pour creer, create_batch pour un lot ou une video multi-scenes, research_url pour lire une page, market_research pour les tendances, remember pour memoriser, save_skill pour enregistrer un playbook, estimate_cost pour un devis, list_recent_creations pour retrouver les creations passees.",
  "- Enchaine plusieurs outils si la tache le demande (ex: lire une URL puis creer; estimer puis generer; memoriser puis creer).",
  "- Quand un outil renvoie une demande de confirmation de cout, transmets-la clairement a l'utilisateur et arrete-toi la: c'est lui qui confirme.",
  "- Reste bref entre les appels d'outils: une phrase d'intention avant, une phrase de resultat apres. Pas de Markdown decoratif.",
].join("\n");

type AgentLoopCtx = {
  req: Request;
  supabase: ReturnType<typeof adminClient>;
  userId: string;
  project: Record<string, unknown>;
  conversation: Record<string, unknown>;
  profile: Record<string, unknown>;
  plan: PlanLimits;
  body: Record<string, unknown>;
  agentModelId: string;
  send: (event: string, payload: unknown) => void;
};

async function executeAgentTool(ctx: AgentLoopCtx, name: string, input: Record<string, unknown>): Promise<string> {
  const { req, supabase, userId, project, plan } = ctx;
  try {
    if (name === "generate_media") {
      let referenceUrl: string | undefined;
      if (input.reference_element) {
        const elements = await loadElements(supabase, userId);
        const hit = elements.find((el) => stripAccents(el.name.toLowerCase()) === stripAccents(String(input.reference_element).toLowerCase()));
        if (hit) referenceUrl = hit.media_url;
      }
      const result = await createGeneration(req, {
        projectId: project.id,
        prompt: String(input.prompt || ""),
        type: String(input.type || "image"),
        modelId: String(input.model_id || "auto"),
        aspectRatio: aspectRatioForRequest({ ...ctx.body, aspectRatio: input.aspect_ratio || ctx.body.aspectRatio }, String(input.prompt || ""), String(input.type || "image")),
        imageUrl: referenceUrl,
        firstFrameUrl: input.first_frame_url || input.firstFrameUrl || ctx.body.firstFrameUrl || ctx.body.first_frame_url,
        lastFrameUrl: input.last_frame_url || input.lastFrameUrl || ctx.body.lastFrameUrl || ctx.body.last_frame_url,
        confirmed: false,
      });
      ctx.send("generation", result.generation);
      return `Generation lancee${referenceUrl ? " avec reference visuelle" : ""}. L'utilisateur voit la carte de progression.`;
    }
    if (name === "save_element") {
      let mediaUrl = String(input.media_url || "");
      let sourceId: string | undefined;
      if (!mediaUrl) {
        const { data: last } = await supabase.from("generations")
          .select("id,result_url")
          .eq("project_id", project.id)
          .eq("status", "completed")
          .not("result_url", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!last?.result_url) return "Aucune creation terminee a epingler dans ce projet.";
        mediaUrl = String(last.result_url);
        sourceId = String(last.id);
      }
      await saveElement(supabase, userId, String(project.id), String(input.name || "reference"), String(input.kind || "reference"), mediaUrl, sourceId);
      return `Element @${input.name} epingle (${input.kind}). Reutilisable via reference_element ou @${input.name} dans un prompt.`;
    }
    if (name === "create_batch") {
      const count = Math.max(2, Math.min(50, Number(input.count || 2)));
      const prompt = String(input.prompt || "");
      const type = String(input.type || "video");
      const catalog = await pricingCatalog(supabase);
      const model = resolveBestModelFromCatalog(catalog, "auto", type, prompt, {});
      const quote = quoteFor(model, requestedUnitsForModel(model, {}, prompt, type));
      await enforceBatchGuards(supabase, ctx.profile, plan, model, quote, count);
      ensureProviderReady(model);
      await savePendingGeneration(supabase, ctx.profile, {
        body: {
          projectId: project.id,
          prompt,
          type,
          modelId: model.id,
          aspectRatio: aspectRatioForRequest({ aspectRatio: input.aspect_ratio }, prompt, type),
          scene: sceneFromPrompt(prompt),
          duration: type === "video" ? quote.units : undefined,
          batch: count,
          firstFrameUrl: input.first_frame_url || input.firstFrameUrl || ctx.body.firstFrameUrl || ctx.body.first_frame_url,
          lastFrameUrl: input.last_frame_url || input.lastFrameUrl || ctx.body.lastFrameUrl || ctx.body.last_frame_url,
        },
        model: { id: model.id, name: model.name, type: model.type },
        quote,
        batch: count,
      });
      return `Devis pret: ${batchConfirmationMessage(model, quote, count, type)}`;
    }
    if (name === "remember") {
      const kind = ["brand", "fact", "preference", "style"].includes(String(input.kind)) ? String(input.kind) as MemoryDirective["kind"] : "fact";
      await saveAgentMemory(supabase, userId, String(project.id), [{ kind, label: String(input.label || "note"), content: String(input.content || "") }]);
      return "Information memorisee durablement.";
    }
    if (name === "estimate_cost") {
      const type = String(input.type || "image");
      const prompt = String(input.prompt || "");
      const count = Math.max(1, Math.min(50, Number(input.count || 1)));
      const catalog = await pricingCatalog(supabase);
      const model = resolveBestModelFromCatalog(catalog, "auto", type, prompt, {});
      const quote = quoteFor(model, requestedUnitsForModel(model, {}, prompt, type));
      const renderLabel = model.type === "video" ? "rendu video" : model.type === "image" || model.type === "image_edit" ? "rendu image" : "rendu media";
      return `Devis pret: ${quote.credits} credits par ${renderLabel}${count > 1 ? `, soit environ ${quote.credits * count} credits pour ${count}` : ""}. Solde utilisateur: ${Number(ctx.profile.credits || 0)} credits.`;
    }
    if (name === "list_recent_creations") {
      const limit = Math.max(1, Math.min(12, Number(input.limit || 6)));
      const { data } = await supabase.from("generations")
        .select("type,status,prompt,result_url,created_at")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!data || !data.length) return "Aucune creation dans ce projet pour le moment.";
      return data.map((g, i) => `#${data.length - i} [${g.type}/${g.status}] ${String(g.prompt || "").slice(0, 90)}${g.result_url ? ` -> ${g.result_url}` : ""}`).join("\n");
    }
    if (name === "analyze_reference") {
      const url = String(input.url || "");
      if (!url) return "Aucune URL fournie a analyser.";
      return await runVisualAnalysis(
        url,
        Boolean(input.is_video) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url),
        ctx.agentModelId,
        agentBilling({ supabase, userId, send: ctx.send }, "agent_tool_visual_analysis"),
      );
    }
    if (name === "research_url") {
      const url = String(input.url || "");
      if (!/^https?:\/\//i.test(url)) return "URL invalide pour la recherche.";
      return await runWebResearch(
        url,
        String(ctx.body.message || ""),
        ctx.agentModelId,
        agentBilling({ supabase, userId, send: ctx.send }, "agent_tool_web_research"),
      );
    }
    if (name === "market_research") {
      const query = String(input.query || ctx.body.message || "").trim();
      if (!query) return "Sujet de recherche marche manquant.";
      return await runMarketResearch(
        query,
        String(ctx.body.message || query),
        ctx.agentModelId,
        agentBilling({ supabase, userId, send: ctx.send }, "agent_tool_market_research"),
      );
    }
    if (name === "save_skill") {
      const triggers = Array.isArray(input.triggers) ? input.triggers.map(String).slice(0, 8) : [String(input.name)];
      await saveLearnedSkill(supabase, userId, String(project.id), String(input.name || "skill"), triggers, String(input.playbook || ""), true);
      return `Skill "${input.name}" enregistre et reutilisable (declencheurs: ${triggers.join(", ")}).`;
    }
    return `Outil inconnu: ${name}.`;
  } catch (err) {
    if (err instanceof FlowtubeError) return `Action impossible: ${err.message}`;
    return `Erreur outil ${name}: ${err instanceof Error ? err.message : "inconnue"}`;
  }
}

async function runAgentLoop(
  ctx: AgentLoopCtx,
  prompt: string,
  history: ChatTurn[],
  context: ReplyContext,
): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    const text = fallbackReply(prompt, "image", 0);
    ctx.send("text", { delta: text });
    return text;
  }
  const contextLines = [
    context.planName ? `Plan: ${context.planName}.` : "",
    context.creditsBalance !== undefined ? `Solde: ${context.creditsBalance} credits.` : "",
    context.projectTitle ? `Projet: ${context.projectTitle}.` : "",
    context.memory && context.memory.length ? `Memoire durable:\n${context.memory.map((l) => `  - ${l}`).join("\n")}` : "",
    context.elements && context.elements.length ? `Elements epingles: ${context.elements.map((el) => `@${el.name} (${el.kind})`).join(", ")}.` : "",
    context.learnedSkill ? `Skill appris a appliquer:\n${context.learnedSkill}` : "",
    context.attachments && context.attachments.length ? `Fichiers joints:\n${context.attachments.map((line) => `  - ${line}`).join("\n")}` : "",
  ].filter(Boolean).join("\n");
  type ApiContent = Record<string, unknown>;
  const messages: { role: "user" | "assistant"; content: string | ApiContent[] }[] = [
    ...history.map((t) => ({ role: t.role, content: t.content as string | ApiContent[] })),
  ];
  const firstUser = `${prompt}\n\nContexte interne HuggyFlow:\n${contextLines}`;
  if (messages.length && messages[messages.length - 1].role === "user") {
    messages[messages.length - 1].content = `${messages[messages.length - 1].content}\n\n${firstUser}`;
  } else {
    messages.push({ role: "user", content: firstUser });
  }

  let emitted = "";
  const emit = (text: string) => {
    if (!text) return;
    ctx.send("text", { delta: (emitted ? "\n\n" : "") + text });
    emitted += (emitted ? "\n\n" : "") + text;
  };

  for (let iteration = 0; iteration < AGENT_LOOP_MAX_ITERATIONS; iteration++) {
    const { response } = await anthropicMessages({
      max_tokens: 1024,
      system: huggyflowSystemPromptText() + AGENT_LOOP_SYSTEM_EXTRA,
      tools: AGENT_TOOLS,
      messages,
    }, ctx.agentModelId, agentBilling({
      supabase: ctx.supabase,
      userId: ctx.userId,
      send: ctx.send,
    }, `agent_loop_iteration_${iteration + 1}`));
    const data = await response.json();
    const content: ApiContent[] = Array.isArray(data.content) ? data.content : [];
    for (const block of content) {
      if (block.type === "text" && typeof block.text === "string") emit(block.text.trim());
    }
    const toolUses = content.filter((block) => block.type === "tool_use");
    if (data.stop_reason !== "tool_use" || !toolUses.length) break;

    messages.push({ role: "assistant", content });
    const results: ApiContent[] = [];
    for (const toolUse of toolUses) {
      const output = await executeAgentTool(ctx, String(toolUse.name), cleanMetadata(toolUse.input));
      results.push({ type: "tool_result", tool_use_id: toolUse.id, content: output });
    }
    messages.push({ role: "user", content: results });
  }

  if (!emitted.trim()) {
    const text = "C'est note. Dis-moi ce que tu veux produire et je m'en occupe.";
    ctx.send("text", { delta: text });
    emitted = text;
  }
  return emitted.trim();
}

function firstString(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstString(item);
      if (found) return found;
    }
  }
  return "";
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => firstString(item)).filter(Boolean);
}

function falInput(model: PricingModel, prompt: string, aspectRatio: string, duration: number, params: Record<string, unknown> = {}) {
  const caps = modelCapabilities(model);
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
  };
  const imageUrl = firstString(params.imageUrl || params.image_url || params.referenceImageUrl || params.reference_image_url || params.sourceImageUrl || params.source_image_url);
  const videoUrl = firstString(params.videoUrl || params.video_url || params.sourceVideoUrl || params.source_video_url);
  const audioUrl = firstString(params.audioUrl || params.audio_url || params.voiceUrl || params.voice_url);
  const firstFrameUrl = firstString(params.firstFrameUrl || params.first_frame_url);
  const lastFrameUrl = firstString(params.lastFrameUrl || params.last_frame_url);
  const refs = stringArray(params.referenceUrls || params.reference_urls || params.referenceImageUrls || params.reference_image_urls);

  if (model.pricingUnit === "second") input.duration = Math.round(duration);
  if (model.type === "image" || model.type === "image_edit") input.num_images = Number(params.numImages || params.num_images || 1);
  if (imageUrl) {
    input.image_url = imageUrl;
    input.input_image_url = imageUrl;
  }
  if (videoUrl) input.video_url = videoUrl;
  if (audioUrl) input.audio_url = audioUrl;
  if (firstFrameUrl) input.first_frame_image_url = firstFrameUrl;
  if (lastFrameUrl) input.last_frame_image_url = lastFrameUrl;
  if (refs.length) {
    input.image_urls = refs;
    input.reference_image_urls = refs;
    input.reference_images = refs;
  }
  if (caps.includes("tts") || caps.includes("music") || caps.includes("speech-to-text")) {
    input.text = prompt;
  }
  if (caps.includes("remove-background")) {
    delete input.prompt;
    if (imageUrl) input.image_url = imageUrl;
  }
  return input;
}

function ensureProviderReady(model: PricingModel) {
  const provider = model.provider || String((model.metadata || {}).provider || "fal.ai");
  if (provider === "openrouter") {
    if (!OPENROUTER_MEDIA_ENABLED || !Deno.env.get("OPENROUTER_API_KEY")) {
      throw new FlowtubeError(503, "Ce moteur HuggyFlow est prepare pour une prochaine phase, mais il n'est pas encore active.", { code: "PROVIDER_NOT_CONFIGURED", modelId: model.id });
    }
    throw new FlowtubeError(503, "Ce moteur HuggyFlow est prepare mais le runner media Phase 2 n'est pas encore active.", { code: "PROVIDER_NOT_CONFIGURED", modelId: model.id });
  }
  if (!Deno.env.get("FAL_KEY")) {
    throw new FlowtubeError(503, "fal.ai n'est pas encore configure. Ajoute FAL_KEY dans Supabase avant de lancer des generations.", { code: "PROVIDER_NOT_CONFIGURED" });
  }
  if (!model.endpoint) {
    throw new FlowtubeError(503, `Endpoint fal.ai manquant pour ${model.name}.`, { code: "PROVIDER_ENDPOINT_MISSING", modelId: model.id });
  }
}

async function startFalGeneration(generation: Record<string, unknown>, model: PricingModel) {
  const key = Deno.env.get("FAL_KEY");
  const supabase = adminClient();
  if (!key || !model.endpoint) {
    await supabase.from("generations").update({
      status: "failed",
      error_message: !key ? "fal.ai is not configured" : "fal.ai endpoint is missing",
      provider_payload: { provider_configured: false },
    }).eq("id", generation.id);
    await trackGenerationJob(supabase, generation, "failed", { error: !key ? "provider_not_configured" : "provider_endpoint_missing" });
    return;
  }
  try {
    fal.config({ credentials: key });
    const params = cleanMetadata(generation.params);
    const request = await fal.queue.submit(String(model.endpoint || ""), {
      input: falInput(model, String(generation.prompt || ""), String(generation.aspect_ratio || "4:5"), Number(generation.duration_seconds || model.defaultUnits || 5), params),
    });
    await supabase.from("generations").update({
      status: "running",
      fal_job_id: request.request_id,
      provider_payload: { submitted: request },
    }).eq("id", generation.id);
    await trackGenerationJob(supabase, { ...generation, fal_job_id: request.request_id }, "running", { submitted_at: new Date().toISOString() });
  } catch (err) {
    await supabase.from("generations").update({
      status: "failed",
      error_message: err instanceof Error ? err.message : "fal.ai submission failed",
      provider_payload: {
        fal_error: err instanceof Error ? err.message : "fal.ai submission failed",
      },
    }).eq("id", generation.id);
    await trackGenerationJob(supabase, generation, "failed", { error: err instanceof Error ? err.message : "fal_submission_failed" });
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function projectTitleFromPrompt(prompt: string) {
  const clean = String(prompt || "")
    .replace(/\s+/g, " ")
    .replace(/^["'`]+|["'`]+$/g, "")
    .trim();
  if (!clean) return "Nouveau projet";
  return clean.length > 44 ? `${clean.slice(0, 44).trim()}...` : clean;
}

function isUntitledProject(title: unknown) {
  return !String(title || "").trim() || /^nouveau projet$/i.test(String(title || "").trim());
}

function projectDonePayload(project: Record<string, unknown>, conversation: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    ok: true,
    projectId: String(project.id),
    conversationId: String(conversation.id),
    projectTitle: String(project.title || "Nouveau projet"),
    ...extra,
  };
}

async function resolveProjectAndConversation(supabase: ReturnType<typeof adminClient>, userId: string, projectId?: string, titleHint = "Nouveau projet") {
  const requested = String(projectId || "").trim();
  let project = null;
  if (requested && isUuid(requested)) {
    const { data } = await supabase.from("projects").select("*").eq("id", requested).eq("user_id", userId).maybeSingle();
    project = data;
  }
  if (!project) {
    return await createProject(supabase, userId, titleHint || "Nouveau projet");
  }
  let { data: conversation } = await supabase.from("conversations").select("*").eq("project_id", project.id).eq("user_id", userId).limit(1).maybeSingle();
  if (!conversation) {
    const { data, error } = await supabase.from("conversations").insert({ user_id: userId, project_id: project.id, title: project.title }).select("*").single();
    if (error) throw error;
    conversation = data;
  }
  return { project, conversation };
}

async function renameUntitledProject(supabase: ReturnType<typeof adminClient>, userId: string, project: Record<string, unknown>, conversation: Record<string, unknown>, prompt: string, previousMessages = 0) {
  if (previousMessages > 0 || !isUntitledProject(project.title)) return { project, conversation };
  const title = projectTitleFromPrompt(prompt);
  if (!title || isUntitledProject(title)) return { project, conversation };
  const { data: updatedProject } = await supabase.from("projects")
    .update({ title })
    .eq("id", project.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  const { data: updatedConversation } = await supabase.from("conversations")
    .update({ title })
    .eq("id", conversation.id)
    .eq("user_id", userId)
    .select("*")
    .maybeSingle();
  return {
    project: updatedProject || { ...project, title },
    conversation: updatedConversation || { ...conversation, title },
  };
}

function monthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function dayStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

function isConfirmationText(prompt: string) {
  return /^(oui|ok|okay|confirme|confirm|lance|go|vas-y|valide|je confirme)\b/i.test(prompt.trim());
}

function isCancelText(prompt: string) {
  return /^(non|annule|stop|cancel|ne lance pas)\b/i.test(prompt.trim());
}

function cleanMetadata(value: unknown) {
  return (value && typeof value === "object" && !Array.isArray(value)) ? value as Record<string, unknown> : {};
}

async function savePendingGeneration(supabase: ReturnType<typeof adminClient>, profile: Record<string, unknown>, pending: Record<string, unknown>) {
  const metadata = cleanMetadata(profile.metadata);
  metadata.pending_generation = {
    ...pending,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
  await supabase.from("profiles").update({ metadata }).eq("id", profile.id);
}

async function clearPendingGeneration(supabase: ReturnType<typeof adminClient>, profile: Record<string, unknown>) {
  const metadata = cleanMetadata(profile.metadata);
  delete metadata.pending_generation;
  await supabase.from("profiles").update({ metadata }).eq("id", profile.id);
}

function confirmationMessage(model: PricingModel, quote: PricingQuote) {
  const unitLabel = model.pricingUnit === "second" ? `${quote.units}s` : `${quote.units}`;
  const renderLabel = model.type === "video" ? "rendu video" : model.type === "image" || model.type === "image_edit" ? "rendu image" : "rendu media";
  return `Cette action coute ${quote.credits} credits (${renderLabel}, ${unitLabel}). Confirme avec "oui" pour lancer, ou "annule" pour ignorer.`;
}

async function trackGenerationJob(
  supabase: ReturnType<typeof adminClient>,
  generation: Record<string, unknown>,
  status: "queued" | "running" | "completed" | "failed" | "cancelled",
  extra: Record<string, unknown> = {},
) {
  const generationId = String(generation?.id || "");
  const userId = String(generation?.user_id || "");
  if (!isUuid(generationId) || !isUuid(userId)) return;
  const completedAt = ["completed", "failed", "cancelled"].includes(status) ? new Date().toISOString() : null;
  const metadata = {
    model_id: generation.model_id || null,
    media_type: generation.type || null,
    provider_job_id: generation.fal_job_id || null,
    ...extra,
  };
  const { error } = await supabase.from("generation_jobs").upsert({
    generation_id: generationId,
    user_id: userId,
    status,
    attempts: status === "running" ? 1 : 0,
    next_attempt_at: new Date().toISOString(),
    completed_at: completedAt,
    last_error: status === "failed" ? String(extra.error || generation.error_message || "Generation failed") : null,
    metadata,
  }, { onConflict: "generation_id" });
  if (error) console.error("generation job tracking failed", error.message);
}

async function enforceMessageLimits(supabase: ReturnType<typeof adminClient>, userId: string, plan: PlanLimits) {
  const { count: monthlyCount } = await supabase.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", monthStartIso());
  if ((monthlyCount || 0) >= plan.monthlyMessageLimit) {
    throw new FlowtubeError(429, `Plafond mensuel atteint pour le plan ${plan.displayName}. Passe au plan superieur pour continuer.`, { code: "MONTHLY_MESSAGE_LIMIT" });
  }

  const { count: dailyCount } = await supabase.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", dayStartIso());
  if ((dailyCount || 0) >= plan.dailyMessageLimit) {
    throw new FlowtubeError(429, `Plafond journalier atteint pour le plan ${plan.displayName}. Reviens demain ou upgrade.`, { code: "DAILY_MESSAGE_LIMIT" });
  }
}

async function enforceGenerationGuards(
  supabase: ReturnType<typeof adminClient>,
  profile: Record<string, unknown>,
  plan: PlanLimits,
  model: PricingModel,
  quote: PricingQuote,
) {
  const userId = String(profile.id);
  if (!plan.allowedMediaTypes.includes(model.type)) {
    throw new FlowtubeError(403, `Le plan ${plan.displayName} ne permet pas encore ce type de generation.`, { code: "MEDIA_TYPE_NOT_ALLOWED" });
  }
  if (Number(profile.credits || 0) < quote.credits) {
    throw new FlowtubeError(402, `Solde insuffisant : ${quote.credits} credits requis, ${Number(profile.credits || 0)} disponibles.`, {
      code: "INSUFFICIENT_CREDITS",
      requiredCredits: quote.credits,
      availableCredits: Number(profile.credits || 0),
    });
  }
  if (!quote.profitable) {
    throw new FlowtubeError(409, "Ce rendu est temporairement indisponible : son tarif doit etre ajuste avant lancement. Essaie Auto HuggyFlow ou une duree plus courte.", {
      code: "MARGIN_GUARD",
      credits: quote.credits,
      providerCostUsd: quote.providerCostUsd,
      grossMarginFloorRatio: quote.grossMarginFloorRatio,
      minimumMarginRatio: quote.minimumMarginRatio,
      modelId: model.id,
    });
  }

  if (model.type === "video") {
    const { count: dailyVideos } = await supabase.from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("type", "video")
      .gte("created_at", dayStartIso())
      .not("status", "in", "(failed,cancelled)");
    if ((dailyVideos || 0) >= plan.dailyVideoLimit) {
      throw new FlowtubeError(429, `Plafond video journalier atteint pour le plan ${plan.displayName}.`, { code: "DAILY_VIDEO_LIMIT" });
    }
  }

  const runningType = model.type === "video" ? "video" : "image";
  const maxConcurrent = model.type === "video" ? plan.concurrentVideoJobs : plan.concurrentImageJobs;
  const { count: runningJobs } = await supabase.from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", runningType)
    .in("status", ["pending", "running"]);
  if ((runningJobs || 0) >= maxConcurrent) {
    throw new FlowtubeError(429, `Trop de generations ${runningType} en cours pour le plan ${plan.displayName}.`, { code: "CONCURRENT_JOB_LIMIT" });
  }
}

async function createGeneration(req: Request, body: Record<string, unknown>, assistantText?: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);

  const prompt = String(body.prompt || body.message || "");
  const type = requestTypeFromBody(body, prompt);
  const catalog = await pricingCatalog(supabase);
  const model = resolveBestModelFromCatalog(catalog, String(body.modelId || "auto"), type, prompt, body);
  const requestedUnits = requestedUnitsForModel(model, body, prompt, type);
  const quote = quoteFor(model, requestedUnits);
  const aspectRatio = aspectRatioForRequest(body, prompt, type);
  const credits = quote.credits;
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  await enforceRateLimit(req, supabase, `generate.${type}`, userId, GENERATION_RATE_LIMIT);
  let { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""), projectTitleFromPrompt(prompt));
  const { count: previousMessages } = await supabase.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .eq("user_id", userId);
  ({ project, conversation } = await renameUntitledProject(supabase, userId, project, conversation, prompt, previousMessages || 0));
  const moderation = await enforcePromptPolicy(supabase, profile, prompt, String(project.id));
  await enforceGenerationGuards(supabase, profile, plan, model, quote);
  ensureProviderReady(model);

  if (quote.requiresConfirmation && body.confirmed !== true) {
    const pendingBody = {
      projectId: project.id,
      prompt,
      type,
      modelId: model.id,
      aspectRatio,
      scene: body.scene || sceneFromPrompt(prompt),
      duration: model.pricingUnit === "second" ? quote.units : undefined,
      units: model.pricingUnit !== "second" ? quote.units : undefined,
      imageUrl: body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url,
      videoUrl: body.videoUrl || body.video_url,
      audioUrl: body.audioUrl || body.audio_url,
      referenceUrls: body.referenceUrls || body.reference_urls,
      firstFrameUrl: body.firstFrameUrl || body.first_frame_url,
      lastFrameUrl: body.lastFrameUrl || body.last_frame_url,
    };
    await savePendingGeneration(supabase, profile, {
      body: pendingBody,
      model: { id: model.id, name: model.name, type: model.type },
      quote,
    });
    throw new FlowtubeError(402, confirmationMessage(model, quote), {
      code: "CONFIRMATION_REQUIRED",
      requiresConfirmation: true,
      quote,
      model: { id: model.id, name: model.name, type: model.type },
    });
  }

  const { data: assistantMessage, error: messageError } = await supabase.from("messages")
    .insert({
      user_id: userId,
      project_id: project.id,
      conversation_id: conversation.id,
      role: "assistant",
      content: assistantText || fallbackReply(prompt, type, credits),
    })
    .select("*")
    .single();
  if (messageError) throw messageError;

  const { data: generation, error } = await supabase.from("generations")
    .insert({
      user_id: userId,
      project_id: project.id,
      conversation_id: conversation.id,
      message_id: assistantMessage.id,
      type,
      status: "pending",
      model_id: model.id,
      model_label: model.name,
      pricing_model_id: model.id,
      prompt,
      aspect_ratio: aspectRatio,
      duration_seconds: model.pricingUnit === "second" ? Math.round(quote.units) : null,
      progress: 1,
      credits,
      cost_usd: quote.providerCostUsd,
      credit_floor_usd: model.creditFloorUsd,
      retail_credit_usd: model.retailCreditUsd,
      margin_multiplier: model.marginMultiplier,
      revenue_floor_usd: quote.revenueFloorUsd,
      gross_margin_floor_usd: quote.grossMarginFloorUsd,
      requires_confirmation: quote.requiresConfirmation,
      confirmed_at: quote.requiresConfirmation ? new Date().toISOString() : null,
      moderation_status: moderation.decision,
      params: {
        scene: String(body.scene || sceneFromPrompt(prompt)),
        pricing: quote,
        pricing_unit: model.pricingUnit,
        selected_capability: requestedCapability(type, prompt, body),
        imageUrl: body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url || null,
        videoUrl: body.videoUrl || body.video_url || null,
        audioUrl: body.audioUrl || body.audio_url || null,
        referenceUrls: body.referenceUrls || body.reference_urls || [],
        firstFrameUrl: body.firstFrameUrl || body.first_frame_url || null,
        lastFrameUrl: body.lastFrameUrl || body.last_frame_url || null,
        watermark_required: plan.watermarkRequired,
        media_retention_days: plan.mediaRetentionDays,
      },
  })
    .select("*")
    .single();
  if (error) throw error;

  await trackGenerationJob(supabase, generation, "queued", { queued_at: new Date().toISOString() });
  void recordProductEvent(supabase, userId, "generation_requested", {
    generation_id: generation.id,
    project_id: project.id,
    model_id: model.id,
    media_type: type,
    credits,
  });

  const waitUntil = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
  if (waitUntil) waitUntil(startFalGeneration(generation, model));
  else startFalGeneration(generation, model);

  return { generation: mediaFromGeneration(generation), projectId: project.id, conversationId: conversation.id };
}

async function directGenerate(req: Request) {
  const body = await bodyJson(req);
  const result = await createGeneration(req, body);
  return json(result);
}

const MAX_BATCH_SIZE = 50;

function batchCountFromPrompt(prompt: string) {
  const text = stripAccents(prompt.toLowerCase());
  const patterns = [
    /\b(?:lot|serie|batch|pack|rafale)\s+de\s+(\d{1,3})\b/,
    /(?:^|[^\d.:])(\d{1,3})\s*(?:videos?|vidéos?|images?|visuels?|variantes?|variations?|versions?|declinaisons?|déclinaisons?|clips?|ugc|creations?|créations?|miniatures?|affiches?|posts?)\b/,
    /(?:^|\s)x\s?(\d{1,3})(?:\s|$)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const count = parseInt(match[1], 10);
      return count >= 2 ? Math.min(count, MAX_BATCH_SIZE) : 1;
    }
  }
  return 1;
}

function batchLimitForPlan(plan: PlanLimits) {
  const metaLimit = Number((plan.metadata || {}).batch_limit || 0);
  if (metaLimit > 0) return Math.min(metaLimit, MAX_BATCH_SIZE);
  const defaults: Record<string, number> = { free: 2, basic: 8, pro: 16, crew: 20, squad: 30, max: 40, scale: 50, enterprise: 50 };
  return defaults[plan.id] ?? 8;
}

function batchInfoOf(generation: Record<string, unknown>) {
  const params = cleanMetadata(generation.params);
  const batch = cleanMetadata(params.batch);
  return batch.id ? { id: String(batch.id), index: Number(batch.index || 0), total: Number(batch.total || 0) } : null;
}

function concurrencyForType(plan: PlanLimits, type: string) {
  const isVideo = type === "video" || type === "video_edit" || type === "lipsync";
  return Math.max(1, isVideo ? plan.concurrentVideoJobs : plan.concurrentImageJobs);
}

function batchConfirmationMessage(model: PricingModel, quote: PricingQuote, count: number, type: string) {
  const totalCredits = quote.credits * count;
  const label = type === "video" ? "videos" : "creations";
  const plan = buildContentPlan("", count, type, "");
  const formats = [...new Set(plan.map((p) => p.format))];
  const spread = formats.length > 1 ? ` reparties sur ${formats.length} formats (${formats.join(", ")})` : "";
  const renderLabel = model.type === "video" ? "rendu video" : model.type === "image" || model.type === "image_edit" ? "rendu image" : "rendu media";
  return `Lot de ${count} ${label}${spread} : environ ${totalCredits} credits au total (${quote.credits} par ${renderLabel}). Les rendus s'enchaineront automatiquement par vagues selon ton plan. Confirme avec "oui" pour lancer le lot, ou "annule" pour ignorer.`;
}

// Content plan facon "Stage 2": decline un lot en formats varies avec un prompt distinct par item,
// au lieu de N prompts identiques. Detecte le type de campagne (UGC, ads, photos produit) depuis la demande.
type PlanItem = { prompt: string; format: string };
function detectCampaignKind(prompt: string, type: string): "ugc" | "ads" | "product_photo" | "generic" {
  const t = stripAccents(prompt.toLowerCase());
  if (/\bugc\b|temoignage|face ?cam|creator|influenceu|avis client|unboxing|review|test produit/.test(t)) return "ugc";
  if (/\b(pub|pubs|ad|ads|publicit|annonce|meta ads?|tiktok ads?|campagne|creative|hook)\b/.test(t)) return "ads";
  if (/photo ?produit|packshot|product ?photo|photo(?:s)? de produit|packshots|listing|shopify|e-?commerce/.test(t)) return "product_photo";
  if (type === "video") return "ugc";
  return "generic";
}
function buildContentPlan(prompt: string, count: number, type: string, scene = ""): PlanItem[] {
  const base = prompt.trim();
  const kind = detectCampaignKind(base, type);
  const decks: Record<string, { format: string; add: string }[]> = {
    ugc: [
      { format: "street interview", add: "format micro-trottoir spontane, une personne reagit face camera, cadrage vertical, lumiere naturelle" },
      { format: "unboxing", add: "format unboxing, mains qui ouvrent le produit, gros plans, rythme satisfaisant" },
      { format: "product review", add: "format avis produit sincere face camera, hook d'accroche, plans coupes du produit" },
      { format: "entertainment", add: "format divertissant/challenge, energie haute, situation inattendue, tres partageable" },
      { format: "asmr", add: "format ASMR, sons du produit mis en avant, gros plans lents et texture" },
    ],
    ads: [
      { format: "hook sensoriel", add: "ouverture sur une sensation forte (son, texture, gros plan), promesse claire, CTA final" },
      { format: "hook origine", add: "raconte l'origine/la fabrication, plan matiere premiere puis produit fini, storytelling court" },
      { format: "hook probleme-solution", add: "montre le probleme puis le produit comme solution evidente, avant/apres" },
      { format: "preuve sociale", add: "temoignage/reactions, chiffres ou avis, ton rassurant et credible" },
      { format: "hook cadeau/desir", add: "angle desir ou cadeau, mise en scene lifestyle aspirationnelle, fin memorable" },
    ],
    product_photo: [
      { format: "hero fond neutre", add: "packshot studio fond neutre, produit centre, lumiere douce, ombre propre" },
      { format: "lifestyle", add: "mise en situation lifestyle, decor coherent, produit en usage" },
      { format: "macro texture", add: "macro sur la matiere et les details, mise au point serree" },
      { format: "mise a l'echelle", add: "produit en contexte pour montrer la taille et l'usage reel" },
      { format: "flatlay", add: "vue du dessus type flatlay, composition ordonnee avec accessoires" },
    ],
    generic: [
      { format: "variation 1", add: "premiere direction creative" },
      { format: "variation 2", add: "cadrage et lumiere alternatifs" },
      { format: "variation 3", add: "ambiance et palette differentes" },
      { format: "variation 4", add: "angle et composition nouveaux" },
    ],
  };
  const deck = decks[kind];
  const sceneHint = scene ? ` Scene: ${scene}.` : "";
  return Array.from({ length: count }, (_, i) => {
    const slot = deck[i % deck.length];
    const n = Math.floor(i / deck.length) + 1;
    const variant = count > deck.length ? ` (variante ${n})` : "";
    const prompt = base
      ? `${base}. Decline en ${slot.format}${variant}: ${slot.add}.${sceneHint}`
      : `${slot.format}: ${slot.add}.`;
    return { prompt, format: slot.format };
  });
}

async function enforceBatchGuards(
  supabase: ReturnType<typeof adminClient>,
  profile: Record<string, unknown>,
  plan: PlanLimits,
  model: PricingModel,
  quote: PricingQuote,
  count: number,
) {
  if (!plan.allowedMediaTypes.includes(model.type)) {
    throw new FlowtubeError(403, `Le plan ${plan.displayName} ne permet pas encore ce type de generation.`, { code: "MEDIA_TYPE_NOT_ALLOWED" });
  }
  const planLimit = batchLimitForPlan(plan);
  if (count > planLimit) {
    throw new FlowtubeError(403, `Le plan ${plan.displayName} permet des lots de ${planLimit} creations maximum. Reduis le lot ou passe au plan superieur.`, { code: "BATCH_LIMIT" });
  }
  const totalCredits = quote.credits * count;
  if (Number(profile.credits || 0) < totalCredits) {
    throw new FlowtubeError(402, `Solde insuffisant pour ce lot : ${totalCredits} credits requis, ${Number(profile.credits || 0)} disponibles.`, {
      code: "INSUFFICIENT_CREDITS",
      requiredCredits: totalCredits,
      availableCredits: Number(profile.credits || 0),
    });
  }
  if (model.type === "video") {
    const { count: dailyVideos } = await supabase.from("generations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", String(profile.id))
      .eq("type", "video")
      .gte("created_at", dayStartIso())
      .not("status", "in", "(failed,cancelled)");
    if ((dailyVideos || 0) + count > plan.dailyVideoLimit) {
      throw new FlowtubeError(429, `Ce lot depasse le plafond video journalier du plan ${plan.displayName} (${plan.dailyVideoLimit}/jour).`, { code: "DAILY_VIDEO_LIMIT" });
    }
  }
}

async function launchBatchWave(supabase: ReturnType<typeof adminClient>, userId: string, batchId: string) {
  const { data: queued } = await supabase.from("generations")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .is("fal_job_id", null)
    .contains("params", { batch: { id: batchId } })
    .order("created_at", { ascending: true });
  if (!queued || !queued.length) return 0;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) return 0;
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  const catalog = await pricingCatalog(supabase);
  const type = String(queued[0].type || "image");
  const runningType = type === "video" ? "video" : "image";
  const maxConcurrent = concurrencyForType(plan, type);
  const { count: runningJobs } = await supabase.from("generations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", runningType)
    .eq("status", "running");
  const freeSlots = Math.max(0, maxConcurrent - (runningJobs || 0));
  if (!freeSlots) return 0;

  let launched = 0;
  for (const generation of queued.slice(0, freeSlots)) {
    if (Number(profile.credits || 0) < Number(generation.credits || 0)) {
      await supabase.from("generations").update({
        status: "failed",
        error_message: "Credits insuffisants pour poursuivre le lot.",
      }).eq("id", generation.id);
      continue;
    }
    const model = resolveModelFromCatalog(catalog, String(generation.model_id), String(generation.type));
    await startFalGeneration(generation, model);
    launched += 1;
  }
  return launched;
}

async function advanceBatch(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  const batch = batchInfoOf(generation);
  if (!batch) return;
  try {
    await launchBatchWave(supabase, String(generation.user_id), batch.id);
  } catch (_err) {
    // La prochaine vague repartira au prochain poll du lot.
  }
}

async function createGenerationBatch(req: Request, body: Record<string, unknown>, count: number, assistantText?: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);

  const prompt = String(body.prompt || body.message || "");
  const type = requestTypeFromBody(body, prompt);
  const catalog = await pricingCatalog(supabase);
  const model = resolveBestModelFromCatalog(catalog, String(body.modelId || "auto"), type, prompt, body);
  const requestedUnits = requestedUnitsForModel(model, body, prompt, type);
  const quote = quoteFor(model, requestedUnits);
  const aspectRatio = aspectRatioForRequest(body, prompt, type);
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  await enforceRateLimit(req, supabase, `generate.${type}`, userId, GENERATION_RATE_LIMIT);
  let { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""), projectTitleFromPrompt(prompt));
  const { count: previousMessages } = await supabase.from("messages")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project.id)
    .eq("user_id", userId);
  ({ project, conversation } = await renameUntitledProject(supabase, userId, project, conversation, prompt, previousMessages || 0));
  const moderation = await enforcePromptPolicy(supabase, profile, prompt, String(project.id));
  await enforceBatchGuards(supabase, profile, plan, model, quote, count);
  ensureProviderReady(model);

  const batchId = crypto.randomUUID();
  const totalCredits = quote.credits * count;

  const { data: assistantMessage, error: messageError } = await supabase.from("messages")
    .insert({
      user_id: userId,
      project_id: project.id,
      conversation_id: conversation.id,
      role: "assistant",
      content: assistantText || `Lot de ${count} creations lance. Les rendus s'enchainent automatiquement.`,
      metadata: { batch: { id: batchId, total: count, type, model: model.name, credits: totalCredits } },
    })
    .select("*")
    .single();
  if (messageError) throw messageError;

  const contentPlan = buildContentPlan(prompt, count, type, String(body.scene || sceneFromPrompt(prompt)));
  const rows = Array.from({ length: count }, (_, index) => ({
    user_id: userId,
    project_id: project.id,
    conversation_id: conversation.id,
    message_id: assistantMessage.id,
    type,
    status: "pending",
    model_id: model.id,
    model_label: model.name,
    pricing_model_id: model.id,
    prompt: contentPlan[index].prompt,
    aspect_ratio: aspectRatio,
    duration_seconds: model.pricingUnit === "second" ? Math.round(quote.units) : null,
    progress: 1,
    credits: quote.credits,
    cost_usd: quote.providerCostUsd,
    credit_floor_usd: model.creditFloorUsd,
    retail_credit_usd: model.retailCreditUsd,
    margin_multiplier: model.marginMultiplier,
    revenue_floor_usd: quote.revenueFloorUsd,
    gross_margin_floor_usd: quote.grossMarginFloorUsd,
    requires_confirmation: true,
    confirmed_at: new Date().toISOString(),
    moderation_status: moderation.decision,
    params: {
      batch: { id: batchId, index: index + 1, total: count, format: contentPlan[index].format },
      scene: String(body.scene || sceneFromPrompt(prompt)),
      pricing: quote,
      pricing_unit: model.pricingUnit,
      selected_capability: requestedCapability(type, prompt, body),
      imageUrl: body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url || null,
      videoUrl: body.videoUrl || body.video_url || null,
      audioUrl: body.audioUrl || body.audio_url || null,
      referenceUrls: body.referenceUrls || body.reference_urls || [],
      firstFrameUrl: body.firstFrameUrl || body.first_frame_url || null,
      lastFrameUrl: body.lastFrameUrl || body.last_frame_url || null,
      watermark_required: plan.watermarkRequired,
      media_retention_days: plan.mediaRetentionDays,
    },
  }));
  const { data: batchGenerations, error: insertError } = await supabase.from("generations").insert(rows).select("*");
  if (insertError) throw insertError;
  await Promise.all((batchGenerations || []).map((generation) => trackGenerationJob(supabase, generation, "queued", { batch_id: batchId })));
  void recordProductEvent(supabase, userId, "generation_batch_requested", {
    batch_id: batchId,
    project_id: project.id,
    model_id: model.id,
    media_type: type,
    count,
    credits: totalCredits,
  });

  const waitUntil = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil;
  const firstWave = launchBatchWave(supabase, userId, batchId);
  if (waitUntil) waitUntil(firstWave);
  else await firstWave;

  return {
    batch: { id: batchId, total: count, type, model: model.name, credits: totalCredits, messageId: assistantMessage.id },
    projectId: project.id,
    conversationId: conversation.id,
  };
}

async function batchStatus(req: Request, batchId: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const { data: items, error } = await supabase.from("generations")
    .select("*")
    .eq("user_id", userId)
    .contains("params", { batch: { id: batchId } })
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!items || !items.length) return json({ error: { message: "Batch not found" } }, 404);

  // Synchronise quelques rendus en cours (borne pour rester leger), puis relance une vague si besoin.
  const running = items.filter((generation) => generation.status === "running");
  const synced = new Map<string, Record<string, unknown>>();
  for (const generation of running.slice(0, 5)) {
    synced.set(String(generation.id), await syncGeneration(supabase, generation));
  }
  await launchBatchWave(supabase, userId, batchId);

  const { data: fresh } = await supabase.from("generations")
    .select("*")
    .eq("user_id", userId)
    .contains("params", { batch: { id: batchId } })
    .order("created_at", { ascending: true });
  const finalItems = (fresh && fresh.length ? fresh : items).map((generation) => synced.get(String(generation.id)) || generation);
  const completed = finalItems.filter((generation) => generation.status === "completed").length;
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
  const agentModelId = agentModelFromBody(body as Record<string, unknown>);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start: async (controller) => {
      let eventSequence = 0;
      const send = (event: string, payload: unknown) => {
        if (req.signal.aborted) return;
        let nextPayload = payload;
        if (event === "text" && payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).delta === "string") {
          nextPayload = { ...(payload as Record<string, unknown>), delta: cleanAgentDisplayText(String((payload as Record<string, unknown>).delta || "")) };
        }
        eventSequence += 1;
        controller.enqueue(encoder.encode(`id: ${eventSequence}\nevent: ${event}\ndata: ${JSON.stringify(nextPayload)}\n\n`));
      };
      const heartbeat = setInterval(() => send("heartbeat", { at: new Date().toISOString() }), 15000);
      try {
        const supabase = adminClient();
        const userId = await userIdFromRequest(req, supabase);
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
        const autoSkill = autoLearnSkillCandidate(prompt, requestAttachments);
        if (autoSkill) await saveLearnedSkill(supabase, userId, String(project.id), autoSkill.name, autoSkill.triggers, autoSkill.playbook, true);
        const learnedSkills = await loadLearnedSkills(supabase, userId);
        await supabase.from("messages").insert({
          user_id: userId,
          project_id: project.id,
          conversation_id: conversation.id,
          role: "user",
          content: prompt,
          metadata: requestAttachments.length ? { attachments: requestAttachments } : {},
        });
        const saveAssistant = async (content: string) => {
          if (!content || !content.trim()) return;
          await supabase.from("messages").insert({
            user_id: userId,
            project_id: project.id,
            conversation_id: conversation.id,
            role: "assistant",
            content: cleanAgentDisplayText(content).trim(),
          });
        };
        const billAgent = (reason: string, multiplier = 1) =>
          agentBilling({ supabase, userId, send }, reason, multiplier);

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
          const playbook = prompt.trim();
          await saveLearnedSkill(supabase, userId, String(project.id), skillDirective.name, skillDirective.triggers, playbook, false);
          const skillReply = `Skill "${skillDirective.name}" enregistre (declencheurs: ${skillDirective.triggers.join(", ")}). Je l'appliquerai quand le sujet reviendra, ou lance-le avec /${skillDirective.name}.`;
          send("text", { delta: skillReply });
          await saveAssistant(skillReply);
          send("done", projectDonePayload(project, conversation));
          return;
        }

        // Analyse visuelle: breakdown d'une image/pub de reference (attachee, @element, ou derniere creation).
        if (isVisualAnalysisRequest(prompt)) {
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
          send("text", { delta: `Je lis ${researchUrl}...` });
          const brief = await runWebResearch(researchUrl, prompt, agentModelId, billAgent("web_research"));
          send("text", { delta: brief });
          await saveAssistant(brief);
          send("done", projectDonePayload(project, conversation));
          return;
        }
        if (!researchUrl && isTrendResearchRequest(prompt)) {
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
        if (agentLoopEnabled()) {
          const loopCtx: AgentLoopCtx = { req, supabase, userId, project, conversation, profile, plan, body: body as Record<string, unknown>, agentModelId, send };
          const loopMatched = matchLearnedSkill(prompt, learnedSkills);
          const loopContext: ReplyContext = {
            planName: plan.displayName,
            creditsBalance: Number(profile.credits || 0),
            projectTitle: String(project.title || ""),
            memory,
            elements,
            learnedSkill: loopMatched ? `${loopMatched.name}: ${loopMatched.playbook}`.slice(0, 800) : undefined,
            attachments: attachmentContext,
          };
          const reply = await runAgentLoop(loopCtx, prompt, history, loopContext);
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
        const willGenerate = shouldGenerateMedia(prompt, mode);
        const batchCount = willGenerate ? batchCountFromPrompt(prompt) : 1;

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
        const { data: recentGens } = await supabase.from("generations")
          .select("type,prompt,status")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(3);
        const replyContext: ReplyContext = {
          planName: plan.displayName,
          creditsBalance: Number(profile.credits || 0),
          projectTitle: String(project.title || ""),
          recentCreations: (recentGens || []).map((generation) =>
            `${generation.type} (${generation.status}): ${String(generation.prompt || "").slice(0, 110)}`),
          willGenerate,
          memory,
          elements,
          attachments: attachmentContext,
          learnedSkill: (() => { const s = matchLearnedSkill(prompt, learnedSkills); return s ? `${s.name}: ${s.playbook}`.slice(0, 800) : undefined; })(),
        };
        const reply = await anthropicReply(
          prompt,
          type,
          credits,
          history,
          (delta) => send("text", { delta }),
          replyContext,
          agentModelId,
          billAgent(willGenerate ? "agent_creation_brief" : "agent_chat_reply"),
        );
        if (!willGenerate) await saveAssistant(reply);

        if (willGenerate) {
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
        if (err instanceof FlowtubeError) send("error", { message: publicErrorMessage(err.message), ...publicErrorPayload(err) });
        else send("error", { message: publicErrorMessage(err instanceof Error ? err.message : "Chat failed") });
      } finally {
        clearInterval(heartbeat);
        controller.close();
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
      const response = await fetch(resultUrl);
      if (!response.ok) throw new Error(`download ${response.status}`);
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      const buffer = await response.arrayBuffer();
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
  const body = await bodyJson(req);
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);
  await enforceRateLimit(req, supabase, "upload", userId, 30);
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  const contentType = String(body.contentType || body.content_type || "application/octet-stream").toLowerCase();
  if (!uploadAllowedContentType(contentType)) {
    throw new FlowtubeError(415, "Format de fichier non pris en charge.", { code: "UNSUPPORTED_UPLOAD_TYPE" });
  }
  const bytes = bytesFromDataUrl(body.data || body.base64);
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
  if (!generation?.debited_at || generation.failure_refunded_at) return;
  const userId = String(generation.user_id);
  const credits = Number(generation.credits || 0);
  if (!credits) return;
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).single();
  const nextCredits = Number(profile?.credits || 0) + credits;
  await supabase.from("profiles").update({ credits: nextCredits }).eq("id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    generation_id: generation.id,
    amount: credits,
    reason: "generation_refunded",
    balance_after: nextCredits,
    metadata: { failed_status: generation.status, provider_cost_usd: generation.cost_usd || 0 },
  });
  await supabase.from("pricing_audit_logs").insert({
    user_id: userId,
    generation_id: generation.id,
    pricing_model_id: generation.pricing_model_id || generation.model_id,
    credits_charged: credits,
    credit_floor_usd: generation.credit_floor_usd || CREDIT_FLOOR_USD,
    retail_credit_usd: generation.retail_credit_usd || RETAIL_CREDIT_USD,
    provider_cost_usd: generation.cost_usd || 0,
    status: "refunded",
    metadata: { reason: "generation_failed" },
  });
  await supabase.from("generations").update({
    failure_refunded_at: new Date().toISOString(),
    refunded_at: new Date().toISOString(),
  }).eq("id", generation.id);
}

async function debitCredits(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  if (generation.debited_at || generation.status !== "completed") return;
  const userId = String(generation.user_id);
  const credits = Number(generation.credits || 0);
  const debitAt = new Date().toISOString();
  const { data: debitClaim, error: debitClaimError } = await supabase.from("generations")
    .update({ debited_at: debitAt })
    .eq("id", generation.id)
    .eq("status", "completed")
    .is("debited_at", null)
    .select("id")
    .maybeSingle();
  if (debitClaimError) throw debitClaimError;
  if (!debitClaim?.id) return;
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).single();
  const nextCredits = Math.max(0, Number(profile?.credits || 0) - credits);
  const creditFloorUsd = Number(generation.credit_floor_usd || CREDIT_FLOOR_USD);
  const retailCreditUsd = Number(generation.retail_credit_usd || RETAIL_CREDIT_USD);
  const providerCostUsd = Number(generation.cost_usd || 0);
  const revenueFloorUsd = Number((credits * creditFloorUsd).toFixed(4));
  const grossMarginFloorUsd = Number((revenueFloorUsd - providerCostUsd).toFixed(4));
  const grossMarginFloorRatio = ratioFromAmounts(revenueFloorUsd, providerCostUsd);
  await supabase.from("profiles").update({ credits: nextCredits }).eq("id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    generation_id: generation.id,
    amount: -credits,
    reason: "generation_completed",
    balance_after: nextCredits,
    metadata: {
      pricing_model_id: generation.pricing_model_id || generation.model_id,
      credit_floor_usd: creditFloorUsd,
      retail_credit_usd: retailCreditUsd,
      provider_cost_usd: providerCostUsd,
      revenue_floor_usd: revenueFloorUsd,
      gross_margin_floor_usd: grossMarginFloorUsd,
      gross_margin_floor_ratio: grossMarginFloorRatio,
    },
  });
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
  if (generation.status === "completed" || generation.status === "failed") return generation;
  // Item de lot en file d'attente : il attend un slot, la vague suivante le lancera.
  if (generation.status === "pending" && !generation.fal_job_id && batchInfoOf(generation)) return generation;
  const key = Deno.env.get("FAL_KEY");
  if (key && generation.fal_job_id) {
    try {
      fal.config({ credentials: key });
      const catalog = await pricingCatalog(supabase);
      const model = resolveModelFromCatalog(catalog, String(generation.model_id), String(generation.type));
      if (!model.endpoint) throw new Error("No fal.ai endpoint configured for model");
      const status = await fal.queue.status(String(model.endpoint), { requestId: String(generation.fal_job_id), logs: true });
      const statusText = String((status as Record<string, unknown>).status || "").toUpperCase();
      if (statusText === "COMPLETED") {
        const result = await fal.queue.result(String(model.endpoint), { requestId: String(generation.fal_job_id) });
        const resultUrl = extractUrl((result as Record<string, unknown>).data || result);
        const { data } = await supabase.from("generations").update({
          status: "completed",
          progress: 100,
          result_url: resultUrl,
          provider_payload: result,
          completed_at: new Date().toISOString(),
        }).eq("id", generation.id).select("*").single();
        await debitCredits(supabase, data);
        await trackGenerationJob(supabase, data, "completed", { reconciled_at: new Date().toISOString() });
        await advanceBatch(supabase, data);
        return data;
      }
      const progress = Math.min(95, Math.max(Number(generation.progress || 5), Number(generation.progress || 5) + 8));
      const { data } = await supabase.from("generations").update({ status: "running", progress, provider_payload: status }).eq("id", generation.id).select("*").single();
      await trackGenerationJob(supabase, data, "running", { reconciled_at: new Date().toISOString() });
      return data;
    } catch (err) {
      const { data } = await supabase.from("generations").update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "fal.ai status failed",
      }).eq("id", generation.id).select("*").single();
      await refundFailedGeneration(supabase, data);
      await trackGenerationJob(supabase, data, "failed", { error: data?.error_message || "provider_status_failed" });
      await advanceBatch(supabase, data);
      return data;
    }
  }

  const createdAt = new Date(String(generation.created_at)).getTime();
  if (Deno.env.get("FAL_KEY") && Date.now() - createdAt < 120000) return generation;

  const { data } = await supabase.from("generations").update({
    status: "failed",
    error_message: Deno.env.get("FAL_KEY") ? "fal.ai job id missing" : "fal.ai is not configured",
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
  const { data: profile } = await supabase.from("profiles").select("credits,credits_max").eq("id", userId).single();
  return json({ generation: mediaFromGeneration(synced), credits: profile?.credits, creditsMax: profile?.credits_max });
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
  if (error) console.error("product event tracking failed", error.message);
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

async function integrationsRoute(req: Request) {
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  const providers = ["google_drive", "whatsapp_business", "meta_ads", "tiktok", "slack", "notion", "webhook"];
  const list = async () => {
    const { data, error } = await supabase.from("integration_connections").select("id,provider,status,account_label,configuration,last_error,connected_at,updated_at").eq("user_id", userId).order("provider");
    if (error) throw error;
    const connected = new Map((data || []).map((item) => [item.provider, item]));
    return providers.map((provider) => connected.get(provider) || { provider, status: "disconnected", account_label: null, configuration: {} });
  };
  if (req.method === "GET") return json({ connections: await list() });
  const body = await bodyJson(req);
  const provider = String(body.provider || "");
  if (!providers.includes(provider)) throw new FlowtubeError(400, "Connecteur invalide.", { code: "INVALID_CONNECTOR" });
  const action = String(body.action || "configure");
  if (action === "disconnect") {
    const { error } = await supabase.from("integration_connections").upsert({ user_id: userId, provider, status: "disconnected", account_label: null, credentials_ref: null, configuration: {}, last_error: null, connected_at: null }, { onConflict: "user_id,provider" });
    if (error) throw error;
    await recordProductEvent(supabase, userId, "connector_disconnected", { provider });
    return json({ connections: await list() });
  }
  const configuration = safeStructuredContent(body.configuration || {}, 12_000);
  const { error } = await supabase.from("integration_connections").upsert({
    user_id: userId,
    provider,
    status: "pending",
    account_label: compactText(body.accountLabel || "", 120) || null,
    configuration,
    last_error: null,
  }, { onConflict: "user_id,provider" });
  if (error) throw error;
  await recordProductEvent(supabase, userId, "connector_configuration_requested", { provider });
  return json({ connections: await list(), authorizationRequired: true });
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
  return json({ ok: true, service: "huggyflow", now: new Date().toISOString() });
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
      return json({ url: existing.checkout_url, sessionId: existing.provider_session_id, provider: "moneyfusion", token: existing.provider_payment_token, reused: true });
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
    amountUsd = interval === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd;
    article = `${APP_NAME} ${plan.displayName} ${interval}`;
    metadata.plan_id = plan.id;
  }

  const reference = crypto.randomUUID();
  const amountXof = plan
    ? planAmountXof(plan, interval === "annual" ? "annual" : "monthly")
    : moneyFusionAmount(amountUsd);
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
    billing_interval: type === "credits" ? null : interval,
    status: "open",
    amount_usd: amountUsd,
    amount_xof: amountXof,
    currency: DEFAULT_BILLING_CURRENCY.toLowerCase(),
    checkout_url: session.paymentUrl,
    pricing_version: pricingVersion,
    pricing_snapshot: plan ? planPublic(plan) : { pack },
    metadata: { moneyfusion: session.data, payload, amount_xof: amountXof, usd_xof_rate: DEFAULT_USD_XOF_RATE, pricing_version: pricingVersion, plan: plan ? planPublic(plan) : null, pack },
    provider_payload: session.data,
  });

  return json({ url: session.paymentUrl, sessionId: reference, provider: "moneyfusion", token: providerToken });
}

async function createCheckout(req: Request) {
  const body = await bodyJson(req);
  const supabase = adminClient();
  const userId = await authenticatedUserIdFromRequest(req, supabase);
  await enforceRateLimit(req, supabase, "billing.checkout", userId, 12);
  const profile = await ensureProfile(supabase, userId);
  const interval = String(body.interval || "monthly") === "annual" ? "annual" : "monthly";
  const type = String(body.type || (body.creditPackId ? "credits" : "subscription"));
  const successUrl = String(body.successUrl || `${APP_BASE_URL}/?checkout=success`);
  const cancelUrl = String(body.cancelUrl || `${APP_BASE_URL}/?checkout=cancelled`);
  const provider = String(
    body.provider || Deno.env.get("BILLING_PROVIDER") || (moneyFusionConfigured() ? "moneyfusion" : "stripe"),
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
  const { data: transactions } = await supabase.from("credit_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  const { data: subscription } = await supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data: invoices } = await supabase.from("invoices").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  return json({
    user: { id: profile.id, plan: profile.plan, billingStatus: profile.billing_status, currentPeriodEnd: profile.current_period_end },
    credits: profile.credits,
    creditsMax: profile.credits_max,
    currency: DEFAULT_BILLING_CURRENCY,
    usdXofRate: DEFAULT_USD_XOF_RATE,
    moneyFusionConfigured: moneyFusionConfigured(),
    paymentPhoneRequired: true,
    subscription,
    invoices: invoices || [],
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
  }

  const { data: members } = await supabase.from("team_members").select("*").eq("owner_id", userId).order("created_at", { ascending: true });
  const { data: invites } = await supabase.from("team_invites").select("*").eq("owner_id", userId).eq("status", "pending").order("created_at", { ascending: false });
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
      await supabase.from("api_keys").insert({
        user_id: userId,
        name,
        key_hash: keyHash,
        key_prefix: `${createdKey.slice(0, 10)}...`,
        scopes: ["chat", "generate"],
      });
    }
    if (action === "revoke") {
      const keyId = String(body.keyId || body.id || "");
      if (keyId) await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", keyId).eq("user_id", userId);
    }
  }

  const { data: keys } = await supabase.from("api_keys")
    .select("id,name,key_prefix,scopes,last_used_at,revoked_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return json({
    createdKey: createdKey || undefined,
    keys: (keys || []).map((key) => ({
      id: key.id,
      name: key.name,
      masked: key.key_prefix,
      scopes: key.scopes || [],
      createdAt: key.created_at,
      lastUsedAt: key.last_used_at,
      revoked: Boolean(key.revoked_at),
    })),
  });
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
    const payoutEmail = String(body.payoutEmail || body.email || "").trim().toLowerCase();
    if (payoutEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payoutEmail)) throw new FlowtubeError(400, "Entre un e-mail de paiement valide.", { code: "INVALID_PAYOUT_EMAIL" });
    await supabase.from("affiliate_accounts").upsert({
      user_id: userId,
      code: affiliateCode(profile),
      payout_email: payoutEmail || profile.billing_email || profile.email || null,
      status: "active",
    }, { onConflict: "user_id" });
  }

  const { data: account } = await supabase.from("affiliate_accounts").upsert({
    user_id: userId,
    code: affiliateCode(profile),
    payout_email: profile.billing_email || profile.email || null,
    status: "active",
  }, { onConflict: "user_id" }).select("*").single();
  const { data: referrals } = await supabase.from("affiliate_referrals").select("*").eq("affiliate_user_id", userId).order("created_at", { ascending: false });
  const rows = referrals || [];
  const active = rows.filter((row) => ["active", "paid"].includes(String(row.status))).length;
  const earnings = rows.reduce((sum, row) => sum + Number(row.amount_usd || 0), 0);
  return json({
    account,
    link: `${APP_BASE_URL}/?ref=${account.code}`,
    stats: {
      clicks: Number((account.metadata || {}).clicks || 0),
      activeSubscribers: active,
      earningsUsd: earnings,
    },
    referrals: rows.map((row) => ({
      id: row.id,
      name: row.email || "Invitation",
      status: row.status,
      amountUsd: Number(row.amount_usd || 0),
      createdAt: row.created_at,
    })),
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
  const plans = await publicPricingPlans(supabase);
  const { data: creditPacks } = await supabase.from("credit_packs").select("*").eq("active", true).order("price_usd", { ascending: true });
  return json({
    plans,
    creditPacks: creditPacks || [],
    billing: {
      stripeConfigured: Boolean(stripeSecret()),
      moneyFusionConfigured: moneyFusionConfigured(),
      moneyFusionCallbackUrl: moneyFusionCallbackUrl(),
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

async function grantPlanCredits(supabase: ReturnType<typeof adminClient>, userId: string, planId: string, interval: string, subscriptionId?: string, periodEnd?: string) {
  const plan = await resolvePlan(supabase, planId);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const nextCredits = Number(profile?.credits || 0) + plan.includedCredits;
  await supabase.from("profiles").update({
    plan: plan.id,
    billing_status: "active",
    credits: nextCredits,
    credits_max: Math.max(Number(profile?.credits_max || 0), plan.includedCredits),
    current_period_end: periodEnd || null,
  }).eq("id", userId);
  await supabase.from("subscriptions").upsert({
    user_id: userId,
    plan_id: plan.id,
    stripe_subscription_id: subscriptionId || null,
    status: "active",
    billing_interval: interval,
    current_period_end: periodEnd || null,
    metadata: { source: "stripe_webhook" },
  }, { onConflict: "stripe_subscription_id" });
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: plan.includedCredits,
    reason: "subscription_renewal",
    balance_after: nextCredits,
    metadata: { plan_id: plan.id, interval, subscription_id: subscriptionId || null },
  });
  if (profile?.email) await sendTransactionalEmail(supabase, userId, String(profile.email), "subscription_active", "Ton plan Huggyflow est actif", `<p>Ton plan ${plan.displayName} est actif avec ${plan.includedCredits} credits.</p>`, { plan_id: plan.id });
}

async function grantCreditPack(supabase: ReturnType<typeof adminClient>, userId: string, packId: string) {
  const { data: pack } = await supabase.from("credit_packs").select("*").eq("id", packId).maybeSingle();
  if (!pack) return;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  const nextCredits = Number(profile?.credits || 0) + Number(pack.credits || 0);
  await supabase.from("profiles").update({ credits: nextCredits, credits_max: Math.max(Number(profile?.credits_max || 0), nextCredits) }).eq("id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: Number(pack.credits || 0),
    reason: "credit_pack_purchase",
    balance_after: nextCredits,
    metadata: { pack_id: pack.id, price_usd: pack.price_usd },
  });
  if (profile?.email) await sendTransactionalEmail(supabase, userId, String(profile.email), "credit_pack", "Tes credits Huggyflow sont disponibles", `<p>${pack.credits} credits ont ete ajoutes a ton compte.</p>`, { pack_id: pack.id });
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
    await supabase.from("billing_checkout_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      metadata: object,
    }).eq("stripe_session_id", object.id);
    if (metadata.type === "credits" && metadata.credit_pack_id && userId) {
      await grantCreditPack(supabase, String(userId), String(metadata.credit_pack_id));
    } else if (metadata.plan_id && userId) {
      await grantPlanCredits(supabase, String(userId), String(metadata.plan_id), String(metadata.interval || "monthly"), object.subscription || undefined);
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
        if (claimed.credit_pack_id) await grantCreditPack(supabase, userId, String(claimed.credit_pack_id));
        else if (claimed.plan_id) await grantPlanCredits(supabase, userId, String(claimed.plan_id), String(claimed.billing_interval || "monthly"), `moneyfusion:${eventId}`);
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
  const expected = Deno.env.get("FAL_WEBHOOK_SECRET") || "";
  if (expected && req.headers.get("x-flowtube-provider-secret") !== expected && req.headers.get("x-fal-webhook-secret") !== expected) {
    return unauthorized();
  }
  const body = await bodyJson(req);
  const supabase = adminClient();
  const requestId = String(body.request_id || body.requestId || body.fal_job_id || "");
  if (!requestId) throw new FlowtubeError(400, "Missing provider request id.", { code: "MISSING_PROVIDER_REQUEST_ID" });
  const { data: generation } = await supabase.from("generations").select("*").eq("fal_job_id", requestId).maybeSingle();
  if (!generation) return json({ ok: true, ignored: true });
  const status = String(body.status || body.state || "").toUpperCase();
  if (status === "FAILED" || status === "ERROR") {
    const { data } = await supabase.from("generations").update({
      status: "failed",
      error_message: String(body.error || body.message || "Provider failed"),
      provider_payload: body,
    }).eq("id", generation.id).select("*").single();
    await refundFailedGeneration(supabase, data);
    await trackGenerationJob(supabase, data, "failed", { error: data?.error_message || "provider_webhook_failed" });
    await advanceBatch(supabase, data);
    return json({ ok: true });
  }
  if (status === "COMPLETED" || body.output || body.result) {
    const resultUrl = extractUrl(body.output || body.result || body);
    const { data } = await supabase.from("generations").update({
      status: "completed",
      progress: 100,
      result_url: resultUrl,
      provider_payload: body,
      completed_at: new Date().toISOString(),
    }).eq("id", generation.id).select("*").single();
    await debitCredits(supabase, data);
    await trackGenerationJob(supabase, data, "completed", { completed_via: "webhook" });
    await advanceBatch(supabase, data);
    return json({ ok: true });
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
    if (first === "generations" && route[1] === "batch" && route[2] && req.method === "GET") return await batchStatus(req, route[2]);
    if (first === "generations" && route[1] && req.method === "GET") return await generationStatus(req, route[1]);
    if (first === "projects" && req.method === "POST") return await createProjectRoute(req);
    if (first === "projects" && route[1] && (req.method === "PATCH" || req.method === "DELETE")) return await projectRoute(req, route[1]);
    if (first === "profile" && (req.method === "GET" || req.method === "POST")) return await profileRoute(req);
    if (first === "account" && route[1] === "export" && req.method === "GET") return await accountExportRoute(req);
    if (first === "account" && route[1] === "delete" && req.method === "POST") return await deleteAccountRoute(req);
    if (first === "brands" && (req.method === "GET" || req.method === "POST")) return await brandKitsRoute(req);
    if (first === "templates" && (req.method === "GET" || req.method === "POST")) return await templatesRoute(req);
    if (first === "exports" && req.method === "POST") return await exportPackageRoute(req);
    if (first === "integrations" && (req.method === "GET" || req.method === "POST")) return await integrationsRoute(req);
    if (first === "feedback" && (req.method === "GET" || req.method === "POST")) return await feedbackRoute(req);
    if (first === "events" && req.method === "POST") return await productEventRoute(req);
    if (first === "team" && (req.method === "GET" || req.method === "POST")) return await teamRoute(req);
    if (((first === "api" && route[1] === "keys") || first === "keys") && (req.method === "GET" || req.method === "POST")) return await apiKeysRoute(req);
    if (first === "affiliate" && (req.method === "GET" || req.method === "POST")) return await affiliateRoute(req);
    if (first === "stats" && req.method === "GET") return await statsRoute(req);
    if (first === "pricing" && req.method === "GET") return await pricingRoute();
    if (first === "auth" && route[1]) return await authRoute(req, route[1]);
    if (first === "billing" && route[1] === "checkout" && req.method === "POST") return await createCheckout(req);
    if (first === "billing" && route[1] === "status" && req.method === "GET") return await billingStatus(req);
    if (first === "billing" && route[1] === "webhook" && req.method === "POST") return await stripeWebhook(req);
    if (first === "billing" && route[1] === "moneyfusion-callback" && (req.method === "POST" || req.method === "GET")) return await moneyFusionCallback(req);
    if (first === "legal" && route[1] === "consent" && req.method === "POST") return await consentRoute(req);
    if (first === "provider" && route[1] === "fal-webhook" && req.method === "POST") return await falWebhook(req);
    if (first === "admin" && route[1]) return await adminRoute(req, route[1]);
    return json({ error: { message: "Not found" } }, 404);
  } catch (err) {
    if (err instanceof FlowtubeError) return json(publicErrorPayload(err), err.status);
    return json({ error: { message: publicErrorMessage(err instanceof Error ? err.message : "Unexpected Edge error") } }, 500);
  }
});
