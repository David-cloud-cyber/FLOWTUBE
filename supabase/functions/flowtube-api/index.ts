import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { fal } from "npm:@fal-ai/client@1.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://fuvrxobxjcqyevsjsdfd.supabase.co";
const DEMO_USER_ID = Deno.env.get("FLOWTUBE_DEMO_USER_ID") || "00000000-0000-0000-0000-000000000001";
const DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";
const CREDIT_FLOOR_USD = 0.008;
const RETAIL_CREDIT_USD = 0.013;
const MEDIA_MARGIN_MULTIPLIER = 3.5;
const EXPENSIVE_CREDIT_THRESHOLD = 200;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flowtube-secret",
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
  monthlyMessageLimit: number;
  dailyMessageLimit: number;
  dailyVideoLimit: number;
  concurrentImageJobs: number;
  concurrentVideoJobs: number;
  allowedMediaTypes: string[];
  watermarkRequired: boolean;
  mediaRetentionDays: number;
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

const modelRegistry: PricingModel[] = [
  { id: "nano", name: "Nano Banana Pro", type: "image", endpoint: Deno.env.get("FAL_MODEL_NANO") || "fal-ai/nano-banana-pro", pricingUnit: "unit", costPerUnitUsd: 0.15, defaultUnits: 1, minimumUnits: 1, creditFloorUsd: CREDIT_FLOOR_USD, retailCreditUsd: RETAIL_CREDIT_USD, marginMultiplier: MEDIA_MARGIN_MULTIPLIER, requiresConfirmation: false, premium: true, metadata: { tier: "premium" } },
  { id: "flux", name: "Flux", type: "image", endpoint: Deno.env.get("FAL_MODEL_FLUX") || "fal-ai/flux/schnell", pricingUnit: "unit", costPerUnitUsd: 0.04, defaultUnits: 1, minimumUnits: 1, creditFloorUsd: CREDIT_FLOOR_USD, retailCreditUsd: RETAIL_CREDIT_USD, marginMultiplier: MEDIA_MARGIN_MULTIPLIER, requiresConfirmation: false, premium: false, metadata: { tier: "standard" } },
  { id: "veoq", name: "Veo 3.1 Quality", type: "video", endpoint: Deno.env.get("FAL_MODEL_VEO_QUALITY") || "fal-ai/veo3", pricingUnit: "second", costPerUnitUsd: 0.2, defaultUnits: 5, minimumUnits: 5, maximumUnits: 8, creditFloorUsd: CREDIT_FLOOR_USD, retailCreditUsd: RETAIL_CREDIT_USD, marginMultiplier: MEDIA_MARGIN_MULTIPLIER, requiresConfirmation: true, premium: true, metadata: { tier: "premium", audio: false } },
  { id: "veol", name: "Veo 3.1 Lite", type: "video", endpoint: Deno.env.get("FAL_MODEL_VEO_LITE") || "fal-ai/veo3/fast", pricingUnit: "second", costPerUnitUsd: 0.1, defaultUnits: 5, minimumUnits: 5, maximumUnits: 8, creditFloorUsd: CREDIT_FLOOR_USD, retailCreditUsd: RETAIL_CREDIT_USD, marginMultiplier: MEDIA_MARGIN_MULTIPLIER, requiresConfirmation: true, premium: false, metadata: { tier: "standard", audio: false } },
  { id: "kling", name: "Kling", type: "video", endpoint: Deno.env.get("FAL_MODEL_KLING") || "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", pricingUnit: "second", costPerUnitUsd: 0.12, defaultUnits: 5, minimumUnits: 5, maximumUnits: 15, creditFloorUsd: CREDIT_FLOOR_USD, retailCreditUsd: RETAIL_CREDIT_USD, marginMultiplier: MEDIA_MARGIN_MULTIPLIER, requiresConfirmation: true, premium: true, metadata: { tier: "premium", audio: false } },
  { id: "seedance", name: "Seedance", type: "video", endpoint: Deno.env.get("FAL_MODEL_SEEDANCE") || "fal-ai/bytedance/seedance/v1/lite/text-to-video", pricingUnit: "second", costPerUnitUsd: 0.08, defaultUnits: 5, minimumUnits: 5, maximumUnits: 15, creditFloorUsd: CREDIT_FLOOR_USD, retailCreditUsd: RETAIL_CREDIT_USD, marginMultiplier: MEDIA_MARGIN_MULTIPLIER, requiresConfirmation: true, premium: false, metadata: { tier: "standard", audio: false } },
];

const fallbackPlans: Record<string, PlanLimits> = {
  free: { id: "free", displayName: "Free", includedCredits: 100, monthlyMessageLimit: 400, dailyMessageLimit: 20, dailyVideoLimit: 0, concurrentImageJobs: 1, concurrentVideoJobs: 0, allowedMediaTypes: ["image"], watermarkRequired: true, mediaRetentionDays: 7 },
  basic: { id: "basic", displayName: "Basic", includedCredits: 1000, monthlyMessageLimit: 300, dailyMessageLimit: 60, dailyVideoLimit: 2, concurrentImageJobs: 2, concurrentVideoJobs: 1, allowedMediaTypes: ["image", "video"], watermarkRequired: false, mediaRetentionDays: 30 },
  starter: { id: "starter", displayName: "Starter", includedCredits: 1000, monthlyMessageLimit: 300, dailyMessageLimit: 60, dailyVideoLimit: 2, concurrentImageJobs: 2, concurrentVideoJobs: 1, allowedMediaTypes: ["image", "video"], watermarkRequired: false, mediaRetentionDays: 30 },
  pro: { id: "pro", displayName: "Pro", includedCredits: 4500, monthlyMessageLimit: 1500, dailyMessageLimit: 150, dailyVideoLimit: 8, concurrentImageJobs: 4, concurrentVideoJobs: 2, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit"], watermarkRequired: false, mediaRetentionDays: 90 },
  max: { id: "max", displayName: "Max", includedCredits: 12000, monthlyMessageLimit: 4000, dailyMessageLimit: 300, dailyVideoLimit: 20, concurrentImageJobs: 8, concurrentVideoJobs: 4, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"], watermarkRequired: false, mediaRetentionDays: 180 },
  studio: { id: "studio", displayName: "Studio", includedCredits: 12000, monthlyMessageLimit: 4000, dailyMessageLimit: 300, dailyVideoLimit: 20, concurrentImageJobs: 8, concurrentVideoJobs: 4, allowedMediaTypes: ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"], watermarkRequired: false, mediaRetentionDays: 180 },
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
  return req.headers.get("x-flowtube-secret") === required ? null : unauthorized();
}

async function bodyJson(req: Request) {
  try {
    return await req.json();
  } catch (_err) {
    return {};
  }
}

async function userIdFromRequest(req: Request, supabase: ReturnType<typeof adminClient>) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data.user?.id) return data.user.id;
  }
  return DEMO_USER_ID;
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
  if (!error && data?.length) return data.map(normalizePricingModel);
  return modelRegistry;
}

function resolveModelFromCatalog(catalog: PricingModel[], modelId: string | undefined, type: string) {
  const defaultId = type === "video" ? "veol" : "nano";
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
  return {
    id,
    displayName: String(row.display_name || row.displayName || id),
    includedCredits: Number(row.included_credits || 0),
    monthlyMessageLimit: Number(row.monthly_message_limit || 300),
    dailyMessageLimit: Number(row.daily_message_limit || 50),
    dailyVideoLimit: Number(row.daily_video_limit || 1),
    concurrentImageJobs: Number(row.concurrent_image_jobs || 1),
    concurrentVideoJobs: Number(row.concurrent_video_jobs || 0),
    allowedMediaTypes: (row.allowed_media_types as string[]) || ["image"],
    watermarkRequired: Boolean(row.watermark_required),
    mediaRetentionDays: Number(row.media_retention_days || 30),
  };
}

async function resolvePlan(supabase: ReturnType<typeof adminClient>, plan: string | null | undefined) {
  const normalized = normalizePlanId(plan);
  const { data, error } = await supabase.from("pricing_plans").select("*").eq("id", normalized).maybeSingle();
  if (!error && data) return normalizePlan(data);
  return fallbackPlans[normalized] || fallbackPlans.free;
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
    email: userId === DEMO_USER_ID ? "demo@flowtube.local" : null,
    display_name: userId === DEMO_USER_ID ? "Awa Diop" : "Utilisateur",
    plan: "basic",
    credits: 1240,
    credits_max: 1800,
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
  const { data: existing, error } = await supabase.from("projects")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  if (error) throw error;
  if ((existing || []).length > 0) return;

  await createProject(supabase, userId, "Affiche promo BTP", [
    { role: "user", content: "Cree-moi une affiche promo pour un service de devis BTP en 10 minutes grace a l'IA, prix 5 000 FCFA au lieu de 15 000, format reseaux sociaux." },
    { role: "assistant", content: "J'ai place un artisan casque sur un chantier au coucher du soleil, un telephone qui affiche le devis, et un bandeau d'offre 48 h. Composition verticale, prete pour les reseaux.", metadata: { media: { type: "image", status: "done", progress: 100, model: "Nano Banana Pro", ratio: "4:5", scene: "btp" } } },
  ]);
  await createProject(supabase, userId, "Video produit", [
    { role: "user", content: "Une courte video packshot pour un parfum, fond sombre elegant." },
    { role: "assistant", content: "Packshot tournant, lumiere rasante et reflets soyeux sur le flacon.", metadata: { media: { type: "video", status: "done", progress: 100, model: "Veo 3.1 Quality", ratio: "9:16", scene: "product", dur: "0:06" } } },
  ]);
  await createProject(supabase, userId, "Storyboard pub");
  await createProject(supabase, userId, "Personnage coherent");
  await createProject(supabase, userId, "Affiche evenement");
  await createProject(supabase, userId, "Logo anime");
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
  const userId = await userIdFromRequest(req, supabase);
  const profile = await ensureProfile(supabase, userId);
  await ensureSeedData(supabase, userId);
  const projects = await listProjectData(supabase, userId);
  const catalog = await pricingCatalog(supabase);
  const { data: plans } = await supabase.from("pricing_plans").select("*").eq("active", true).order("monthly_price_usd", { ascending: true });
  const { data: creditPacks } = await supabase.from("credit_packs").select("*").eq("active", true).order("price_usd", { ascending: true });
  return json({
    user: { id: profile.id, name: profile.display_name, email: profile.email, plan: profile.plan },
    credits: profile.credits,
    creditsMax: profile.credits_max,
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
        credits: quote.credits,
        providerCostUsd: quote.providerCostUsd,
        requiresConfirmation: quote.requiresConfirmation,
      };
    }),
    plans: (plans || []).map(normalizePlan),
    creditPacks: (creditPacks || []).map((pack) => ({
      id: pack.id,
      label: pack.label,
      credits: pack.credits,
      priceUsd: pack.price_usd,
    })),
    projects,
  });
}

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
  const system = "Tu es le directeur creatif IA de FLOWTUBE. Reponds en francais, tres concis, concret, sans jargon. Si une generation media va etre lancee, annonce le sujet, le style, le format et le cout en credits.";
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

function falInput(model: PricingModel, prompt: string, aspectRatio: string, duration: number) {
  if (model.type === "video") {
    return { prompt, aspect_ratio: aspectRatio, duration: String(duration) };
  }
  return { prompt, aspect_ratio: aspectRatio, num_images: 1 };
}

async function startFalGeneration(generation: Record<string, unknown>, model: PricingModel) {
  const key = Deno.env.get("FAL_KEY");
  const supabase = adminClient();
  if (!key || !model.endpoint) {
    await supabase.from("generations").update({ status: "running", provider_payload: { demo: true } }).eq("id", generation.id);
    return;
  }
  try {
    fal.config({ credentials: key });
    const request = await fal.queue.submit(String(model.endpoint || ""), {
      input: falInput(model, String(generation.prompt || ""), String(generation.aspect_ratio || "4:5"), Number(generation.duration_seconds || 5)),
    });
    await supabase.from("generations").update({
      status: "running",
      fal_job_id: request.request_id,
      provider_payload: { submitted: request },
    }).eq("id", generation.id);
  } catch (err) {
    await supabase.from("generations").update({
      status: "running",
      provider_payload: {
        demo: true,
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
  await ensureSeedData(supabase, userId);

  const prompt = String(body.prompt || body.message || "");
  const rawType = String(body.type || body.mode || "image");
  const allowedTypes = ["image", "video", "audio", "lipsync", "image_edit", "video_edit", "voice_clone"];
  const type = allowedTypes.includes(rawType) ? rawType : (rawType === "video" ? "video" : "image");
  const catalog = await pricingCatalog(supabase);
  const model = resolveModelFromCatalog(catalog, String(body.modelId || ""), type);
  const requestedUnits = model.pricingUnit === "second" ? Number(body.duration || model.defaultUnits) : Number(body.units || model.defaultUnits);
  const quote = quoteFor(model, requestedUnits);
  const credits = quote.credits;
  const plan = await resolvePlan(supabase, String(profile.plan || "free"));
  await enforceGenerationGuards(supabase, profile, plan, model, quote);

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
      params: {
        scene: String(body.scene || sceneFromPrompt(prompt)),
        pricing: quote,
        pricing_unit: model.pricingUnit,
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
        await ensureSeedData(supabase, userId);
        const plan = await resolvePlan(supabase, String(profile.plan || "free"));
        await enforceMessageLimits(supabase, userId, plan);
        const { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""));
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
        const type = mode === "video" ? "video" : "image";
        const catalog = await pricingCatalog(supabase);
        const model = resolveModelFromCatalog(catalog, String(body.modelId || ""), type);
        const quote = quoteFor(model, type === "video" ? 5 : undefined);
        const willGenerate = shouldGenerateMedia(prompt, mode);

        if (willGenerate && quote.requiresConfirmation && body.confirmed !== true) {
          await enforceGenerationGuards(supabase, profile, plan, model, quote);
          await savePendingGeneration(supabase, profile, {
            body: {
              projectId: project.id,
              prompt,
              type,
              modelId: model.id,
              aspectRatio: body.aspectRatio || "4:5",
              scene: sceneFromPrompt(prompt),
              duration: type === "video" ? quote.units : undefined,
            },
            model: { id: model.id, name: model.name, type: model.type },
            quote,
          });
          send("text", { delta: confirmationMessage(model, quote) });
          send("done", { ok: true, requiresConfirmation: true });
          return;
        }

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
            modelId: body.modelId,
            aspectRatio: body.aspectRatio,
            scene: sceneFromPrompt(prompt),
            duration: type === "video" ? 5 : undefined,
            confirmed: body.confirmed === true || !quote.requiresConfirmation,
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

function demoResultUrl(generation: Record<string, unknown>) {
  if (generation.type === "video") return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
  const prompt = encodeURIComponent(String(generation.prompt || "FLOWTUBE").slice(0, 90));
  return `https://placehold.co/1200x1500/121214/D7F94B/png?text=${prompt}`;
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
      return data;
    }
  }

  const createdAt = new Date(String(generation.created_at)).getTime();
  const readyMs = generation.type === "video" ? 9500 : 6200;
  const progress = Math.min(100, Math.max(5, Math.round(((Date.now() - createdAt) / readyMs) * 100)));
  const patch = progress >= 100
    ? { status: "completed", progress: 100, result_url: demoResultUrl(generation), completed_at: new Date().toISOString() }
    : { status: "running", progress };
  const { data } = await supabase.from("generations").update(patch).eq("id", generation.id).select("*").single();
  if (data?.status === "completed") await debitCredits(supabase, data);
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
    return json({ error: { message: "Not found" } }, 404);
  } catch (err) {
    if (err instanceof FlowtubeError) return json(err.payload, err.status);
    return json({ error: { message: err instanceof Error ? err.message : "Unexpected Edge error" } }, 500);
  }
});
