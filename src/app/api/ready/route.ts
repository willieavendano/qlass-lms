import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Readiness probe: unlike /api/health (liveness), this verifies the app can
// actually reach the database. Use it for dashboards/alerts, not as the
// deploy healthcheck (which should stay DB-free so deploys aren't blocked by
// a transient DB blip).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("db timeout")), 3000)
      ),
    ]);
    return NextResponse.json({ ready: true });
  } catch {
    return NextResponse.json(
      { ready: false, error: "database unreachable" },
      { status: 503 }
    );
  }
}
