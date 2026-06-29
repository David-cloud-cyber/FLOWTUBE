import Anthropic from "@anthropic-ai/sdk";
import { executeTool, anthropicTools, type ToolContext } from "./tools";
import { systemPrompt } from "./systemPrompt";
import type { Message } from "../types";

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const wantsImage = (text: string) => /\b(image|visuel|affiche|photo|poster|logo|illustration)\b/i.test(text);
const wantsVideo = (text: string) => /\b(vid[eé]o|clip|animer|animate|motion|reel|story)\b/i.test(text);
const wantsVoice = (text: string) => /\b(voix|voice|audio|tts|narration|doublage)\b/i.test(text);
const confirmed = (text: string) => /\b(confirme|confirm[eé]|ok|vas-y|lance)\b/i.test(text);

async function demoAgent(input: string, context: ToolContext) {
  const text = input.trim();

  if (wantsVideo(text) && !confirmed(text)) {
    const estimate = await executeTool(
      "generate_video",
      { prompt: text, aspect_ratio: context.preferredAspectRatio ?? "9:16", duration: 5, confirmed: false },
      context
    );
    const credits =
      typeof estimate === "object" && estimate && "credits" in estimate
        ? Number((estimate as { credits?: number }).credits)
        : 263;
    return `Je peux lancer un clip court au format 9:16. Coût estimé: ${credits} crédits. Confirme et je le lance.`;
  }

  if (wantsVideo(text)) {
    await executeTool(
      "generate_video",
      { prompt: text, aspect_ratio: context.preferredAspectRatio ?? "9:16", duration: 5, confirmed: true },
      context
    );
    return "Je lance la vidéo courte avec un modèle rapide et rentable. La carte média suit la progression.";
  }

  if (wantsVoice(text)) {
    await executeTool("generate_voice", { text, model: "dia-tts" }, context);
    return "Je prépare une voix off naturelle. La carte audio apparaîtra dès que le job sera prêt.";
  }

  if (wantsImage(text)) {
    await executeTool(
      "generate_image",
      { prompt: text, aspect_ratio: context.preferredAspectRatio ?? "4:5", model: "seedream-lite" },
      context
    );
    return "Je lance une image 4:5 en modèle économique. Ensuite on pourra l’animer, l’éditer ou recréer une variante.";
  }

  return "Je peux structurer ça en concept, storyboard ou production. Donne-moi le format cible, ou je pars sur 4:5.";
}

function toMessages(history: Message[], input: string) {
  return [
    ...history.slice(-16).map((message) => ({
      role: message.role,
      content: message.content
    })),
    { role: "user", content: input }
  ];
}

function textFrom(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && typeof block === "object" && (block as { type?: string }).type === "text")
    .map((block) => String((block as { text?: string }).text ?? ""))
    .join("");
}

function toolUsesFrom(content: unknown) {
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block && typeof block === "object" && (block as { type?: string }).type === "tool_use");
}

export async function runAgent(input: string, history: Message[], context: ToolContext) {
  const client = getClient();
  if (!client) return demoAgent(input, context);

  const messages: any[] = toMessages(history, input);
  let finalText = "";

  for (let step = 0; step < 4; step += 1) {
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-8",
      max_tokens: 1800,
      system: systemPrompt,
      messages,
      tools: anthropicTools as any
    } as any);

    finalText += textFrom(response.content);
    const toolUses = toolUsesFrom(response.content);
    if (!toolUses.length) return finalText.trim() || "C’est prêt.";

    messages.push({ role: "assistant", content: response.content });
    const toolResults = [];

    for (const toolUse of toolUses) {
      const tool = toolUse as { id: string; name: string; input: Record<string, unknown> };
      const result = await executeTool(tool.name, tool.input ?? {}, context);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tool.id,
        content: JSON.stringify(result)
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return finalText.trim() || "J’ai lancé les opérations. Les jobs longs continuent en arrière-plan.";
}
