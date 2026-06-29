import Anthropic from "@anthropic-ai/sdk";
import { executeTool, anthropicTools } from "@/lib/agent/tools";
import { systemPrompt } from "@/lib/agent/system-prompt";
import type { Generation, Message } from "@/lib/types";

type AgentContext = {
  userId: string;
  messageId: string;
  preferredAspectRatio?: string;
  onGeneration?: (generation: Generation) => void | Promise<void>;
};

type AgentResult = {
  text: string;
};

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function wantsImage(text: string) {
  return /\b(image|visuel|affiche|photo|poster|logo|illustration)\b/i.test(text);
}

function wantsVideo(text: string) {
  return /\b(vid[eé]o|clip|animer|animate|motion|reel|story)\b/i.test(text);
}

function wantsVoice(text: string) {
  return /\b(voix|voice|audio|tts|narration|doublage)\b/i.test(text);
}

async function runDemoAgent(input: string, context: AgentContext): Promise<AgentResult> {
  const normalized = input.trim();

  if (wantsVideo(normalized) && !/\b(confirme|confirm[eé]|ok|lance)\b/i.test(normalized)) {
    const estimate = await executeTool(
      "generate_video",
      {
        prompt: normalized,
        aspect_ratio: context.preferredAspectRatio ?? "9:16",
        duration: 5,
        confirmed: false
      },
      context
    );
    const credits =
      typeof estimate === "object" && estimate && "credits" in estimate
        ? Number((estimate as { credits?: number }).credits)
        : null;

    return {
      text: credits
        ? `Je peux lancer un clip 9:16 de 5 s en modèle rapide. Coût estimé: ${credits} crédits. Confirme et je le lance.`
        : "Je peux préparer la vidéo. Confirme le lancement et le format."
    };
  }

  if (wantsVideo(normalized)) {
    await executeTool(
      "generate_video",
      {
        prompt: normalized,
        aspect_ratio: context.preferredAspectRatio ?? "9:16",
        duration: 5,
        confirmed: true
      },
      context
    );

    return {
      text:
        "Je lance un clip court au format 9:16, avec un rendu fluide et économique. La carte média va suivre la progression."
    };
  }

  if (wantsVoice(normalized)) {
    await executeTool(
      "generate_voice",
      {
        text: normalized,
        model: "dia-tts"
      },
      context
    );

    return {
      text: "Je prépare une voix off claire et naturelle. La carte audio apparaîtra dès que le job sera prêt."
    };
  }

  if (wantsImage(normalized)) {
    await executeTool(
      "generate_image",
      {
        prompt: normalized,
        aspect_ratio: context.preferredAspectRatio ?? "4:5",
        model: "seedream-lite"
      },
      context
    );

    return {
      text:
        "Je lance une image 4:5 en modèle économique, avec un rendu prêt pour réseaux sociaux. Ensuite on pourra l'animer ou la retoucher."
    };
  }

  return {
    text:
      "Je te propose de structurer ça en trois pistes: une direction visuelle premium, une version réseaux sociaux rapide, et une déclinaison vidéo. Donne-moi le format cible ou confirme que je pars sur 4:5."
  };
}

function toAnthropicMessages(history: Message[], input: string) {
  const recent = history.slice(-16).map((message) => ({
    role: message.role,
    content: message.content
  }));

  return [...recent, { role: "user", content: input }];
}

function extractText(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((block) => block && typeof block === "object" && (block as { type?: string }).type === "text")
    .map((block) => String((block as { text?: string }).text ?? ""))
    .join("");
}

function extractToolUses(content: unknown) {
  if (!Array.isArray(content)) return [];
  return content.filter((block) => block && typeof block === "object" && (block as { type?: string }).type === "tool_use");
}

export async function runCreativeAgent(input: string, history: Message[], context: AgentContext): Promise<AgentResult> {
  const client = getAnthropicClient();
  if (!client) return runDemoAgent(input, context);

  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const messages: any[] = toAnthropicMessages(history, input);
  let finalText = "";

  for (let step = 0; step < 4; step += 1) {
    const response = await client.messages.create({
      model,
      max_tokens: 1800,
      system: systemPrompt,
      messages,
      tools: anthropicTools as any
    } as any);

    const text = extractText(response.content);
    finalText += text;
    const toolUses = extractToolUses(response.content);

    if (!toolUses.length) {
      return { text: finalText.trim() || "C'est prêt." };
    }

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

  return {
    text:
      finalText.trim() ||
      "J'ai préparé les opérations demandées. Certaines actions longues continuent en arrière-plan."
  };
}
