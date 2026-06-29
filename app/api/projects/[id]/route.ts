import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getOrCreateConversation,
  listGenerationsForMessages,
  listMessages
} from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const { project, conversation } = await getOrCreateConversation(user.id, id);
  const messages = await listMessages(conversation.id, 50);
  const generations = await listGenerationsForMessages(messages.map((message) => message.id));

  return NextResponse.json({
    project,
    conversation,
    messages,
    generations
  });
}
