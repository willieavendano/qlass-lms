import { NextResponse } from "next/server";
import { ClassRole, PostType, PostStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";
import {
  buildGradebookCsv,
  type GradebookStudent,
  type GradebookAssignment,
  type GradeLookup,
} from "@/lib/gradebook";

/**
 * Teacher-facing gradebook export. Returns a CSV matrix of students (rows) ×
 * published assignments (columns), plus a running overall percentage of the
 * work each student has been graded on. Intended for reconciling into a
 * school's official gradebook, which stays the system of record during the
 * pilot.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();

  const klass = await prisma.class.findUnique({
    where: { id: params.id },
    select: { id: true, name: true },
  });
  if (!klass) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const membership = await requireClassAccess(session.user.id, klass.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Students (rows), ordered by name for a stable, human-readable export.
  const memberships = await prisma.classMembership.findMany({
    where: { classId: klass.id, role: ClassRole.STUDENT },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const students: GradebookStudent[] = memberships
    .map((m) => m.user)
    .sort((a, b) =>
      (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")
    );

  // Published assignments (columns), chronological.
  const assignmentPosts = await prisma.post.findMany({
    where: {
      classId: klass.id,
      type: PostType.ASSIGNMENT,
      status: PostStatus.PUBLISHED,
    },
    orderBy: { createdAt: "asc" },
    include: {
      assignment: { include: { submissions: { include: { grade: true } } } },
    },
  });

  const assignments: GradebookAssignment[] = assignmentPosts.map((p) => ({
    id: p.id,
    title: p.title,
    points: p.points,
  }));

  // grades[assignmentPostId][studentId] -> { points, max }
  const grades: GradeLookup = new Map();
  for (const post of assignmentPosts) {
    const inner = new Map<string, { points: number; max: number | null }>();
    for (const sub of post.assignment?.submissions ?? []) {
      if (sub.grade && sub.grade.points !== null) {
        inner.set(sub.studentId, {
          points: sub.grade.points,
          // Fall back to the assignment's own points if the grade omits a max.
          max: sub.grade.maxPoints ?? post.points ?? null,
        });
      }
    }
    grades.set(post.id, inner);
  }

  const csv = buildGradebookCsv(students, assignments, grades);

  const slug =
    klass.name
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "class";
  const date = new Date().toISOString().slice(0, 10);
  const filename = `${slug}-grades-${date}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
