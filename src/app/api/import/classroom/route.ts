import { NextResponse } from "next/server";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { getClassroomClient, GoogleNotConnectedError } from "@/lib/google";
import { isDemoMode, listDemoCourses } from "@/lib/classroom-demo";

/**
 * GET /api/import/classroom
 * Lists the signed-in teacher's Google Classroom courses available to import,
 * flagging which have already been imported into Qlass.
 */
export async function GET() {
  const session = await requireSession();
  if (
    session.user.systemRole !== SystemRole.TEACHER &&
    session.user.systemRole !== SystemRole.ADMIN
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const courses: {
    id: string;
    name: string;
    section: string | null;
    descriptionHeading: string | null;
    courseState: string | null;
  }[] = [];

  // Keyless demo path — no Google credentials required.
  if (isDemoMode()) {
    courses.push(...listDemoCourses());
  } else {
    let classroom;
    try {
      classroom = await getClassroomClient(session.user.id);
    } catch (e) {
      if (e instanceof GoogleNotConnectedError) {
        return NextResponse.json({ reason: e.reason }, { status: 409 });
      }
      throw e;
    }

    try {
      let pageToken: string | undefined;
      do {
        const { data } = await classroom.courses.list({
          teacherId: "me",
          courseStates: ["ACTIVE", "ARCHIVED"],
          pageSize: 100,
          pageToken,
        });
        for (const c of data.courses ?? []) {
          if (!c.id) continue;
          courses.push({
            id: c.id,
            name: c.name ?? "Untitled course",
            section: c.section ?? null,
            descriptionHeading: c.descriptionHeading ?? null,
            courseState: c.courseState ?? null,
          });
        }
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken);
    } catch {
      return NextResponse.json(
        { error: "Failed to list Google Classroom courses" },
        { status: 502 }
      );
    }
  }

  try {
    // Mark already-imported courses.
    const imported = await prisma.class.findMany({
      where: { googleCourseId: { in: courses.map((c) => c.id) } },
      select: { id: true, googleCourseId: true },
    });
    const importedByCourse = new Map(
      imported.map((c) => [c.googleCourseId!, c.id])
    );

    return NextResponse.json({
      demo: isDemoMode(),
      courses: courses.map((c) => ({
        ...c,
        alreadyImported: importedByCourse.has(c.id),
        importedClassId: importedByCourse.get(c.id) ?? null,
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to list courses" },
      { status: 502 }
    );
  }
}
