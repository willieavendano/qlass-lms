import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole, NotificationType, PostStatus, PostType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

const schema = z.object({
  classId: z.string(),
  title: z.string().min(1),
  instructions: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  points: z.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  publish: z.boolean().optional(),
  allowLate: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    const membership = await requireClassAccess(session.user.id, data.classId, [
      ClassRole.OWNER,
      ClassRole.TEACHER,
    ]);
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const post = await prisma.post.create({
      data: {
        classId: data.classId,
        authorId: session.user.id,
        type: PostType.ASSIGNMENT,
        status: data.publish ? PostStatus.PUBLISHED : PostStatus.DRAFT,
        title: data.title,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        points: data.points ?? 100,
        categoryId: data.categoryId,
        publishedAt: data.publish ? new Date() : null,
        assignment: {
          create: {
            instructions: data.instructions,
            allowLate: data.allowLate ?? true,
          },
        },
      },
      include: { assignment: true, category: true },
    });
    if (data.publish) {
      const students = await prisma.classMembership.findMany({
        where: {
          classId: data.classId,
          userId: { not: session.user.id },
          role: ClassRole.STUDENT,
        },
        select: { userId: true },
      });
      await prisma.notification.createMany({
        data: students.map((s) => ({
          userId: s.userId,
          type: NotificationType.ASSIGNMENT_DUE,
          title: `New assignment: ${post.title}`,
          body: post.dueDate
            ? `Due ${post.dueDate.toLocaleDateString()}`
            : undefined,
          link: `/class/${data.classId}/assignments/${post.id}`,
        })),
      });
    }
    return NextResponse.json({ post }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}
