import {
  ClassRole,
  PostStatus,
  PostType,
  SubmissionStatus,
  SystemRole,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateUniqueJoinCode } from "@/lib/utils";
import type { ImportCounts, ImportResult } from "@/lib/classroom-import";

/**
 * Keyless demo mode. When CLASSROOM_DEMO_MODE=true, the import flow bypasses
 * Google entirely and uses the fixtures below — so the feature can be shown end
 * to end (real classes are created in the DB) without OAuth credentials.
 */
export function isDemoMode(): boolean {
  return process.env.CLASSROOM_DEMO_MODE === "true";
}

type DemoStudent = { name: string; email: string };
type DemoWork = {
  id: string;
  title: string;
  description: string;
  topic: string;
  points: number;
  dueInDays: number | null;
};
type DemoCourse = {
  id: string;
  name: string;
  section: string;
  descriptionHeading: string;
  topics: string[];
  students: DemoStudent[];
  coursework: DemoWork[];
  announcements: string[];
};

const STUDENTS: DemoStudent[] = [
  { name: "Ada Lovelace", email: "ada.lovelace@demo.qlass" },
  { name: "Alan Turing", email: "alan.turing@demo.qlass" },
  { name: "Grace Hopper", email: "grace.hopper@demo.qlass" },
  { name: "Katherine Johnson", email: "katherine.johnson@demo.qlass" },
];

export const DEMO_COURSES: DemoCourse[] = [
  {
    id: "demo-course-bio",
    name: "Biology 101",
    section: "Period 2 · Fall",
    descriptionHeading: "Introduction to cellular and molecular biology.",
    topics: ["Cells", "Genetics", "Ecology"],
    students: STUDENTS,
    coursework: [
      {
        id: "demo-bio-w1",
        title: "Cell organelles lab report",
        description:
          "Observe prepared slides and label the organelles you identify. Submit a one-page write-up.",
        topic: "Cells",
        points: 50,
        dueInDays: 5,
      },
      {
        id: "demo-bio-w2",
        title: "Punnett square problem set",
        description: "Complete problems 1–12 on monohybrid and dihybrid crosses.",
        topic: "Genetics",
        points: 30,
        dueInDays: 9,
      },
      {
        id: "demo-bio-w3",
        title: "Local ecosystem field notes",
        description: "Document a local ecosystem and identify three trophic levels.",
        topic: "Ecology",
        points: 40,
        dueInDays: null,
      },
    ],
    announcements: [
      "Welcome to Biology 101! Please read the syllabus and bring your lab notebook on Friday.",
      "Reminder: the cell organelles lab report is due next week. Office hours are Thursday at lunch.",
    ],
  },
  {
    id: "demo-course-algebra",
    name: "Algebra II",
    section: "Period 4 · Fall",
    descriptionHeading: "Functions, polynomials, and an introduction to logarithms.",
    topics: ["Functions", "Polynomials"],
    students: STUDENTS.slice(0, 3),
    coursework: [
      {
        id: "demo-alg-w1",
        title: "Quadratic functions worksheet",
        description: "Graph the given quadratics and identify vertex and roots.",
        topic: "Functions",
        points: 25,
        dueInDays: 3,
      },
      {
        id: "demo-alg-w2",
        title: "Polynomial division quiz",
        description: "In-class quiz on synthetic and long division of polynomials.",
        topic: "Polynomials",
        points: 100,
        dueInDays: 7,
      },
    ],
    announcements: [
      "Quiz on Friday covers polynomial division — review the practice set posted under Classwork.",
    ],
  },
  {
    id: "demo-course-history",
    name: "World History",
    section: "Period 1 · Fall",
    descriptionHeading: "From ancient civilizations to the modern era.",
    topics: ["Antiquity", "Revolutions"],
    students: STUDENTS,
    coursework: [
      {
        id: "demo-hist-w1",
        title: "Primary source analysis",
        description: "Analyze the provided primary source and answer the four guiding questions.",
        topic: "Antiquity",
        points: 60,
        dueInDays: 6,
      },
    ],
    announcements: [
      "Field trip permission slips are due Monday. See the attachment on the class stream.",
    ],
  },
];

export function listDemoCourses() {
  return DEMO_COURSES.map((c) => ({
    id: c.id,
    name: c.name,
    section: c.section,
    descriptionHeading: c.descriptionHeading,
    courseState: "ACTIVE" as const,
  }));
}

function emptyCounts(): ImportCounts {
  return {
    teachers: 0,
    students: 0,
    categories: 0,
    assignments: 0,
    announcements: 0,
    submissions: 0,
    grades: 0,
    attachments: 0,
    attachmentErrors: 0,
  };
}

/**
 * Import one demo course into the DB. Mirrors importCourse's shape and is
 * idempotent (keyed on the demo googleCourseId), so re-running updates in place.
 */
export async function importDemoCourse(
  userId: string,
  courseId: string
): Promise<ImportResult> {
  const counts = emptyCounts();
  const course = DEMO_COURSES.find((c) => c.id === courseId);
  if (!course) {
    return { courseId, status: "failed", error: "Unknown demo course", counts };
  }

  try {
    // --- Class (idempotent on googleCourseId) ---
    const existing = await prisma.class.findUnique({
      where: { googleCourseId: courseId },
      select: { id: true },
    });
    const wasUpdate = existing !== null;

    let classId: string;
    if (existing) {
      classId = existing.id;
      await prisma.class.update({
        where: { id: existing.id },
        data: {
          name: course.name,
          section: course.section,
          description: course.descriptionHeading,
        },
      });
    } else {
      const joinCode = await generateUniqueJoinCode(
        async (code) =>
          (await prisma.class.findUnique({ where: { joinCode: code } })) !==
          null
      );
      const created = await prisma.class.create({
        data: {
          name: course.name,
          section: course.section,
          description: course.descriptionHeading,
          joinCode,
          ownerId: userId,
          googleCourseId: courseId,
        },
        select: { id: true },
      });
      classId = created.id;
    }

    // --- Owner membership ---
    await prisma.classMembership.upsert({
      where: { classId_userId: { classId, userId } },
      create: { classId, userId, role: ClassRole.OWNER },
      update: {},
    });

    // --- Students ---
    const studentIds: string[] = [];
    for (const s of course.students) {
      const user = await prisma.user.upsert({
        where: { email: s.email },
        create: {
          email: s.email,
          name: s.name,
          systemRole: SystemRole.STUDENT,
        },
        update: { name: s.name },
        select: { id: true },
      });
      studentIds.push(user.id);
      await prisma.classMembership.upsert({
        where: { classId_userId: { classId, userId: user.id } },
        create: { classId, userId: user.id, role: ClassRole.STUDENT },
        update: {},
      });
      counts.students++;
    }

    // --- Topics -> categories ---
    const categoryByName = new Map<string, string>();
    let order = 0;
    for (const topic of course.topics) {
      const googleTopicId = `${courseId}-topic-${order}`;
      const cat = await prisma.assignmentCategory.upsert({
        where: { classId_googleTopicId: { classId, googleTopicId } },
        create: { classId, name: topic, order: order++, googleTopicId },
        update: { name: topic },
        select: { id: true },
      });
      categoryByName.set(topic, cat.id);
      counts.categories++;
    }

    // --- Coursework -> Post + Assignment, with a few submissions/grades ---
    const now = Date.now();
    for (const work of course.coursework) {
      const dueDate =
        work.dueInDays == null
          ? null
          : new Date(now + work.dueInDays * 24 * 60 * 60 * 1000);
      const post = await prisma.post.upsert({
        where: { googleCourseWorkId: work.id },
        create: {
          classId,
          authorId: userId,
          type: PostType.ASSIGNMENT,
          status: PostStatus.PUBLISHED,
          title: work.title,
          content: work.description,
          categoryId: categoryByName.get(work.topic) ?? null,
          dueDate,
          points: work.points,
          publishedAt: new Date(),
          googleCourseWorkId: work.id,
          assignment: { create: { instructions: work.description } },
        },
        update: {
          title: work.title,
          content: work.description,
          dueDate,
          points: work.points,
        },
        select: { id: true, assignment: { select: { id: true } } },
      });
      counts.assignments++;

      const assignmentId = post.assignment?.id;
      if (assignmentId) {
        // First two students have turned in; the first is graded.
        for (let i = 0; i < Math.min(2, studentIds.length); i++) {
          const studentId = studentIds[i];
          const graded = i === 0;
          const submission = await prisma.submission.upsert({
            where: { assignmentId_studentId: { assignmentId, studentId } },
            create: {
              assignmentId,
              studentId,
              status: graded
                ? SubmissionStatus.GRADED
                : SubmissionStatus.TURNED_IN,
              turnedInAt: new Date(),
              googleSubmissionId: `${work.id}-sub-${i}`,
            },
            update: {},
            select: { id: true },
          });
          counts.submissions++;
          if (graded) {
            await prisma.grade.upsert({
              where: { submissionId: submission.id },
              create: {
                submissionId: submission.id,
                graderId: userId,
                points: Math.round(work.points * 0.9),
                maxPoints: work.points,
                returnedAt: new Date(),
              },
              update: {},
            });
            counts.grades++;
          }
        }
      }
    }

    // --- Announcements -> Post ---
    let annIndex = 0;
    for (const text of course.announcements) {
      const googleAnnouncementId = `${courseId}-ann-${annIndex++}`;
      await prisma.post.upsert({
        where: { googleAnnouncementId },
        create: {
          classId,
          authorId: userId,
          type: PostType.ANNOUNCEMENT,
          status: PostStatus.PUBLISHED,
          title: text.slice(0, 80),
          content: text,
          publishedAt: new Date(),
          googleAnnouncementId,
        },
        update: { content: text },
      });
      counts.announcements++;
    }

    return {
      courseId,
      status: wasUpdate ? "updated" : "imported",
      classId,
      className: course.name,
      counts,
    };
  } catch (e) {
    return {
      courseId,
      status: "failed",
      error: e instanceof Error ? e.message : "Unknown error",
      counts,
    };
  }
}
