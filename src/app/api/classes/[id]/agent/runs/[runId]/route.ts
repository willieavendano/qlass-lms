import { NextResponse } from "next/server";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { id: string; runId: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const run = await prisma.agentRun.findFirst({
    where: { id: params.runId, classId: params.id },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ run });
}
