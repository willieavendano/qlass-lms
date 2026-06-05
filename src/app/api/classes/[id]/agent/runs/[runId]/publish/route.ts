import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole, NotificationType, PostStatus, PostType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";
import { unitDraftsSchema } from "@/lib/agent/schemas";

// The teacher may edit/trim drafts client-side, so accept the final drafts in the body.
const schema = z.object({ drafts: unitDraftsSchema });

export async function POST(
  req: Request,
  { params }: { params: { id: string; runId: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { drafts } = schema.parse(await req.json());
    const run = await prisma.agentRun.findFirst({
      where: { id: params.runId, classId: params.id },
    });
    if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const created: string[] = [];
    for (const a of drafts.assignments) {
      const instructions = `${a.instructions}\n\nQuestions:\n${a.questions
        .map((q, i) => `${i + 1}. ${q}`)
        .join("\n")}`;
      const post = await prisma.post.create({
        data: {
          classId: params.id,
          authorId: session.user.id,
          type: PostType.ASSIGNMENT,
          status: PostStatus.PUBLISHED,
          title: a.title,
          points: a.points,
          aiGenerated: true,
          publishedAt: new Date(),
          assignment: { create: { instructions } },
        },
      });
      created.push(post.id);
    }

    // The explainer material as a MATERIAL post.
    await prisma.post.create({
      data: {
        classId: params.id,
        authorId: session.user.id,
        type: PostType.MATERIAL,
        status: PostStatus.PUBLISHED,
        title: drafts.material.title,
        content: drafts.material.body,
        aiGenerated: true,
        publishedAt: new Date(),
      },
    });

    // Notify students of the new assignments.
    const students = await prisma.classMembership.findMany({
      where: { classId: params.id, role: ClassRole.STUDENT },
      select: { userId: true },
    });
    if (students.length && created.length) {
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.userId,
          type: NotificationType.ASSIGNMENT_DUE,
          title: `New classwork in your class`,
          body: `${created.length} new assignment(s) published`,
          link: `/class/${params.id}/classwork`,
        })),
      });
    }

    const updated = await prisma.agentRun.update({
      where: { id: run.id },
      data: { status: "PUBLISHED" },
    });
    return NextResponse.json({ run: updated, createdPostIds: created });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
