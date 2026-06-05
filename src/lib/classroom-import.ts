import { randomUUID } from "crypto";
import type { classroom_v1, drive_v3 } from "googleapis";
import {
  ClassRole,
  PostStatus,
  PostType,
  SubmissionStatus,
  SystemRole,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { getClassroomClient, getDriveClient } from "@/lib/google";
import { generateUniqueJoinCode } from "@/lib/utils";
import { putObject } from "@/lib/storage";

export type ImportOptions = {
  importStudents: boolean;
  importAnnouncements: boolean;
  importCoursework: boolean;
  importSubmissions: boolean;
  importGrades: boolean;
  importAttachments: boolean;
};

export const DEFAULT_OPTIONS: ImportOptions = {
  importStudents: true,
  importAnnouncements: true,
  importCoursework: true,
  importSubmissions: true,
  importGrades: true,
  importAttachments: true,
};

export type ImportCounts = {
  teachers: number;
  students: number;
  categories: number;
  assignments: number;
  announcements: number;
  submissions: number;
  grades: number;
  attachments: number;
  attachmentErrors: number;
};

export type ImportResult = {
  courseId: string;
  status: "imported" | "updated" | "failed";
  classId?: string;
  className?: string;
  counts?: ImportCounts;
  error?: string;
};

/** Paginate any Classroom list endpoint that returns { nextPageToken }. */
async function paginate<T>(
  fetchPage: (
    pageToken?: string
  ) => Promise<{ items: T[]; nextPageToken?: string }>
): Promise<T[]> {
  const all: T[] = [];
  let pageToken: string | undefined;
  do {
    const { items, nextPageToken } = await fetchPage(pageToken);
    all.push(...items);
    pageToken = nextPageToken;
  } while (pageToken);
  return all;
}

/** Combine Classroom's split date + time (UTC) into a Date. */
function toDueDate(
  date?: classroom_v1.Schema$Date | null,
  time?: classroom_v1.Schema$TimeOfDay | null
): Date | null {
  if (!date?.year || !date.month || !date.day) return null;
  return new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      time?.hours ?? 23,
      time?.minutes ?? 59
    )
  );
}

/** Map a Classroom courseWork/announcement state to a Qlass PostStatus. */
function toPostStatus(state?: string | null): PostStatus {
  return state === "PUBLISHED" ? PostStatus.PUBLISHED : PostStatus.DRAFT;
}

/** Map a Classroom submission state to a Qlass SubmissionStatus. */
function toSubmissionStatus(
  state?: string | null,
  hasGrade?: boolean
): SubmissionStatus {
  if (state === "RETURNED") return SubmissionStatus.RETURNED;
  if (state === "TURNED_IN") {
    return hasGrade ? SubmissionStatus.GRADED : SubmissionStatus.TURNED_IN;
  }
  return SubmissionStatus.ASSIGNED;
}

const GOOGLE_EXPORT_MIME: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.document": {
    mime: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.presentation": {
    mime: "application/pdf",
    ext: ".pdf",
  },
  "application/vnd.google-apps.drawing": {
    mime: "image/png",
    ext: ".png",
  },
};

/**
 * Download a Drive file (exporting Google-native docs to a portable format),
 * store it via the storage abstraction, and create an Attachment row.
 * Returns true on success. Failures are non-fatal (counted, not thrown).
 */
async function importDriveAttachment(
  drive: drive_v3.Drive,
  uploaderId: string,
  fileId: string,
  fallbackName: string,
  link: { postId?: string; submissionId?: string },
  googleMaterialId: string | null
): Promise<boolean> {
  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size",
    supportsAllDrives: true,
  });
  const sourceMime = meta.data.mimeType ?? "application/octet-stream";
  let fileName = meta.data.name ?? fallbackName;
  let mimeType = sourceMime;
  let buffer: Buffer;

  const exportTarget = GOOGLE_EXPORT_MIME[sourceMime];
  if (exportTarget) {
    const res = await drive.files.export(
      { fileId, mimeType: exportTarget.mime },
      { responseType: "arraybuffer" }
    );
    buffer = Buffer.from(res.data as ArrayBuffer);
    mimeType = exportTarget.mime;
    if (!fileName.endsWith(exportTarget.ext)) fileName += exportTarget.ext;
  } else {
    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    buffer = Buffer.from(res.data as ArrayBuffer);
  }

  const storageKey = `uploads/${randomUUID()}/${fileName}`;
  await putObject(storageKey, buffer, mimeType);
  await prisma.attachment.create({
    data: {
      fileName,
      mimeType,
      size: buffer.length,
      storageKey,
      uploaderId,
      postId: link.postId ?? null,
      submissionId: link.submissionId ?? null,
      driveFileId: fileId,
      googleMaterialId,
    },
  });
  return true;
}

/**
 * Import a single Google Classroom course into Qlass. Idempotent: keyed on
 * Google ids, re-running updates existing rows instead of duplicating.
 */
export async function importCourse(
  userId: string,
  courseId: string,
  options: ImportOptions
): Promise<ImportResult> {
  const counts: ImportCounts = {
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

  try {
    const classroom = await getClassroomClient(userId);

    // --- Fetch everything from Google first ---
    const course = (await classroom.courses.get({ id: courseId })).data;

    const teachers = await paginate<classroom_v1.Schema$Teacher>(
      async (pageToken) => {
        const { data } = await classroom.courses.teachers.list({
          courseId,
          pageSize: 100,
          pageToken,
        });
        return {
          items: data.teachers ?? [],
          nextPageToken: data.nextPageToken ?? undefined,
        };
      }
    );

    const students = options.importStudents
      ? await paginate<classroom_v1.Schema$Student>(async (pageToken) => {
          const { data } = await classroom.courses.students.list({
            courseId,
            pageSize: 100,
            pageToken,
          });
          return {
            items: data.students ?? [],
            nextPageToken: data.nextPageToken ?? undefined,
          };
        })
      : [];

    const topics = await paginate<classroom_v1.Schema$Topic>(
      async (pageToken) => {
        const { data } = await classroom.courses.topics.list({
          courseId,
          pageSize: 100,
          pageToken,
        });
        return {
          items: data.topic ?? [],
          nextPageToken: data.nextPageToken ?? undefined,
        };
      }
    );

    const courseWork = options.importCoursework
      ? await paginate<classroom_v1.Schema$CourseWork>(async (pageToken) => {
          const { data } = await classroom.courses.courseWork.list({
            courseId,
            pageSize: 100,
            pageToken,
          });
          return {
            items: data.courseWork ?? [],
            nextPageToken: data.nextPageToken ?? undefined,
          };
        })
      : [];

    const announcements = options.importAnnouncements
      ? await paginate<classroom_v1.Schema$Announcement>(async (pageToken) => {
          const { data } = await classroom.courses.announcements.list({
            courseId,
            pageSize: 100,
            pageToken,
          });
          return {
            items: data.announcements ?? [],
            nextPageToken: data.nextPageToken ?? undefined,
          };
        })
      : [];

    // --- Map users (upsert by email) ---
    // googleUserId -> Qlass user id, for submission ownership lookups.
    const userByGoogleId = new Map<string, string>();

    const upsertRosterUser = async (
      profile: classroom_v1.Schema$UserProfile | undefined,
      googleUserId: string | undefined,
      role: SystemRole
    ): Promise<string | null> => {
      const email = profile?.emailAddress?.toLowerCase();
      if (!email) return null;
      const name = profile?.name?.fullName ?? null;
      const image = profile?.photoUrl ?? null;
      const user = await prisma.user.upsert({
        where: { email },
        // Only set systemRole on create — never downgrade an existing account.
        create: { email, name, image, systemRole: role, googleUserId },
        update: { name, image, googleUserId },
        select: { id: true },
      });
      if (googleUserId) userByGoogleId.set(googleUserId, user.id);
      return user.id;
    };

    const teacherUserIds: string[] = [];
    for (const t of teachers) {
      const id = await upsertRosterUser(
        t.profile ?? undefined,
        t.userId ?? undefined,
        SystemRole.TEACHER
      );
      if (id) {
        teacherUserIds.push(id);
        counts.teachers++;
      }
    }
    const studentUserIds: string[] = [];
    for (const s of students) {
      const id = await upsertRosterUser(
        s.profile ?? undefined,
        s.userId ?? undefined,
        SystemRole.STUDENT
      );
      if (id) {
        studentUserIds.push(id);
        counts.students++;
      }
    }

    // --- Class (find by googleCourseId, else create) ---
    const existing = await prisma.class.findUnique({
      where: { googleCourseId: courseId },
      select: { id: true },
    });
    const wasUpdate = existing !== null;

    let classId: string;
    if (existing) {
      const updated = await prisma.class.update({
        where: { id: existing.id },
        data: {
          name: course.name ?? "Imported course",
          section: course.section ?? null,
          description: course.descriptionHeading ?? course.description ?? null,
        },
        select: { id: true },
      });
      classId = updated.id;
    } else {
      const joinCode = await generateUniqueJoinCode(
        async (code) =>
          (await prisma.class.findUnique({ where: { joinCode: code } })) !==
          null
      );
      const created = await prisma.class.create({
        data: {
          name: course.name ?? "Imported course",
          section: course.section ?? null,
          description: course.descriptionHeading ?? course.description ?? null,
          joinCode,
          ownerId: userId,
          googleCourseId: courseId,
        },
        select: { id: true },
      });
      classId = created.id;
    }
    const className = course.name ?? "Imported course";

    // --- Memberships (importer = OWNER) ---
    const upsertMembership = async (memberId: string, role: ClassRole) => {
      await prisma.classMembership.upsert({
        where: { classId_userId: { classId, userId: memberId } },
        // Don't demote the owner if they also appear in the teacher roster.
        create: { classId, userId: memberId, role },
        update:
          role === ClassRole.OWNER || memberId === userId ? {} : { role },
      });
    };
    await upsertMembership(userId, ClassRole.OWNER);
    for (const id of teacherUserIds) {
      if (id !== userId) await upsertMembership(id, ClassRole.TEACHER);
    }
    for (const id of studentUserIds) {
      if (id !== userId) await upsertMembership(id, ClassRole.STUDENT);
    }

    // --- Topics -> AssignmentCategory ---
    const categoryByTopicId = new Map<string, string>();
    let order = 0;
    for (const topic of topics) {
      if (!topic.topicId) continue;
      const cat = await prisma.assignmentCategory.upsert({
        where: {
          classId_googleTopicId: { classId, googleTopicId: topic.topicId },
        },
        create: {
          classId,
          name: topic.name ?? "Topic",
          order: order++,
          googleTopicId: topic.topicId,
        },
        update: { name: topic.name ?? "Topic" },
        select: { id: true },
      });
      categoryByTopicId.set(topic.topicId, cat.id);
      counts.categories++;
    }

    const drive = options.importAttachments
      ? await getDriveClient(userId)
      : null;

    const importMaterials = async (
      materials: classroom_v1.Schema$Material[] | undefined,
      link: { postId?: string; submissionId?: string }
    ) => {
      if (!drive || !materials) return;
      for (const m of materials) {
        const fileId = m.driveFile?.driveFile?.id;
        if (!fileId) continue; // links/youtube/forms handled on the Post columns
        try {
          await importDriveAttachment(
            drive,
            userId,
            fileId,
            m.driveFile?.driveFile?.title ?? "attachment",
            link,
            m.driveFile?.driveFile?.id ?? null
          );
          counts.attachments++;
        } catch {
          counts.attachmentErrors++;
        }
      }
    };

    // Student submission attachments use Schema$Attachment, where driveFile is
    // the file directly (not nested under .driveFile like Material).
    const importSubmissionAttachments = async (
      attachments: classroom_v1.Schema$Attachment[] | undefined,
      submissionId: string
    ) => {
      if (!drive || !attachments) return;
      for (const a of attachments) {
        const fileId = a.driveFile?.id;
        if (!fileId) continue;
        try {
          await importDriveAttachment(
            drive,
            userId,
            fileId,
            a.driveFile?.title ?? "attachment",
            { submissionId },
            fileId
          );
          counts.attachments++;
        } catch {
          counts.attachmentErrors++;
        }
      }
    };

    // First non-drive material link/video, surfaced on the Post itself.
    const firstLink = (materials?: classroom_v1.Schema$Material[]) => {
      let linkUrl: string | null = null;
      let youtubeUrl: string | null = null;
      for (const m of materials ?? []) {
        if (!youtubeUrl && m.youtubeVideo?.alternateLink)
          youtubeUrl = m.youtubeVideo.alternateLink;
        if (!linkUrl && m.link?.url) linkUrl = m.link.url;
        if (!linkUrl && m.form?.formUrl) linkUrl = m.form.formUrl;
      }
      return { linkUrl, youtubeUrl };
    };

    // --- CourseWork -> Post(ASSIGNMENT) + Assignment ---
    // googleCourseWorkId -> { postId, assignmentId, maxPoints }
    const workMap = new Map<
      string,
      { postId: string; assignmentId: string; maxPoints: number | null }
    >();
    for (const work of courseWork) {
      if (!work.id) continue;
      const { linkUrl, youtubeUrl } = firstLink(work.materials ?? undefined);
      const categoryId = work.topicId
        ? categoryByTopicId.get(work.topicId) ?? null
        : null;
      const post = await prisma.post.upsert({
        where: { googleCourseWorkId: work.id },
        create: {
          classId,
          authorId: userId,
          type: PostType.ASSIGNMENT,
          status: toPostStatus(work.state),
          title: work.title ?? "Untitled assignment",
          content: work.description ?? null,
          categoryId,
          dueDate: toDueDate(work.dueDate, work.dueTime),
          points: work.maxPoints ?? null,
          linkUrl,
          youtubeUrl,
          publishedAt:
            work.state === "PUBLISHED"
              ? work.creationTime
                ? new Date(work.creationTime)
                : new Date()
              : null,
          googleCourseWorkId: work.id,
          assignment: { create: { instructions: work.description ?? null } },
        },
        update: {
          title: work.title ?? "Untitled assignment",
          content: work.description ?? null,
          categoryId,
          dueDate: toDueDate(work.dueDate, work.dueTime),
          points: work.maxPoints ?? null,
          status: toPostStatus(work.state),
        },
        select: { id: true, assignment: { select: { id: true } } },
      });
      let assignmentId = post.assignment?.id;
      if (!assignmentId) {
        const a = await prisma.assignment.create({
          data: { postId: post.id, instructions: work.description ?? null },
          select: { id: true },
        });
        assignmentId = a.id;
      }
      workMap.set(work.id, {
        postId: post.id,
        assignmentId,
        maxPoints: work.maxPoints ?? null,
      });
      counts.assignments++;
      await importMaterials(work.materials ?? undefined, { postId: post.id });
    }

    // --- Announcements -> Post(ANNOUNCEMENT) ---
    for (const ann of announcements) {
      if (!ann.id) continue;
      const text = ann.text ?? "";
      const title =
        text.trim().slice(0, 80) || "Announcement";
      const { linkUrl, youtubeUrl } = firstLink(ann.materials ?? undefined);
      const post = await prisma.post.upsert({
        where: { googleAnnouncementId: ann.id },
        create: {
          classId,
          authorId: userId,
          type: PostType.ANNOUNCEMENT,
          status: toPostStatus(ann.state),
          title,
          content: text,
          linkUrl,
          youtubeUrl,
          publishedAt: ann.creationTime ? new Date(ann.creationTime) : new Date(),
          googleAnnouncementId: ann.id,
        },
        update: { title, content: text, status: toPostStatus(ann.state) },
        select: { id: true },
      });
      counts.announcements++;
      await importMaterials(ann.materials ?? undefined, { postId: post.id });
    }

    // --- Submissions + Grades ---
    if (options.importSubmissions) {
      for (const [googleWorkId, mapped] of Array.from(workMap.entries())) {
        const submissions =
          await paginate<classroom_v1.Schema$StudentSubmission>(
            async (pageToken) => {
              const { data } =
                await classroom.courses.courseWork.studentSubmissions.list({
                  courseId,
                  courseWorkId: googleWorkId,
                  pageSize: 100,
                  pageToken,
                });
              return {
                items: data.studentSubmissions ?? [],
                nextPageToken: data.nextPageToken ?? undefined,
              };
            }
          );
        for (const sub of submissions) {
          if (!sub.id || !sub.userId) continue;
          const studentId = userByGoogleId.get(sub.userId);
          if (!studentId) continue; // student not in imported roster
          const grade = sub.assignedGrade ?? sub.draftGrade ?? null;
          const hasGrade = options.importGrades && grade != null;
          const status = toSubmissionStatus(sub.state, hasGrade);
          const turnedInAt =
            sub.state === "TURNED_IN" || sub.state === "RETURNED"
              ? sub.updateTime
                ? new Date(sub.updateTime)
                : null
              : null;
          const submission = await prisma.submission.upsert({
            where: {
              assignmentId_studentId: {
                assignmentId: mapped.assignmentId,
                studentId,
              },
            },
            create: {
              assignmentId: mapped.assignmentId,
              studentId,
              status,
              turnedInAt,
              googleSubmissionId: sub.id,
            },
            update: { status, turnedInAt, googleSubmissionId: sub.id },
            select: { id: true },
          });
          counts.submissions++;

          if (hasGrade) {
            await prisma.grade.upsert({
              where: { submissionId: submission.id },
              create: {
                submissionId: submission.id,
                graderId: userId,
                points: grade,
                maxPoints: mapped.maxPoints,
                returnedAt:
                  sub.state === "RETURNED"
                    ? sub.updateTime
                      ? new Date(sub.updateTime)
                      : new Date()
                    : null,
              },
              update: {
                points: grade,
                maxPoints: mapped.maxPoints,
                returnedAt:
                  sub.state === "RETURNED"
                    ? sub.updateTime
                      ? new Date(sub.updateTime)
                      : new Date()
                    : undefined,
              },
            });
            counts.grades++;
          }

          // Student-submitted Drive attachments.
          if (options.importAttachments) {
            await importSubmissionAttachments(
              sub.assignmentSubmission?.attachments ?? undefined,
              submission.id
            );
          }
        }
      }
    }

    return {
      courseId,
      status: wasUpdate ? "updated" : "imported",
      classId,
      className,
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
