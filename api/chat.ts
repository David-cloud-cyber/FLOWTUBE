import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { runAgent } from "../server/agent/anthropic";
import {
  getCurrentUser,
  getOrCreateConversation,
  listMessages,
  saveMessage
} from "../server/db/repository";
import type { Generation } from "../server/types";

const schema = z.object({
  message: z.string().min(1).max(8000),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  aspectRatio: z.string().optional(),
  modelId: z.string().optional()
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function writeText(text: string, res: VercelResponse) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const delta of parts) res.write(sse("text", { delta }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non supportée" });
    return;
  }

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message invalide" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  try {
    const user = await getCurrentUser();
    const { conversation } = await getOrCreateConversation(
      user.id,
      parsed.data.projectId,
      parsed.data.conversationId
    );
    const userMessage = await saveMessage({
      conversationId: conversation.id,
      role: "user",
      content: parsed.data.message
    });
    res.write(sse("user_message", { message: userMessage, conversationId: conversation.id }));

    const history = await listMessages(conversation.id);
    const generations: Generation[] = [];
    const text = await runAgent(parsed.data.message, history, {
      userId: user.id,
      messageId: userMessage.id,
      preferredAspectRatio: parsed.data.aspectRatio,
      onGeneration: async (generation) => {
        generations.push(generation);
        res.write(sse("generation", { generation }));
      }
    });

    const assistantMessage = await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: text
    });
    writeText(text, res);
    res.write(sse("done", { assistantMessage, generations, credits: user.credits }));
  } catch (error) {
    res.write(
      sse("error", {
        message: error instanceof Error ? error.message : "Erreur serveur inconnue"
      })
    );
  } finally {
    res.end();
  }
}
