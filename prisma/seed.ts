import { PrismaClient, ClassRole, SystemRole, PostStatus, PostType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// The six classes taught in the 2026–27 pilot year. Join codes are stable so
// re-seeding is idempotent (upsert by joinCode).
const CLASSES = [
  { name: "Physics", joinCode: "PHYSICS", bannerColor: "#0d9488" },
  { name: "AP Statistics", joinCode: "APSTATS", bannerColor: "#4f46e5" },
  { name: "Computer Science Math", joinCode: "CSMATH1", bannerColor: "#b45309" },
  { name: "Principles of Engineering", joinCode: "PRINENG", bannerColor: "#be123c" },
  { name: "Engineering Design", joinCode: "ENGDSGN", bannerColor: "#047857" },
  { name: "Engineering Fundamentals", joinCode: "ENGFUND", bannerColor: "#334155" },
];

async function main() {
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@qlass.local" },
    update: {},
    create: {
      email: "admin@qlass.local",
      name: "Qlass Admin",
      passwordHash,
      systemRole: SystemRole.ADMIN,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@qlass.local" },
    update: {},
    create: {
      email: "teacher@qlass.local",
      name: "Demo Teacher",
      passwordHash,
      systemRole: SystemRole.TEACHER,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@qlass.local" },
    update: {},
    create: {
      email: "student@qlass.local",
      name: "Demo Student",
      passwordHash,
      systemRole: SystemRole.STUDENT,
    },
  });

  const classes = [];
  for (const c of CLASSES) {
    classes.push(
      await prisma.class.upsert({
        where: { joinCode: c.joinCode },
        update: {},
        create: {
          name: c.name,
          section: "2026–27",
          joinCode: c.joinCode,
          bannerColor: c.bannerColor,
          ownerId: teacher.id,
          memberships: { create: [{ userId: teacher.id, role: ClassRole.OWNER }] },
          categories: {
            createMany: {
              data: [
                { name: "Homework", order: 0 },
                { name: "Quizzes", order: 1 },
                { name: "Projects", order: 2 },
              ],
            },
          },
        },
      })
    );
  }

  // Enroll the demo student in Physics so student-facing flows are testable.
  const physics = classes[0];
  await prisma.classMembership.upsert({
    where: { classId_userId: { classId: physics.id, userId: student.id } },
    update: {},
    create: { classId: physics.id, userId: student.id, role: ClassRole.STUDENT },
  });

  const existingPost = await prisma.post.findFirst({
    where: { classId: physics.id, title: "Welcome to Physics" },
  });

  if (!existingPost) {
    await prisma.post.create({
      data: {
        classId: physics.id,
        authorId: teacher.id,
        type: PostType.ANNOUNCEMENT,
        status: PostStatus.PUBLISHED,
        title: "Welcome to Physics",
        content: "Course expectations, lab safety, and the stream/classwork basics live here.",
        publishedAt: new Date(),
      },
    });

    const homework = await prisma.assignmentCategory.findFirst({
      where: { classId: physics.id, name: "Homework" },
    });

    await prisma.post.create({
      data: {
        classId: physics.id,
        authorId: teacher.id,
        type: PostType.ASSIGNMENT,
        status: PostStatus.PUBLISHED,
        title: "Measurement & Units Warm-up",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        points: 100,
        categoryId: homework?.id,
        publishedAt: new Date(),
        assignment: {
          create: {
            instructions:
              "Estimate three everyday quantities (length, mass, time), then measure them and report % error with correct SI units.",
            allowLate: true,
          },
        },
      },
    });
  }

  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", storageProvider: "local" },
  });

  console.log("Qlass seed complete:");
  console.log("  Admin:   admin@qlass.local / password123");
  console.log("  Teacher: teacher@qlass.local / password123");
  console.log("  Student: student@qlass.local / password123 (enrolled in Physics)");
  console.log("  Classes (2026–27):");
  for (const c of CLASSES) console.log(`    ${c.name} — join code ${c.joinCode}`);
  console.log("  Admin user id:", admin.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
