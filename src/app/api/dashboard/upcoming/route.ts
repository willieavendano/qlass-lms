import { NextResponse } from "next/server";
import { PostStatus, PostType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

export async function GET() {
  const session = await requireSession();
  const memberships = await prisma.classMembership.findMany({
    where: { userId: session.user.id },
    select: { classId: true },
  });
  const classIds = memberships.map((m) => m.classId);
  const posts = await prisma.post.findMany({
    where: {
      classId: { in: classIds },
      type: PostType.ASSIGNMENT,
      status: PostStatus.PUBLISHED,
      dueDate: { gte: new Date() },
    },
    orderBy: { dueDate: "asc" },
    take: 10,
    include: { class: { select: { name: true } } },
  });
  return NextResponse.json({
    upcoming: posts.map((p) => ({
      id: p.id,
      title: p.title,
      dueDate: p.dueDate,
      classId: p.classId,
      className: p.class.name,
    })),
  });
}
