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
    include: {
      categories: { orderBy: { order: "asc" } },
      _count: { select: { memberships: true, posts: true } },
    },
  });
  if (!classroom) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ class: classroom, membership });
}
