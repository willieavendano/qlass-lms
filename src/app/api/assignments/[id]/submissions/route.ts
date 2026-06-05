import { NextResponse } from "next/server";
import { ClassRole } from "@prisma/client";
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
    include: { assignment: true },
  });
  if (!post?.assignment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const membership = await requireClassAccess(session.user.id, post.classId, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const students = await prisma.classMembership.findMany({
    where: { classId: post.classId, role: ClassRole.STUDENT },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  const submissions = await prisma.submission.findMany({
    where: { assignmentId: post.assignment.id },
    include: {
      student: { select: { id: true, name: true, email: true, image: true } },
      grade: true,
      attachments: true,
    },
  });
  const submissionMap = new Map(submissions.map((s) => [s.studentId, s]));
  const queue = students.map((m) => ({
    student: m.user,
    submission: submissionMap.get(m.user.id) ?? null,
  }));
  return NextResponse.json({ post, queue });
}
