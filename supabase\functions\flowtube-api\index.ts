import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.108.2";
import { fal } from "npm:@fal-ai/client@1.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://fuvrxobxjcqyevsjsdfd.supabase.co";
const DEMO_USER_ID = Deno.env.get("FLOWTUBE_DEMO_USER_ID") || "00000000-0000-0000-0000-000000000001";
const DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-opus-4-8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-flowtube-secret",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const modelRegistry = [
  { id: "nano", name: "Nano Banana Pro", type: "image", endpoint: Deno.env.get("FAL_MODEL_NANO") || "fal-ai/nano-banana-pro", costUsd: 0.15 },
  { id: "flux", name: "Flux", type: "image", endpoint: Deno.env.get("FAL_MODEL_FLUX") || "fal-ai/flux/schnell", costUsd: 0.04 },
  { id: "veoq", name: "Veo 3.1 Quality", type: "video", endpoint: Deno.env.get("FAL_MODEL_VEO_QUALITY") || "fal-ai/veo3", costPerSecondUsd: 0.2, duration: 5 },
  { id: "veol", name: "Veo 3.1 Lite", type: "video", endpoint: Deno.env.get("FAL_MODEL_VEO_LITE") || "fal-ai/veo3/fast", costPerSecondUsd: 0.1, duration: 5 },
  { id: "kling", name: "Kling", type: "video", endpoint: Deno.env.get("FAL_MODEL_KLING") || "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", costPerSecondUsd: 0.12, duration: 5 },
  { id: "seedance", name: "Seedance", type: "video", endpoint: Deno.env.get("FAL_MODEL_SEEDANCE") || "fal-ai/bytedance/seedance/v1/lite/text-to-video", costPerSecondUsd: 0.08, duration: 5 },
];

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

function resolveModel(modelId: string | undefined, type: string) {
  return modelRegistry.find((m) => m.id === modelId && m.type === type)
    || modelRegistry.find((m) => m.type === type)
    || modelRegistry[0];
}

function creditsFor(model: Record<string, unknown>, duration?: number) {
  const cost = model.type === "video"
    ? Number(model.costPerSecondUsd || 0.1) * Number(duration || model.duration || 5)
    : Number(model.costUsd || 0.04);
  return Math.ceil((cost * 3.5) / 0.008);
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
  return json({
    user: { id: profile.id, name: profile.display_name, email: profile.email, plan: profile.plan },
    credits: profile.credits,
    creditsMax: profile.credits_max,
    models: modelRegistry.map((model) => ({ id: model.id, name: model.name, type: model.type, credits: creditsFor(model) })),
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

function falInput(model: Record<string, unknown>, prompt: string, aspectRatio: string, duration: number) {
  if (model.type === "video") {
    return { prompt, aspect_ratio: aspectRatio, duration: String(duration) };
  }
  return { prompt, aspect_ratio: aspectRatio, num_images: 1 };
}

async function startFalGeneration(generation: Record<string, unknown>, model: Record<string, unknown>) {
  const key = Deno.env.get("FAL_KEY");
  const supabase = adminClient();
  if (!key) {
    await supabase.from("generations").update({ status: "running", provider_payload: { demo: true } }).eq("id", generation.id);
    return;
  }
  try {
    fal.config({ credentials: key });
    const request = await fal.queue.submit(String(model.endpoint), {
      input: falInput(model, String(generation.prompt || ""), String(generation.aspect_ratio || "4:5"), Number(generation.duration_seconds || 5)),
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

async function createGeneration(req: Request, body: Record<string, unknown>, assistantText?: string) {
  const supabase = adminClient();
  const userId = await userIdFromRequest(req, supabase);
  await ensureProfile(supabase, userId);
  await ensureSeedData(supabase, userId);

  const prompt = String(body.prompt || body.message || "");
  const type = String(body.type || body.mode || "image") === "video" ? "video" : "image";
  const duration = Number(body.duration || 5);
  const model = resolveModel(String(body.modelId || ""), type);
  const credits = creditsFor(model, duration);
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
      prompt,
      aspect_ratio: String(body.aspectRatio || "4:5"),
      duration_seconds: type === "video" ? duration : null,
      progress: 1,
      credits,
      cost_usd: model.type === "video" ? Number(model.costPerSecondUsd || 0.1) * duration : Number(model.costUsd || 0.04),
      params: { scene: String(body.scene || sceneFromPrompt(prompt)) },
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
  const mode = String(body.mode || "image");
  const type = mode === "video" ? "video" : "image";
  const model = resolveModel(String(body.modelId || ""), type);
  const credits = creditsFor(model, type === "video" ? 5 : undefined);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start: async (controller) => {
      const send = (event: string, payload: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`));
      try {
        const supabase = adminClient();
        const userId = await userIdFromRequest(req, supabase);
        await ensureProfile(supabase, userId);
        await ensureSeedData(supabase, userId);
        const { project, conversation } = await resolveProjectAndConversation(supabase, userId, String(body.projectId || ""));
        await supabase.from("messages").insert({
          user_id: userId,
          project_id: project.id,
          conversation_id: conversation.id,
          role: "user",
          content: prompt,
        });

        const reply = await anthropicReply(prompt, type, credits);
        for (const word of reply.split(/(\s+)/)) {
          if (word) send("text", { delta: word });
          await new Promise((resolve) => setTimeout(resolve, 8));
        }

        if (shouldGenerateMedia(prompt, mode)) {
          const result = await createGeneration(req, {
            projectId: project.id,
            prompt,
            type,
            modelId: body.modelId,
            aspectRatio: body.aspectRatio,
            scene: sceneFromPrompt(prompt),
            duration: type === "video" ? 5 : undefined,
          }, reply);
          send("generation", result.generation);
        }
        const { data: profile } = await supabase.from("profiles").select("credits").eq("id", userId).single();
        send("credits", { credits: profile?.credits ?? 0 });
        send("done", { ok: true });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Chat failed" });
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
  await supabase.from("profiles").update({ credits: nextCredits }).eq("id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    generation_id: generation.id,
    amount: -credits,
    reason: "generation_completed",
    balance_after: nextCredits,
  });
  await supabase.from("generations").update({ debited_at: new Date().toISOString() }).eq("id", generation.id);
}

async function syncGeneration(supabase: ReturnType<typeof adminClient>, generation: Record<string, unknown>) {
  if (generation.status === "completed" || generation.status === "failed") return generation;
  const key = Deno.env.get("FAL_KEY");
  if (key && generation.fal_job_id) {
    try {
      fal.config({ credentials: key });
      const model = resolveModel(String(generation.model_id), String(generation.type));
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
    return json({ error: { message: err instanceof Error ? err.message : "Unexpected Edge error" } }, 500);
  }
});
