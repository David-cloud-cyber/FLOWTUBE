import { NextResponse } from "next/server";
import { getGeneration, updateGeneration } from "@/lib/db/repository";
import { refreshFalGeneration } from "@/lib/fal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, context: { params: { id: string } | Promise<{ id: string }> }) {
  const { id } = await context.params;
  const generation = await getGeneration(id);

  if (!generation) {
    return NextResponse.json({ error: "Génération introuvable" }, { status: 404 });
  }

  if (generation.status === "completed" || generation.status === "failed") {
    return NextResponse.json({ generation });
  }

  const next = await refreshFalGeneration(generation);
  const updated = await updateGeneration(generation.id, next);

  return NextResponse.json({ generation: updated ?? generation });
}
