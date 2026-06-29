import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    app: "FlowTube",
    hasAnthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    hasFal: Boolean(process.env.FAL_KEY),
    hasDatabase: Boolean(process.env.DATABASE_URL)
  });
}
