import { NextResponse } from "next/server";
import { listModels } from "@/lib/models";
import { estimateCredits } from "@/lib/pricing";
import type { ModelType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = (url.searchParams.get("type") || undefined) as ModelType | undefined;
  const models = listModels(type).map((model) => ({
    ...model,
    falEndpoint: undefined,
    credits: estimateCredits(model)
  }));

  return NextResponse.json({ models });
}
