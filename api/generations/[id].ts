import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getGeneration, updateGeneration } from "../../server/db/repository";
import { demoResultUrl, refreshGeneration } from "../../server/fal";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = String(req.query.id ?? "");
  const generation = await getGeneration(id);

  if (!generation) {
    const type = id.includes("video") ? "video" : id.includes("audio") ? "audio" : "image";
    res.status(200).json({
      generation: {
        id,
        messageId: "demo",
        userId: "demo-user",
        type,
        model: "demo",
        prompt: "Génération démo",
        aspectRatio: "4:5",
        status: "completed",
        falJobId: `mock:${type}:${id}`,
        resultUrl: demoResultUrl(type, id),
        progress: 100,
        credits: 0,
        params: {},
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
    return;
  }

  if (generation.status === "completed" || generation.status === "failed") {
    res.status(200).json({ generation });
    return;
  }

  const patch = await refreshGeneration(generation);
  const updated = await updateGeneration(generation.id, patch);
  res.status(200).json({ generation: updated ?? generation });
}
