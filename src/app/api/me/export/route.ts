import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { buildUserExport } from "@/lib/export";

export const dynamic = "force-dynamic";

/** Downloads everything Qlass stores about the signed-in user as JSON. */
export async function GET() {
  const session = await requireSession();
  const userId = session.user.id;

  const [user, memberships, posts, submissions, comments, notifications] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          systemRole: true,
          emailDigest: true,
          createdAt: true,
        },
      }),
      prisma.classMembership.findMany({
        where: { userId },
        select: {
          role: true,
          joinedAt: true,
          class: { select: { id: true, name: true } },
        },
      }),
      prisma.post.findMany({
        where: { authorId: userId },
        select: {
          id: true,
          classId: true,
          type: true,
          status: true,
          title: true,
          content: true,
          aiGenerated: true,
          createdAt: true,
        },
      }),
      prisma.submission.findMany({
        where: { studentId: userId },
        select: {
          id: true,
          status: true,
          turnedInAt: true,
          assignment: { select: { post: { select: { title: true, classId: true } } } },
          grade: { select: { points: true, maxPoints: true, feedback: true } },
          attachments: { select: { fileName: true, mimeType: true, size: true } },
        },
      }),
      prisma.comment.findMany({
        where: { authorId: userId },
        select: { id: true, content: true, createdAt: true },
      }),
      prisma.notification.findMany({
        where: { userId },
        select: { type: true, title: true, body: true, read: true, createdAt: true },
      }),
    ]);

  const doc = buildUserExport({
    generatedAt: new Date(),
    profile: user,
    memberships,
    authoredPosts: posts,
    submissions: submissions.map((s) => ({
      id: s.id,
      status: s.status,
      turnedInAt: s.turnedInAt,
      assignmentTitle: s.assignment.post.title,
      classId: s.assignment.post.classId,
      grade: s.grade,
      attachments: s.attachments,
    })),
    comments,
    notifications,
  });

  return new NextResponse(JSON.stringify(doc, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="qlass-export-${
        new Date().toISOString().slice(0, 10)
      }.json"`,
    },
  });
}
