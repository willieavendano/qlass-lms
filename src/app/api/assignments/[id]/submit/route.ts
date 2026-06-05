import { NextResponse } from "next/server";
import { z } from "zod";
import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

const schema = z.object({
  textResponse: z.string().optional(),
  linkUrl: z.string().url().optional(),
  attachmentIds: z.array(z.string()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    const post = await prisma.post.findUnique({
      where: { id: params.id },
      include: { assignment: true },
    });
    if (!post?.assignment) {
      return NextResponse.json({ error: "Not an assignment" }, { status: 404 });
    }
    const membership = await requireClassAccess(session.user.id, post.classId);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const lateFlag = post.dueDate ? new Date() > post.dueDate : false;
    if (lateFlag && !post.assignment.allowLate) {
      return NextResponse.json(
        { error: "Late submissions not allowed" },
        { status: 400 }
      );
    }

    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentId: {
          assignmentId: post.assignment.id,
          studentId: session.user.id,
        },
      },
      create: {
        assignmentId: post.assignment.id,
        studentId: session.user.id,
        status: SubmissionStatus.TURNED_IN,
        textResponse: data.textResponse,
        linkUrl: data.linkUrl,
        turnedInAt: new Date(),
        isLate: lateFlag,
      },
      update: {
        status: SubmissionStatus.TURNED_IN,
        textResponse: data.textResponse,
        linkUrl: data.linkUrl,
        turnedInAt: new Date(),
        isLate: lateFlag,
      },
      include: { attachments: true, grade: true },
    });

    if (data.attachmentIds?.length) {
      await prisma.attachment.updateMany({
        where: { id: { in: data.attachmentIds }, uploaderId: session.user.id },
        data: { submissionId: submission.id },
      });
    }

    return NextResponse.json({ submission });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Submit failed" }, { status: 500 });
  }
}

export async function DELETE(
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
  const submission = await prisma.submission.findUnique({
    where: {
      assignmentId_studentId: {
        assignmentId: post.assignment.id,
        studentId: session.user.id,
      },
    },
  });
  if (!submission || submission.status === SubmissionStatus.GRADED) {
    return NextResponse.json({ error: "Cannot unsubmit" }, { status: 400 });
  }
  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      status: SubmissionStatus.ASSIGNED,
      turnedInAt: null,
      textResponse: null,
      linkUrl: null,
    },
  });
  return NextResponse.json({ ok: true });
}
