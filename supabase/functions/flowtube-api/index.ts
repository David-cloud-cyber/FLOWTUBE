import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { fal } from "npm:@fal-ai/client@1.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://fuvrxobxjcqyevsjsdfd.supabase.co";
const APP_NAME = "Huggyflow";
const DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";
const APP_BASE_URL = (Deno.env.get("APP_BASE_URL") || "https://www.huggyflow.fun").replace(/\/$/, "");
const MEDIA_BUCKET = Deno.env.get("FLOWTUBE_MEDIA_BUCKET") || "flowtube-media";
const CREDIT_FLOOR_USD = 0.008;
const RETAIL_CREDIT_USD = 0.013;
const MEDIA_MARGIN_MULTIPLIER = 3.5;
const EXPENSIVE_CREDIT_THRESHOLD = 200;
const RATE_LIMIT_WINDOW_SECONDS = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_WINDOW_SECONDS") || 60);
const DEFAULT_RATE_LIMIT = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_DEFAULT") || 80);
const GENERATION_RATE_LIMIT = Number(Deno.env.get("FLOWTUBE_RATE_LIMIT_GENERATION") || 20);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flowtube-secret, x-huggyflow-secret, x-flowtube-admin-secret, x-huggyflow-admin-secret, stripe-signature, x-moneyfusion-secret, x-moneyfusion-signature, x-flowtube-provider-secret, x-fal-webhook-secret",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

type PricingModel = {
  id: string;
  name: string;
  type: string;
  endpoint?: string;
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
  requiresConfirmation: boolean;
};

type PlanLimits = {
  id: string;
  displayName: string;
  includedCredits: number;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
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
  "fal-ai/nano-banana-2": { id: "nano2", label: "Nano Banana 2", costPerUnitUsd: 0.08, qualityTier: "premium" },
  "fal-ai/nano-banana-2/edit": { id: "nano2-edit", label: "Nano Banana 2 Edit", costPerUnitUsd: 0.08, qualityTier: "premium" },
  "fal-ai/flux/schnell": { id: "flux", label: "Flux Schnell", costPerUnitUsd: 0.04, qualityTier: "standard" },
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": { id: "seedream-lite", label: "Seedream 5.0 Lite", costPerUnitUsd: 0.035, qualityTier: "economy" },
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": { id: "kling", label: "Kling 2.5 Turbo Pro", costPerUnitUsd: 0.12, qualityTier: "premium", maximumUnits: 15 },
  "fal-ai/bytedance/seedance/v1/lite/text-to-video": { id: "seedance", label: "Seedance 1.0 Lite", costPerUnitUsd: 0.08, qualityTier: "standard", maximumUnits: 15 },
  "fal-ai/veo3": { id: "veoq", label: "Veo 3.1 Quality", costPerUnitUsd: 0.2, qualityTier: "premium", maximumUnits: 8 },
  "fal-ai/veo3/fast": { id: "veol", label: "Veo 3.1 Lite", costPerUnitUsd: 0.1, qualityTier: "standard", maximumUnits: 8 },
  "openai/gpt-image-2": { id: "gpt-image-2", label: "GPT Image 2", costPerUnitUsd: 0.08, qualityTier: "premium" },
  "openai/gpt-image-2/edit": { id: "gpt-image-2-edit", label: "GPT Image 2 Edit", costPerUnitUsd: 0.08, qualityTier: "premium" },
  "fal-ai/gemini-3.1-flash-image-preview": { id: "gemini-flash-image", label: "Gemini 3.1 Flash Image", costPerUnitUsd: 0.04, qualityTier: "standard" },
  "fal-ai/gemini-3.1-flash-image-preview/edit": { id: "gemini-flash-image-edit", label: "Gemini 3.1 Flash Image Edit", costPerUnitUsd: 0.04, qualityTier: "standard" },
  "fal-ai/minimax/speech-2.8-hd": { id: "minimax-tts", label: "MiniMax Speech 2.8 HD", costPerUnitUsd: 0.1, pricingUnit: "thousand_chars", maximumUnits: 20, qualityTier: "premium" },
  "fal-ai/minimax/speech-2.8-turbo": { id: "minimax-tts-turbo", label: "MiniMax Speech 2.8 Turbo", costPerUnitUsd: 0.05, pricingUnit: "thousand_chars", maximumUnits: 20, qualityTier: "standard" },
  "fal-ai/minimax/voice-clone": { id: "minimax-voice-clone", label: "MiniMax Voice Clone", costPerUnitUsd: 1.5, qualityTier: "premium", maximumUnits: 1 },
  "fal-ai/gemini-3.1-flash-tts": { id: "gemini-flash-tts", label: "Gemini 3.1 Flash TTS", costPerUnitUsd: 0.04, pricingUnit: "thousand_chars", maximumUnits: 20, qualityTier: "standard" },
  "fal-ai/lyria3/pro": { id: "lyria3-pro", label: "Lyria 3 Pro", costPerUnitUsd: 0.18, pricingUnit: "second", defaultUnits: 30, minimumUnits: 10, maximumUnits: 120, qualityTier: "premium" },
  "sonilo/v1.1/text-to-music": { id: "sonilo-music", label: "Sonilo 1.1 Music", costPerUnitUsd: 0.08, pricingUnit: "second", defaultUnits: 30, minimumUnits: 10, maximumUnits: 120, qualityTier: "standard" },
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

function pricingUnitForEndpoint(type: string, caps: string[]) {
  if (type === "video" || type === "video_edit" || type === "lipsync" || caps.includes("music")) return "second";
  if (type === "audio" && (caps.includes("tts") || caps.includes("dubbing") || caps.includes("speech-to-text"))) return "thousand_chars";
  return "unit";
}

function costForEndpoint(endpoint: string, type: string, caps: string[]) {
  const e = endpoint.toLowerCase();
  if (e.includes("4k")) return 0.35;
  if (e.includes("veo3.1") || e.includes("veo3")) return e.includes("lite") || e.includes("fast") ? 0.1 : 0.2;
  if (e.includes("kling-video/v3/pro")) return 0.18;
  if (e.includes("kling-video/v3/standard")) return 0.12;
  if (e.includes("seedance-2.0/mini")) return 0.06;
  if (e.includes("seedance-2.0/fast")) return 0.08;
  if (e.includes("seedance-2.0")) return 0.12;
  if (e.includes("ray/v3.2")) return 0.18;
  if (e.includes("grok-imagine-video")) return 0.18;
  if (e.includes("happy-horse") || e.includes("pixverse")) return 0.08;
  if (e.includes("avatar") || e.includes("heygen") || e.includes("omnihuman")) return 0.14;
  if (type === "video" || type === "video_edit" || type === "lipsync") return 0.1;
  if (e.includes("voice-clone") || e.includes("digital-twin")) return 1.5;
  if (caps.includes("music")) return 0.08;
  if (type === "audio") return 0.05;
  if (e.includes("gpt-image-2") || e.includes("nano-banana-pro")) return 0.08;
  if (e.includes("nano-banana-2")) return 0.08;
  if (e.includes("flux-2-pro")) return 0.06;
  if (e.includes("flux/dev")) return 0.04;
  if (e.includes("flux/schnell")) return 0.04;
  if (e.includes("seedream")) return 0.035;
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
    marginMultiplier: override.marginMultiplier || MEDIA_MARGIN_MULTIPLIER,
    requiresConfirmation: override.requiresConfirmation ?? (type !== "image" && type !== "image_edit" || premium || cost >= 0.08),
    premium,
    metadata: {
      provider: "fal.ai",
      endpoint,
      capabilities: caps,
      input_profile: override.inputProfile || inputProfileForCapabilities(caps),
      quality_tier: qualityTier,
      family: override.family || endpoint.split("/")[0],
      fal_only: true,
      cost_estimate: true,
      ...(override.metadata || {}),
    },
  };
}

const modelRegistry: PricingModel[] = FAL_ENDPOINTS.map((endpoint) => falModel(endpoint, FAL_ENDPOINT_OVERRIDES[endpoint]));

const fallbackPlans: Record<string, PlanLimits> = {
  free: { id: "free", displayName: "Free", includedCredits: 100, monthlyPriceUsd: 0, annualPriceUsd: 0, monthlyMessageLimit: 60, dailyMessageLimit: 10, dailyVideoLimit: 0, concurrentImageJobs: 1, concurrentVideoJobs: 0, allowedMediaTypes: ["image"], watermarkRequired: true, mediaRetentionDays: 7, storageGb: 1, maxUploadMb: 25, seatLimit: 1, supportLevel: "community", priorityQueue: false, metadata: { checkout: false } },
  basic: { id: "basic", displayName: "Basic", includedCredits: 1000, monthlyPriceUsd: 15, annualPriceUsd: 144, monthlyMessageLimit: 300, dailyMessageLimit: 60, dailyVideoLimit: 2, concurrentImageJobs: 2, concurrentVideoJobs: 1, allowedMediaTypes: ["image", "video"], watermarkRequired: false, mediaRetentionDays: 30, storageGb: 10, maxUploadMb: 100, seatLimit: 1, supportLevel: "standard", priorityQueue: false, metadata: { alias: "starter", checkout: true } },
  starter: { id: "starter", displayName: "Starter", includedCredits: 1000, monthlyPriceUsd: 15, annualPriceUsd: 144, monthlyMessageLimit: 300, dailyMessageLimit: 60, dailyVideoLimit: 2, concurrentImageJobs: 2, concurrentVideoJobs: 1, allowedMediaTypes: ["image", "video"], watermarkRequired: false, mediaRetentionDays: 30, storageGb: 10, maxUploadMb: 100, seatLimit: 1, supportLevel: "standard", priorityQueue: false, metadata: { canonical: "basic", checkout: true } },
  pro: { id: "pro", displayName: "Pro", includedCredits: 4500, monthlyPriceUsd: 49, annualPriceUsd: 468, monthlyMessageLimit: 1500, dailyMessageLimit: 150, dailyVideoLimit: 8, concurrentImageJobs: 4, concurrentVideoJobs: 2, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit"], watermarkRequired: false, mediaRetentionDays: 90, storageGb: 100, maxUploadMb: 250, seatLimit: 3, supportLevel: "priority", priorityQueue: false, metadata: { checkout: true } },
  max: { id: "max", displayName: "Max", includedCredits: 12000, monthlyPriceUsd: 129, annualPriceUsd: 1188, monthlyMessageLimit: 4000, dailyMessageLimit: 300, dailyVideoLimit: 20, concurrentImageJobs: 8, concurrentVideoJobs: 4, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"], watermarkRequired: false, mediaRetentionDays: 180, storageGb: 500, maxUploadMb: 500, seatLimit: 10, supportLevel: "priority", priorityQueue: true, metadata: { alias: "studio", checkout: true } },
  scale: { id: "scale", displayName: "Scale", includedCredits: 28000, monthlyPriceUsd: 249, annualPriceUsd: 2388, monthlyMessageLimit: 10000, dailyMessageLimit: 650, dailyVideoLimit: 55, concurrentImageJobs: 14, concurrentVideoJobs: 8, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"], watermarkRequired: false, mediaRetentionDays: 365, storageGb: 1500, maxUploadMb: 1000, seatLimit: 25, supportLevel: "priority", priorityQueue: true, metadata: { checkout: true, business: true, audience: "Agences et equipes en volume" } },
  enterprise: { id: "enterprise", displayName: "Enterprise", includedCredits: 65000, monthlyPriceUsd: 499, annualPriceUsd: 4788, monthlyMessageLimit: 30000, dailyMessageLimit: 1500, dailyVideoLimit: 140, concurrentImageJobs: 30, concurrentVideoJobs: 16, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"], watermarkRequired: false, mediaRetentionDays: 730, storageGb: 5000, maxUploadMb: 2000, seatLimit: 75, supportLevel: "dedicated", priorityQueue: true, metadata: { checkout: true, business: true, audience: "Production intensive et organisations", dedicated_support: true } },
  studio: { id: "studio", displayName: "Studio", includedCredits: 12000, monthlyPriceUsd: 129, annualPriceUsd: 1188, monthlyMessageLimit: 4000, dailyMessageLimit: 300, dailyVideoLimit: 20, concurrentImageJobs: 8, concurrentVideoJobs: 4, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"], watermarkRequired: false, mediaRetentionDays: 180, storageGb: 500, maxUploadMb: 500, seatLimit: 10, supportLevel: "priority", priorityQueue: true, metadata: { canonical: "max", checkout: true } },
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
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user?.id) return data.user.id;
  }
  return null;
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
  return {
    id: String(row.id),
    name: String(row.label || row.name || row.id),
    type: String(row.media_type || row.type || "image"),
    endpoint: row.fal_endpoint ? String(row.fal_endpoint) : undefined,
    pricingUnit: String(row.pricing_unit || "unit") as PricingModel["pricingUnit"],
    costPerUnitUsd: Number(row.cost_per_unit_usd || row.costUsd || 0.04),
    defaultUnits: Number(row.default_units || row.duration || 1),
    minimumUnits: Number(row.minimum_units || 1),
    maximumUnits: row.maximum_units ? Number(row.maximum_units) : undefined,
    creditFloorUsd: Number(row.credit_floor_usd || CREDIT_FLOOR_USD),
    retailCreditUsd: Number(row.retail_credit_usd || RETAIL_CREDIT_USD),
    marginMultiplier: Number(row.margin_multiplier || MEDIA_MARGIN_MULTIPLIER),
    requiresConfirmation: Boolean(row.requires_confirmation),
    premium: Boolean(row.premium),
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

async function pricingCatalog(supabase: ReturnType<typeof adminClient>) {
  const { data, error } = await supabase.from("pricing_models").select("*").eq("active", true);
  if (!error && data?.length) {
    const dbModels = data.map(normalizePricingModel);
    const dbById = new Map(dbModels.map((model) => [model.id, model]));
    const merged = modelRegistry.map((registryModel) => {
      const dbModel = dbById.get(registryModel.id);
      if (!dbModel) return registryModel;
      dbById.delete(registryModel.id);
      return {
        ...registryModel,
        ...dbModel,
        endpoint: dbModel.endpoint || registryModel.endpoint,
        metadata: {
          ...registryModel.metadata,
          ...(dbModel.metadata || {}),
          provider: "fal.ai",
          fal_only: true,
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
  return modelRegistry;
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
  const text = prompt.toLowerCase();
  if (/lip[-\s]?sync|synchronise.*l[eè]vres|doublage.*l[eè]vres/.test(text)) return "lipsync";
  if (/clone.*voix|clonage.*voix|voice clone|digital twin/.test(text)) return "voice_clone";
  if (/musique|music|chanson|soundtrack|bande son|tts|voix off|voice over|audio|doublage|transcri/.test(text)) return "audio";
  if (/retouche|modifier|edite|edit|background|arriere-plan|upscale|agrandir|remove/.test(text) && raw === "image") return "image_edit";
  if (/reframe|extend|prolonge|upscale.*video|sous-titre|subtitle|fond.*video/.test(text) && raw === "video") return "video_edit";
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
  const defaults: Record<string, string> = {
    image: "gpt-image-2",
    image_edit: "gpt-image-2-edit",
    video: "veoq",
    video_edit: "luma-agent-ray-v3-2-video-to-video",
    audio: "minimax-tts",
    lipsync: "heygen-v3-lipsync-precision",
    voice_clone: "minimax-voice-clone",
  };
  const defaultId = defaults[type] || "nano";
  return catalog.find((m) => m.id === modelId && m.type === type)
    || catalog.find((m) => m.id === defaultId && m.type === type)
    || catalog.find((m) => m.type === type)
    || modelRegistry.find((m) => m.id === modelId && m.type === type)
    || modelRegistry.find((m) => m.id === defaultId && m.type === type)
    || modelRegistry.find((m) => m.type === type)
    || modelRegistry[0];
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
  return {
    credits,
    units,
    providerCostUsd,
    revenueFloorUsd,
    revenueRetailUsd,
    grossMarginFloorUsd,
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
  return {
    id,
    displayName: String(row.display_name || row.displayName || id),
    includedCredits: Number(row.included_credits || 0),
    monthlyPriceUsd: Number(row.monthly_price_usd || 0),
    annualPriceUsd: Number(row.annual_price_usd || 0),
    monthlyMessageLimit: Number(row.monthly_message_limit || 300),
    dailyMessageLimit: Number(row.daily_message_limit || 50),
    dailyVideoLimit: Number(row.daily_video_limit || 1),
    concurrentImageJobs: Number(row.concurrent_image_jobs || 1),
    concurrentVideoJobs: Number(row.concurrent_video_jobs || 0),
    allowedMediaTypes: (row.allowed_media_types as string[]) || ["image"],
    watermarkRequired: Boolean(row.watermark_required),
    mediaRetentionDays: Number(row.media_retention_days || 30),
    storageGb: Number(row.storage_gb || 1),
    maxUploadMb: Number(row.max_upload_mb || 25),
    seatLimit: Number(row.seat_limit || 1),
    supportLevel: String(row.support_level || "community"),
    priorityQueue: Boolean(row.priority_queue),
    stripeMonthlyPriceId: String(row.stripe_monthly_price_id || envKey("MONTHLY") || ""),
    stripeAnnualPriceId: String(row.stripe_annual_price_id || envKey("ANNUAL") || ""),
    metadata: (row.metadata || {}) as Record<string, unknown>,
  };
}

async function resolvePlan(supabase: ReturnType<typeof adminClient>, plan: string | null | undefined) {
  const normalized = normalizePlanId(plan);
  const { data, error } = await supabase.from("pricing_plans").select("*").eq("id", normalized).maybeSingle();
  if (!error && data) return normalizePlan(data);
  return fallbackPlans[normalized] || fallbackPlans.free;
}

function planPublic(plan: PlanLimits) {
  return {
    id: plan.id,
    displayName: plan.displayName,
    includedCredits: plan.includedCredits,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    annualPriceUsd: plan.annualPriceUsd,
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
  return Deno.env.get("MONEYFUSION_CHECKOUT_URL") || Deno.env.get("MONEYFUSION_API_URL") || "";
}

function moneyFusionCallbackUrl() {
  return Deno.env.get("MONEYFUSION_CALLBACK_URL") || `${APP_BASE_URL}/callback`;
}

function moneyFusionReturnUrl() {
  return Deno.env.get("MONEYFUSION_RETURN_URL") || `${APP_BASE_URL}/?checkout=success`;
}

function moneyFusionAmount(usd: number) {
  const currency = (Deno.env.get("MONEYFUSION_CURRENCY") || "USD").toUpperCase();
  if (currency === "USD") return Number(usd.toFixed(2));
  const rate = Number(Deno.env.get("MONEYFUSION_USD_RATE") || 0);
  if (!rate) throw new FlowtubeError(503, "MoneyFusion est prepare, mais MONEYFUSION_USD_RATE manque pour convertir les tarifs.", { code: "MONEYFUSION_RATE_MISSING", currency });
  return Math.round(usd * rate);
}

function moneyFusionPaymentUrl(data: Record<string, unknown>) {
  const nested = (data.data || data.result || {}) as Record<string, unknown>;
  return String(data.url || data.payment_url || data.paymentUrl || data.link || nested.url || nested.payment_url || nested.paymentUrl || nested.link || "");
}

function moneyFusionToken(data: Record<string, unknown>) {
  const nested = (data.data || data.result || {}) as Record<string, unknown>;
  return String(data.token || data.payment_token || data.paymentToken || data.transaction_id || data.reference || nested.token || nested.payment_token || nested.paymentToken || nested.transaction_id || nested.reference || "");
}

async function moneyFusionRequest(payload: Record<string, unknown>) {
  const url = moneyFusionCheckoutUrl();
  if (!url) {
    throw new FlowtubeError(503, "MoneyFusion est prepare, mais MONEYFUSION_CHECKOUT_URL manque dans les variables Supabase.", { code: "MONEYFUSION_NOT_CONFIGURED" });
  }
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  const apiKey = Deno.env.get("MONEYFUSION_API_KEY") || "";
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new FlowtubeError(response.status, "MoneyFusion a refuse la creation du paiement.", { code: "MONEYFUSION_ERROR", moneyfusion: data });
  }
  const paymentUrl = moneyFusionPaymentUrl(data);
  const token = moneyFusionToken(data);
  if (!paymentUrl) {
    throw new FlowtubeError(502, "MoneyFusion n'a pas renvoye d'URL de paiement.", { code: "MONEYFUSION_URL_MISSING", moneyfusion: data });
  }
  return { data, paymentUrl, token };
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
    currency: String(profile.currency || "usd"),
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

function sceneFromPrompt(prompt: string) {
  const text = prompt.toLowerCase();
  if (/btp|chantier|devis|artisan|ouvrier|macon/.test(text)) return "btp";
  if (/parfum|produit|packshot|flacon|montre|cosme/.test(text)) return "product";
  if (/personnage|portrait|avatar|character|visage/.test(text)) return "character";
  return "studio";
}

function shouldGenerateMedia(prompt: string, mode: string) {
  if (mode === "image" || mode === "video") return true;
  return /image|video|affiche|visuel|poster|photo|packshot|logo|anime|animation|genere|cree/.test(prompt.toLowerCase());
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
    .order("created_at", { ascending: true });
  if (error) throw error;

  return await Promise.all((projects || []).map(async (project) => {
    const { data: conv } = await supabase.from("conversations")
      .select("id,title")
      .eq("project_id", project.id)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const conversationId = conv?.id;
    const { data: messages } = await supabase.from("messages")
      .select("id,role,content,metadata,created_at")
      .eq("project_id", project.id)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    const ids = (messages || []).map((message) => message.id);
    const { data: generations } = ids.length
      ? await supabase.from("generations").select("*").in("message_id", ids)
      : { data: [] };
    const genByMessage = new Map((generations || []).map((generation) => [generation.message_id, generation]));
    return {
      id: project.id,
      title: project.title,
      conversationId,
      messages: (messages || []).map((message) => ({
        id: message.id,
        role: message.role === "assistant" ? "agent" : message.role,
        text: message.content,
        media: genByMessage.has(message.id)
          ? mediaFromGeneration(genByMessage.get(message.id)!)
          : (message.metadata?.media || undefined),
      })),
    };
  }));
}

async function bootstrap(req: Request) {
  const supabase = adminClient();
  const userId = await optionalUserIdFromRequest(req, supabase);
  const profile = userId ? await ensureProfile(supabase, userId) : null;
  const projects = userId ? await listProjectData(supabase, userId) : [];
  const catalog = await pricingCatalog(supabase);
  const { data: plans } = await supabase.from("pricing_plans").select("*").eq("active", true).order("sort_order", { ascending: true });
  const { data: creditPacks } = await supabase.from("credit_packs").select("*").eq("active", true).order("price_usd", { ascending: true });
  const { data: subscription } = userId
    ? await supabase.from("subscriptions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const { count: generationCount } = userId
    ? await supabase.from("generations").select("id", { count: "exact", head: true }).eq("user_id", userId)
    : { count: 0 };
  return json({
    user: profile ? { id: profile.id, name: profile.display_name, email: profile.email, plan: profile.plan, billingStatus: profile.billing_status, currentPeriodEnd: profile.current_period_end } : null,
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
      expensiveCreditThreshold: EXPENSIVE_CREDIT_THRESHOLD,
    },
    models: catalog.map((model) => {
      const quote = quoteFor(model);
      return {
        id: model.id,
        name: model.name,
        type: model.type,
        endpoint: model.endpoint,
        pricingUnit: model.pricingUnit,
        defaultUnits: model.defaultUnits,
        maximumUnits: model.maximumUnits,
        premium: model.premium,
        capabilities: modelCapabilities(model),
        qualityTier: String((model.metadata || {}).quality_tier || "standard"),
        inputProfile: String((model.metadata || {}).input_profile || "text_prompt"),
        family: String((model.metadata || {}).family || "fal.ai"),
        credits: quote.credits,
        providerCostUsd: quote.providerCostUsd,
        requiresConfirmation: quote.requiresConfirmation,
      };
    }),
    plans: (plans || []).filter((plan) => !["starter", "studio"].includes(String(plan.id))).map((plan) => planPublic(normalizePlan(plan))),
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
      moneyFusionConfigured: Boolean(moneyFusionCheckoutUrl()),
      moneyFusionCallbackUrl: moneyFusionCallbackUrl(),
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
  "Tu es Huggy, directeur creatif IA de Huggyflow.",
  "Tu transformes les idees de l'utilisateur en images, videos, scripts, storyboards et assets visuels professionnels, entierement par la conversation.",
  "Tu agis comme directeur artistique, scenariste, realisateur, chef de production, conseiller en format, style, cout et efficacite, et partenaire creatif.",
  "Tu reponds toujours en francais. Ton style est concis, creatif, concret et direct. Evite le bavardage, les longs preambules, le jargon technique et les questions inutiles.",
  "",
  "Objectif: faire avancer l'utilisateur vers un media utilisable a chaque interaction: idee plus claire, concept visuel, prompt exploitable, storyboard, image, video, retouche, variante ou decision de production.",
  "Si l'utilisateur est flou, cadre. S'il est precis, execute. S'il hesite, propose. S'il veut aller vite, reduis les etapes.",
  "",
  "Principes:",
  "- Avance par defaut. Ne bloque jamais sur un detail secondaire. Si une information manque mais peut etre deduite, fais une hypothese explicite et continue.",
  "- Pose une seule question a la fois, uniquement si la reponse change fortement le resultat. Propose toujours une option par defaut.",
  "- Produis avant d'expliquer: montre l'idee, le plan, le prompt, le storyboard, l'action proposee ou le resultat.",
  "- Sois creatif mais economique: image avant video pour valider, video courte avant video longue, edition ciblee avant regeneration complete, modele suffisant avant modele premium, reutilisation des assets avant nouvelle generation.",
  "",
  "Capacites: images publicitaires, affiches, portraits, avatars, scenes produit, miniatures, couvertures, concepts artistiques, photos realistes, illustrations, videos sociales courtes, publicites, clips produit, plans cinematographiques, animation depuis image, video-to-video, storyboards, voix ou lipsync si pertinent, concepts, accroches, slogans, scripts, voix off, dialogues, prompts image et prompts video.",
  "Aide aussi a garder la coherence des personnages, avatars, visages, tenues, marques, palettes, decors, styles, campagnes multi-formats, versions, collections et variantes A/B.",
  "",
  "Methode:",
  "1. Comprends rapidement sujet, objectif, usage final, public, format, style, duree si video, realisme, references, contraintes de marque, budget ou cout.",
  "2. Cadre seulement si utile avec: Je pars sur [format], [style], [objectif], [hypothese importante].",
  "3. Prepare: pour une image, redige directement le prompt et annonce le rendu; pour une video, ecris un mini-storyboard avec duree, format, rythme, mouvement et ambiance; pour une serie, verrouille la direction artistique et les elements coherents.",
  "4. Avant toute generation, annonce en une phrase: Je vais creer [type de media], [format], [style], [element principal].",
  "5. Apres un resultat, propose une ou deux iterations concretes: cadrage, lumiere, decor, premium, mouvement, autre format, variante commerciale ou transformation image vers video.",
  "",
  "Choix des modeles: tu es multi-modele. Choisis selon cout, vitesse, qualite, fidelite aux references, coherence personnage, realisme, mouvement, duree, audio, lipsync, retouches et lisibilite du texte.",
  "Tous les modeles media disponibles passent par fal.ai. Ne propose pas d'appeler directement OpenAI, Google, xAI, Luma, VEED, ElevenLabs ou MiniMax hors fal.ai: si un slug existe, il doit etre utilise via fal.ai.",
  "Regle de selection HuggyFlow: choisis automatiquement le meilleur modele fal.ai pour la tache. Pour un rendu final commercial, prefere les modeles premium ou haute qualite; pour une exploration rapide, prefere les modeles fast, turbo, lite ou mini; pour un personnage recurrent, privilegie reference-to-video, avatar, lipsync ou modeles coherents reference; pour une retouche, choisis edit/outpaint/remove-background/upscale; pour video depuis image, choisis image-to-video; pour prolonger, choisis extend-video.",
  "Regle par defaut: utilise le modele le plus puissant justifie par l'objectif, tout en gardant la rentabilite credits. Ne baisse en gamme que pour brouillon, test rapide, contrainte de credits ou demande explicite d'economie.",
  "Ne liste pas tous les modeles a l'utilisateur. Explique seulement le choix retenu si cela aide: modele choisi, raison courte, cout estime et alternative economique si pertinente.",
  "",
  "Couts et confirmations: demande confirmation avant generation video, generation en lot, modele premium, duree longue, 4K ou haute resolution couteuse, clonage vocal, lipsync, audio synchronise ou operation consommant beaucoup de credits.",
  "Formule recommandee: Cette option coutera environ [X] credits. Je recommande cette version car [raison courte]. Tu confirmes ?",
  "Si une option moins chere est pertinente, propose-la: Alternative economique: une image cle pour valider le style avant la video.",
  "",
  "Controle qualite avant generation: sujet identifiable, point focal fort, format adapte, style coherent, lumiere lisible, composition claire, prompt non contradictoire, detail adapte, reference respectee, personnages coherents, texte visible court et lisible, resultat exploitable sur la plateforme visee.",
  "Evite les prompts vagues, listes d'adjectifs sans direction, scenes surchargees, styles incompatibles, demandes impossibles, mouvements incoherents, textes longs dans l'image et decors qui distraient.",
  "",
  "References: quand l'utilisateur fournit une reference, identifie ce qui doit rester stable, conserve les elements importants, utilise la reference comme base, signale les limites si la fidelite exacte est impossible, et ne demande confirmation que si l'ambiguite est reelle.",
  "Pour un personnage recurrent, conserve visage, age apparent, morphologie, coiffure, tenue, accessoires, attitude, palette et univers. Pour une marque, conserve logo, couleurs, ton, style photo/video, typographie si disponible, regles de composition et interdits visuels.",
  "",
  "Modes de reponse:",
  "- Mode rapide: Je pars sur [hypothese]. Je vais creer [media + format + style]. [Action ou prompt].",
  "- Mode creatif: 3 a 5 concepts maximum, titre court, intention visuelle, usage conseille, recommandation finale.",
  "- Mode storyboard: concept, format, duree, ambiance, 3 a 6 scenes maximum, cout estime si generation, confirmation.",
  "- Mode prompt: prompt principal, variante optionnelle, format, style, lumiere, camera, ambiance, contraintes negatives utiles.",
  "- Mode retouche: element a conserver, element a modifier, type d'edition, resultat attendu, confirmation si cout.",
  "",
  "Securite: refuse poliment le contenu illegal, deepfake trompeur, usurpation d'identite, clonage vocal sans consentement, imitation d'une personne privee sans autorisation, contenu haineux, sexuel illegal, violent ou dangereux non autorise, et violation manifeste de droits. Donne une raison courte et une alternative sure.",
  "",
  "Formats: 9:16 pour TikTok/Reels/Shorts/stories; 16:9 pour YouTube, publicite video, presentation, cinema; 1:1 feed carre; 4:5 Instagram feed vertical; 3:4 portrait, affiche, e-commerce; 4:3 classique. Si le format manque, choisis l'usage probable.",
  "",
  "Regle finale: a chaque reponse, fais avancer la production. Ne sois pas seulement assistant: cadre, propose, decide, produit et ameliore.",
].join("\n");

function fallbackReply(prompt: string, type: string, credits: number) {
  if (/storyboard|script|scenario|plan/.test(prompt.toLowerCase())) {
    return "Je structure le concept en 6 plans courts : accroche visuelle, contexte, probleme, solution, preuve, puis appel a l'action. Chaque plan peut ensuite devenir une image ou une video.";
  }
  return type === "video"
    ? `Je lance une video courte en format choisi. Cout estime : ${credits} credits.`
    : `Je lance une image propre et exploitable en format choisi. Cout estime : ${credits} credits.`;
}

async function anthropicReply(prompt: string, type: string, credits: number) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return fallbackReply(prompt, type, credits);
  const system = HUGGYFLOW_SYSTEM_PROMPT;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 700,
        system,
        messages: [{ role: "user", content: `${prompt}\n\nType de generation: ${type}. Credits estimes: ${credits}.` }],
      }),
    });
    if (!response.ok) throw new Error(`anthropic ${response.status}`);
    const data = await response.json();
    const text = (data.content || []).map((part: { text?: string }) => part.text || "").join("").trim();
    return text || fallbackReply(prompt, type, credits);
  } catch (_err) {
    return fallbackReply(prompt, type, credits);
  }
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
  } catch (err) {
    await supabase.from("generations").update({
      status: "failed",
      error_message: err instanceof Error ? err.message : "fal.ai submission failed",
      provider_payload: {
        fal_error: err instanceof Error ? err.message : "fal.ai submission failed",
      },
    }).eq("id", generation.id);
  }
}

async function resolveProjectAndConversation(supabase: ReturnType<typeof adminClient>, userId: string, projectId?: string) {
  const uuidish = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let project = null;
  if (projectId && uuidish.test(projectId)) {
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).eq("user_id", userId).maybeSingle();
    project = data;
  }
  if (!project) {
    const { data } = await supabase.from("projects").select("*").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
    project = data;
  }
  if (!project) {
    const created = await createProject(supabase, userId, "Nouveau projet");
    project = created.project;
  }
  let { data: conversation } = await supabase.from("conversations").select("*").eq("project_id", project.id).eq("user_id", userId).limit(1).maybeSingle();
  if (!conversation) {
    const { data, error } = await supabase.from("conversations").insert({ user_id: userId, project_id: project.id, title: project.title }).select("*").single();
    if (error) throw error;
    conversation = data;
  }
  return { project, conversation };
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
  return `Cette action coute ${quote.credits} credits (${model.name}, ${unitLabel}). Confirme avec "oui" pour lancer, ou "annule" pour ignorer.`;
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
  const requestedUnits = model.pricingUnit === "second" ? Number(body.duration || model.defaultUnits) : Number(body.units || model.defaultUnits);
  const quote = quoteFor(model, requestedUnits);
  const credits = quote.credits;
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  await enforceRateLimit(req, supabase, `generate.${type}`, userId, GENERATION_RATE_LIMIT);
  const moderation = await enforcePromptPolicy(supabase, profile, prompt, String(body.projectId || ""));
  await enforceGenerationGuards(supabase, profile, plan, model, quote);
  ensureProviderReady(model);

  if (quote.requiresConfirmation && body.confirmed !== true) {
    const pendingBody = {
      projectId: body.projectId,
      prompt,
      type,
      modelId: model.id,
      aspectRatio: body.aspectRatio || "4:5",
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

  const { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""));

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
      aspect_ratio: String(body.aspectRatio || "4:5"),
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

async function chat(req: Request) {
  const body = await bodyJson(req);
  const prompt = String(body.message || "");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (event: string, payload: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      try {
        const supabase = adminClient();
        const userId = await userIdFromRequest(req, supabase);
        const profile = await ensureProfile(supabase, userId);
        await enforceRateLimit(req, supabase, "chat", userId, DEFAULT_RATE_LIMIT);
        const plan = await resolvePlan(supabase, String(profile.plan || "free"));
        await enforceMessageLimits(supabase, userId, plan);
        const { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""));
        await enforcePromptPolicy(supabase, profile, prompt, project.id);
        await supabase.from("messages").insert({
          user_id: userId,
          project_id: project.id,
          conversation_id: conversation.id,
          role: "user",
          content: prompt,
        });

        const metadata = cleanMetadata(profile.metadata);
        const pending = metadata.pending_generation as Record<string, unknown> | undefined;
        const pendingExpired = pending?.expiresAt ? new Date(String(pending.expiresAt)).getTime() < Date.now() : false;
        if (pending && pendingExpired) await clearPendingGeneration(supabase, profile);

        if (pending && !pendingExpired && isCancelText(prompt)) {
          await clearPendingGeneration(supabase, profile);
          send("text", { delta: "Generation annulee. Aucun credit n'a ete debite." });
          send("done", { ok: true });
          return;
        }

        if (pending && !pendingExpired && isConfirmationText(prompt)) {
          await clearPendingGeneration(supabase, profile);
          const pendingBody = (pending.body || {}) as Record<string, unknown>;
          const reply = "Confirmation recue. Je lance la generation maintenant.";
          send("text", { delta: reply });
          const result = await createGeneration(req, {
            ...pendingBody,
            projectId: pendingBody.projectId || project.id,
            confirmed: true,
          }, reply);
          send("generation", result.generation);
          const { data: freshProfile } = await supabase.from("profiles").select("credits").eq("id", userId).single();
          send("credits", { credits: freshProfile?.credits ?? 0 });
          send("done", { ok: true });
          return;
        }

        const mode = String(body.mode || "image");
        const type = requestTypeFromBody({ ...body, mode }, prompt);
        const catalog = await pricingCatalog(supabase);
        const model = resolveBestModelFromCatalog(catalog, String(body.modelId || "auto"), type, prompt, body as Record<string, unknown>);
        const quote = quoteFor(model, model.pricingUnit === "second" ? Number(body.duration || model.defaultUnits || 5) : undefined);
        const willGenerate = shouldGenerateMedia(prompt, mode);

        if (willGenerate && quote.requiresConfirmation && body.confirmed !== true) {
          await enforceGenerationGuards(supabase, profile, plan, model, quote);
          ensureProviderReady(model);
          await savePendingGeneration(supabase, profile, {
            body: {
              projectId: project.id,
              prompt,
              type,
              modelId: model.id,
              aspectRatio: body.aspectRatio || "4:5",
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
          send("text", { delta: confirmationMessage(model, quote) });
          send("done", { ok: true, requiresConfirmation: true });
          return;
        }

        if (willGenerate) ensureProviderReady(model);
        const credits = quote.credits;
        const reply = await anthropicReply(prompt, type, credits);
        for (const word of reply.split(/(\s+)/)) {
          if (word) send("text", { delta: word });
          await new Promise((resolve) => setTimeout(resolve, 8));
        }

        if (willGenerate) {
          const result = await createGeneration(req, {
            projectId: project.id,
            prompt,
            type,
            modelId: model.id,
            aspectRatio: body.aspectRatio,
            scene: sceneFromPrompt(prompt),
            duration: model.pricingUnit === "second" ? quote.units : undefined,
            confirmed: body.confirmed === true || !quote.requiresConfirmation,
            imageUrl: body.imageUrl || body.image_url || body.referenceImageUrl || body.reference_image_url,
            videoUrl: body.videoUrl || body.video_url,
            audioUrl: body.audioUrl || body.audio_url,
            referenceUrls: body.referenceUrls || body.reference_urls,
            firstFrameUrl: body.firstFrameUrl || body.first_frame_url,
            lastFrameUrl: body.lastFrameUrl || body.last_frame_url,
          }, reply);
          send("generation", result.generation);
        }
        const { data: finalProfile } = await supabase.from("profiles").select("credits").eq("id", userId).single();
        send("credits", { credits: finalProfile?.credits ?? 0 });
        send("done", { ok: true });
      } catch (err) {
        if (err instanceof FlowtubeError) send("error", { message: err.message, ...err.payload });
        else send("error", { message: err instanceof Error ? err.message : "Chat failed" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
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
  const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).single();
  const nextCredits = Math.max(0, Number(profile?.credits || 0) - credits);
  const creditFloorUsd = Number(generation.credit_floor_usd || CREDIT_FLOOR_USD);
  const retailCreditUsd = Number(generation.retail_credit_usd || RETAIL_CREDIT_USD);
  const providerCostUsd = Number(generation.cost_usd || 0);
  const revenueFloorUsd = Number((credits * creditFloorUsd).toFixed(4));
  const grossMarginFloorUsd = Number((revenueFloorUsd - providerCostUsd).toFixed(4));
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
      result_url_present: Boolean(generation.result_url),
    },
  });
  await supabase.from("generations").update({
    debited_at: new Date().toISOString(),
    revenue_floor_usd: revenueFloorUsd,
    gross_margin_floor_usd: grossMarginFloorUsd,
  }).eq("id", generation.id);
  await persistMediaAsset(supabase, generation);
}

async function syncGeneration(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  if (generation.status === "completed" || generation.status === "failed") return generation;
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
        return data;
      }
      const progress = Math.min(95, Math.max(Number(generation.progress || 5), Number(generation.progress || 5) + 8));
      const { data } = await supabase.from("generations").update({ status: "running", progress, provider_payload: status }).eq("id", generation.id).select("*").single();
      return data;
    } catch (err) {
      const { data } = await supabase.from("generations").update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "fal.ai status failed",
      }).eq("id", generation.id).select("*").single();
      await refundFailedGeneration(supabase, data);
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
      options: { data: { display_name: body.displayName || body.name || "Utilisateur" } },
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
      }, { onConflict: "id" });
    }
    return json({ user: data.user, session: data.session, needsEmailConfirmation: !data.session });
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
  const phone = String(body.customerPhone || body.phone || profile.billing_phone || profileMetadata.phone || "").trim();
  if (!phone) {
    throw new FlowtubeError(400, "MoneyFusion demande un numero client. Envoie customerPhone avec le checkout.", { code: "MONEYFUSION_PHONE_REQUIRED" });
  }

  let amountUsd = 0;
  let article = `${APP_NAME} credits`;
  let plan: PlanLimits | null = null;
  let pack: Record<string, unknown> | null = null;
  const metadata: Record<string, unknown> = { provider: "moneyfusion", type, interval };

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
  const payload = {
    totalPrice: moneyFusionAmount(amountUsd),
    article,
    numeroSend: phone,
    nomclient: String(profile.display_name || profile.email || "Client Huggyflow"),
    return_url: String(body.successUrl || successUrl || moneyFusionReturnUrl()),
    webhook_url: moneyFusionCallbackUrl(),
    reference,
    metadata,
  };
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
    currency: Deno.env.get("MONEYFUSION_CURRENCY") || "usd",
    checkout_url: session.paymentUrl,
    metadata: { moneyfusion: session.data, payload, plan: plan ? planPublic(plan) : null, pack },
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
  const provider = String(body.provider || Deno.env.get("BILLING_PROVIDER") || "stripe").toLowerCase();

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
    subscription,
    invoices: invoices || [],
    transactions: transactions || [],
  });
}

function requireAdmin(req: Request) {
  const secret = Deno.env.get("FLOWTUBE_ADMIN_SECRET") || "";
  if (!secret) throw new FlowtubeError(503, "Admin secret missing.", { code: "ADMIN_NOT_CONFIGURED" });
  const provided = req.headers.get("x-flowtube-admin-secret") || req.headers.get("x-huggyflow-admin-secret");
  if (provided !== secret) throw new FlowtubeError(401, "Unauthorized admin request.", { code: "ADMIN_UNAUTHORIZED" });
}

async function adminRoute(req: Request, action: string) {
  requireAdmin(req);
  const supabase = adminClient();
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

async function moneyFusionCallback(req: Request) {
  const required = Deno.env.get("MONEYFUSION_CALLBACK_SECRET") || "";
  const url = new URL(req.url);
  const provided = req.headers.get("x-moneyfusion-secret") || url.searchParams.get("secret") || "";
  if (required && provided !== required) return unauthorized();

  const body = req.method === "GET" ? {} : await bodyJson(req);
  const supabase = adminClient();
  const token = String(body.token || body.payment_token || body.paymentToken || body.transaction_id || body.reference || url.searchParams.get("token") || url.searchParams.get("reference") || "");
  const reference = String(body.reference || body.order_id || body.orderId || url.searchParams.get("reference") || "");
  const eventId = token || reference || crypto.randomUUID();
  const rawStatus = String(body.status || body.statut || body.payment_status || body.etat || url.searchParams.get("status") || "").toLowerCase();
  const paid = ["paid", "success", "successful", "completed", "complete", "approved", "valid", "valide", "succeeded"].some((s) => rawStatus.includes(s));

  await supabase.from("payment_events").upsert({
    provider: "moneyfusion",
    provider_event_id: eventId,
    event_type: rawStatus || "callback",
    processed: false,
    metadata: { body, query: Object.fromEntries(url.searchParams.entries()) },
  }, { onConflict: "provider,provider_event_id" });

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
    await supabase.from("payment_events").update({ processed: true }).eq("provider", "moneyfusion").eq("provider_event_id", eventId);
    return json({ received: true, ignored: true });
  }

  if (paid && session.status !== "completed") {
    await supabase.from("billing_checkout_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      provider_payload: body,
      metadata: Object.assign({}, session.metadata || {}, { callback: body }),
    }).eq("id", session.id);

    const userId = String(session.user_id || "");
    if (session.credit_pack_id) {
      await grantCreditPack(supabase, userId, String(session.credit_pack_id));
    } else if (session.plan_id) {
      await grantPlanCredits(supabase, userId, String(session.plan_id), String(session.billing_interval || "monthly"), `moneyfusion:${eventId}`);
    }
  } else if (!paid && rawStatus) {
    await supabase.from("billing_checkout_sessions").update({
      status: rawStatus.includes("fail") || rawStatus.includes("cancel") ? "failed" : "open",
      provider_payload: body,
      metadata: Object.assign({}, session.metadata || {}, { callback: body }),
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
    return json({ ok: true });
  }
  await supabase.from("generations").update({ status: "running", provider_payload: body }).eq("id", generation.id);
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

    if (first === "bootstrap" && req.method === "GET") return await bootstrap(req);
    if (first === "chat" && req.method === "POST") return await chat(req);
    if (first === "generate" && req.method === "POST") return await directGenerate(req);
    if (first === "generations" && route[1] && req.method === "GET") return await generationStatus(req, route[1]);
    if (first === "projects" && req.method === "POST") return await createProjectRoute(req);
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
    if (err instanceof FlowtubeError) return json(err.payload, err.status);
    return json({ error: { message: err instanceof Error ? err.message : "Unexpected Edge error" } }, 500);
  }
});
