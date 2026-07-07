import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { planClassDeletion } from "@/lib/export";

const schema = z.object({ confirmEmail: z.string().email() });

/** Deletes the signed-in user's account and their data.
 *
 *  Refuses (409) when deletion would destroy other people's data:
 *  - classes the user solely owns that still have other members
 *  - grades the user gave in classes that survive the deletion
 *
 *  Known limitation: uploaded storage objects are not garbage-collected yet
 *  (attachment rows are deleted; the storage layer has no delete primitive).
 */
export async function DELETE(req: Request) {
  const session = await requireSession();
  const userId = session.user.id;

  try {
    const { confirmEmail } = schema.parse(await req.json());
    if (confirmEmail.toLowerCase() !== session.user.email?.toLowerCase()) {
      return NextResponse.json(
        { error: "Confirmation email does not match your account." },
        { status: 400 }
      );
    }

    const ownedMemberships = await prisma.classMembership.findMany({
      where: { userId, role: ClassRole.OWNER },
      select: { class: { select: { id: true, name: true } } },
    });
    const owned = await Promise.all(
      ownedMemberships.map(async (m) => {
        const [otherOwnerCount, otherMemberCount] = await Promise.all([
          prisma.classMembership.count({
            where: { classId: m.class.id, role: ClassRole.OWNER, userId: { not: userId } },
          }),
          prisma.classMembership.count({
            where: { classId: m.class.id, userId: { not: userId } },
          }),
        ]);
        return { ...m.class, otherOwnerCount, otherMemberCount };
      })
    );
    const plan = planClassDeletion(owned);
    if (plan.blockingClasses.length > 0) {
      return NextResponse.json(
        {
          error:
            "You are the only owner of classes that still have members. Transfer ownership or remove members first.",
          blockingClasses: plan.blockingClasses,
        },
        { status: 409 }
      );
    }

    // Grades this user gave that live outside the classes being removed would
    // be destroyed by deleting the grader — refuse rather than lose students' grades.
    const survivingGrades = await prisma.grade.count({
      where: {
        graderId: userId,
        submission: {
          assignment: {
            post: { classId: { notIn: plan.removableClassIds } },
          },
        },
      },
    });
    if (survivingGrades > 0) {
      return NextResponse.json(
        {
          error:
            "You have posted grades in classes that would remain. Ask an admin to delete your account.",
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      // Cascades posts, memberships, submissions, categories, etc. within.
      prisma.class.deleteMany({ where: { id: { in: plan.removableClassIds } } }),
      // Replies to these comments have their parentId set null automatically.
      prisma.comment.deleteMany({ where: { authorId: userId } }),
      prisma.submission.deleteMany({ where: { studentId: userId } }),
      prisma.attachment.deleteMany({ where: { uploaderId: userId } }),
      prisma.agentRun.deleteMany({ where: { userId } }),
      prisma.post.deleteMany({ where: { authorId: userId } }),
      // Cascades memberships, notifications, sessions, accounts, AI settings.
      prisma.user.delete({ where: { id: userId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    console.error("[me] account deletion failed:", e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
