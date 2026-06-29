import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCurrentUser, getOrCreateConversation, listMessages, listProjects } from "../server/db/repository";
import { listModels } from "../server/models";
import { estimateCredits } from "../server/pricing";

export default async function handler(_: VercelRequest, res: VercelResponse) {
  const user = await getCurrentUser();
  const { project, conversation } = await getOrCreateConversation(user.id);
  const projects = await listProjects(user.id);
  const messages = await listMessages(conversation.id);
  const models = listModels().map(({ falEndpoint: _falEndpoint, ...model }) => ({
    ...model,
    credits: estimateCredits({ ...model, falEndpoint: "" })
  }));

  res.status(200).json({
    user,
    projects: projects.length ? projects : [project],
    conversation,
    messages,
    models
  });
}
