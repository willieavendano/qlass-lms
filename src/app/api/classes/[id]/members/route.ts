import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const classroom = await prisma.class.findUnique({
    where: { id: params.id },
    select: { joinCode: true },
  });
  const members = await prisma.classMembership.findMany({
    where: { classId: params.id },
    include: {
      user: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
  });
  return NextResponse.json({
    members,
    joinCode: membership.role === "OWNER" || membership.role === "TEACHER"
      ? classroom?.joinCode
      : undefined,
  });
}
