import { NextResponse } from "next/server";
import { z } from "zod";
import { runCreativeAgent } from "@/lib/agent/anthropic";
import {
  getCurrentUser,
  getOrCreateConversation,
  listMessages,
  saveMessage
} from "@/lib/db/repository";
import type { Generation } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const chatSchema = z.object({
  message: z.string().min(1).max(8000),
  projectId: z.string().optional(),
  conversationId: z.string().optional(),
  aspectRatio: z.string().optional(),
  modelId: z.string().optional()
});

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function streamText(text: string, enqueue: (chunk: string) => void) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (const part of parts) {
    enqueue(sse("text", { delta: part }));
  }
}

export async function POST(request: Request) {
  const parsed = chatSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message invalide" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (chunk: string) => controller.enqueue(encoder.encode(chunk));

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

        enqueue(sse("user_message", { message: userMessage, conversationId: conversation.id }));

        const history = await listMessages(conversation.id, 18);
        const generations: Generation[] = [];
        const result = await runCreativeAgent(parsed.data.message, history, {
          userId: user.id,
          messageId: userMessage.id,
          preferredAspectRatio: parsed.data.aspectRatio,
          onGeneration: async (generation) => {
            generations.push(generation);
            enqueue(sse("generation", { generation }));
          }
        });

        const assistantMessage = await saveMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: result.text
        });

        streamText(result.text, enqueue);
        enqueue(sse("done", { assistantMessage, generations, credits: user.credits }));
      } catch (error) {
        enqueue(
          sse("error", {
            message: error instanceof Error ? error.message : "Erreur serveur inconnue"
          })
        );
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
