import { NextResponse } from "next/server";
import { PostStatus, PostType } from "@prisma/client";
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
  const posts = await prisma.post.findMany({
    where: {
      classId: params.id,
      type: { in: [PostType.ASSIGNMENT, PostType.QUESTION, PostType.MATERIAL] },
      status: { in: [PostStatus.PUBLISHED, PostStatus.DRAFT] },
    },
    orderBy: [{ category: { order: "asc" } }, { dueDate: "asc" }],
    include: {
      category: true,
      assignment: {
        include: { _count: { select: { submissions: true } } },
      },
    },
  });
  const categories = await prisma.assignmentCategory.findMany({
    where: { classId: params.id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ posts, categories });
}
