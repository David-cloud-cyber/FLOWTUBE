import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createProject, getCurrentUser, listProjects } from "../server/db/repository";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getCurrentUser();

  if (req.method === "POST") {
    const title = typeof req.body?.title === "string" ? req.body.title : "Nouveau projet";
    const result = await createProject(user.id, title);
    res.status(201).json(result);
    return;
  }

  const projects = await listProjects(user.id);
  res.status(200).json({ user, projects });
}
