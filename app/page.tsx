import { ChatShell } from "@/components/chat-shell";
import {
  getCurrentUser,
  getOrCreateConversation,
  listGenerationsForMessages,
  listMessages,
  listProjects
} from "@/lib/db/repository";
import { listModels } from "@/lib/models";
import { estimateCredits } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getCurrentUser();
  const { project, conversation } = await getOrCreateConversation(user.id);
  const [projects, messages] = await Promise.all([
    listProjects(user.id),
    listMessages(conversation.id, 50)
  ]);
  const generations = await listGenerationsForMessages(messages.map((message) => message.id));
  const models = listModels().map((model) => {
    const { falEndpoint: _falEndpoint, ...safeModel } = model;
    return {
      ...safeModel,
      credits: estimateCredits(model)
    };
  });

  return (
    <ChatShell
      user={user}
      projects={projects.length ? projects : [project]}
      initialProjectId={project.id}
      initialConversationId={conversation.id}
      initialMessages={messages}
      initialGenerations={generations}
      models={models}
    />
  );
}
