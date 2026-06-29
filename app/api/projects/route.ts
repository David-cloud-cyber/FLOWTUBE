import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject, getCurrentUser, listProjects } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(80).optional()
});

export async function GET() {
  const user = await getCurrentUser();
  const projects = await listProjects(user.id);
  return NextResponse.json({ user, projects });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  const result = await createProject(user.id, parsed.success ? parsed.data.title : undefined);
  return NextResponse.json(result, { status: 201 });
}
