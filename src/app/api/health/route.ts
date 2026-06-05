import { NextResponse } from "next/server";

// Lightweight liveness probe for Railway (and any other host) healthchecks.
// Intentionally does no DB work so it stays fast and green during deploys.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true });
}
