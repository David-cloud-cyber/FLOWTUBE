import { NextResponse } from "next/server";
import { getGeneration, updateGeneration } from "@/lib/db/repository";
import { refreshFalGeneration } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await context.params;
  const generation = await getGeneration(id);

  if (!generation) {
    const type = id.includes("video") ? "video" : id.includes("audio") ? "audio" : "image";
    const resultUrl =
      type === "image"
        ? `https://picsum.photos/seed/${encodeURIComponent(id)}/1200/1500`
        : type === "video"
          ? "https://samplelib.com/lib/preview/mp4/sample-5s.mp4"
          : "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";

    return NextResponse.json({
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
        resultUrl,
        progress: 100,
        credits: 0,
        params: {},
        error: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  }

  if (generation.status === "completed" || generation.status === "failed") {
    return NextResponse.json({ generation });
  }

  const next = await refreshFalGeneration(generation);
  const updated = await updateGeneration(generation.id, next);

  return NextResponse.json({ generation: updated ?? generation });
}
