import { NextResponse } from "next/server";
import { z } from "zod";
import { SystemRole } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { GoogleNotConnectedError } from "@/lib/google";
import {
  DEFAULT_OPTIONS,
  importCourse,
  type ImportResult,
} from "@/lib/classroom-import";
import { isDemoMode, importDemoCourse } from "@/lib/classroom-demo";

const schema = z.object({
  courseIds: z.array(z.string()).min(1).max(20),
  options: z
    .object({
      importStudents: z.boolean().optional(),
      importAnnouncements: z.boolean().optional(),
      importCoursework: z.boolean().optional(),
      importSubmissions: z.boolean().optional(),
      importGrades: z.boolean().optional(),
      importAttachments: z.boolean().optional(),
    })
    .optional(),
});

/**
 * POST /api/import/classroom/import
 * Imports the selected Google Classroom courses. Each course is imported
 * independently — one failure doesn't abort the batch.
 */
export async function POST(req: Request) {
  const session = await requireSession();
  if (
    session.user.systemRole !== SystemRole.TEACHER &&
    session.user.systemRole !== SystemRole.ADMIN
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { courseIds, options } = schema.parse(await req.json());
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const demo = isDemoMode();
    const results: ImportResult[] = [];
    for (const courseId of courseIds) {
      results.push(
        demo
          ? await importDemoCourse(session.user.id, courseId)
          : await importCourse(session.user.id, courseId, opts)
      );
    }
    return NextResponse.json({ results });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    if (e instanceof GoogleNotConnectedError) {
      return NextResponse.json({ reason: e.reason }, { status: 409 });
    }
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}
