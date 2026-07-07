import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole, NotificationType, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { notifyUsers } from "@/lib/notify";

const schema = z
  .object({
    points: z.number().min(0).optional(),
    maxPoints: z.number().min(0).optional(),
    feedback: z.string().optional(),
    privateComment: z.string().optional(),
    returnToStudent: z.boolean().optional(),
  })
  .refine(
    (d) => d.points == null || d.maxPoints == null || d.points <= d.maxPoints,
    { message: "points cannot exceed maxPoints", path: ["points"] }
  );

export async function PATCH(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    const submission = await prisma.submission.findUnique({
      where: { id: params.submissionId },
      include: {
        assignment: { include: { post: true } },
        student: true,
      },
    });
    if (!submission) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const membership = await prisma.classMembership.findUnique({
      where: {
        classId_userId: {
          classId: submission.assignment.post.classId,
          userId: session.user.id,
        },
      },
    });
    if (
      !membership ||
      (membership.role !== ClassRole.OWNER &&
        membership.role !== ClassRole.TEACHER)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const grade = await prisma.grade.upsert({
      where: { submissionId: submission.id },
      create: {
        submissionId: submission.id,
        graderId: session.user.id,
        points: data.points,
        maxPoints: data.maxPoints ?? submission.assignment.post.points ?? 100,
        feedback: data.feedback,
        privateComment: data.privateComment,
        returnedAt: data.returnToStudent ? new Date() : null,
      },
      update: {
        points: data.points,
        maxPoints: data.maxPoints,
        feedback: data.feedback,
        privateComment: data.privateComment,
        returnedAt: data.returnToStudent ? new Date() : undefined,
      },
    });

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: data.returnToStudent
          ? SubmissionStatus.RETURNED
          : SubmissionStatus.GRADED,
      },
    });

    await notifyUsers([submission.studentId], {
      type: NotificationType.GRADE_POSTED,
      title: `Grade posted: ${submission.assignment.post.title}`,
      body: data.points != null ? `${data.points} points` : undefined,
      link: `/class/${submission.assignment.post.classId}/assignments/${submission.assignment.postId}`,
    });

    return NextResponse.json({ grade });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Grade failed" }, { status: 500 });
  }
}
