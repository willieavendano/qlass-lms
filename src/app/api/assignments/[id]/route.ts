import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const post = await prisma.post.findUnique({
    where: { id: params.id },
    include: {
      assignment: {
        include: {
          submissions: {
            where: { studentId: session.user.id },
            include: { grade: true, attachments: true },
          },
          rubric: true,
        },
      },
      attachments: true,
      author: { select: { id: true, name: true, image: true } },
      category: true,
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const membership = await requireClassAccess(session.user.id, post.classId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json({ post, membership });
}
