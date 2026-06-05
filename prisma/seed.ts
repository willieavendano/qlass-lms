import { PrismaClient, ClassRole, SystemRole, PostStatus, PostType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

  const classroom = await prisma.class.upsert({
    where: { joinCode: "DEMOCLS" },
    update: {},
    create: {
      name: "Introduction to Computer Science",
      section: "Period 1",
      description: "Demo class for Qlass",
      joinCode: "DEMOCLS",
      bannerColor: "#0d9488",
      ownerId: teacher.id,
      memberships: {
        create: [
          { userId: teacher.id, role: ClassRole.OWNER },
          { userId: student.id, role: ClassRole.STUDENT },
        ],
      },
      categories: {
        createMany: {
          data: [
            { name: "Homework", order: 0 },
            { name: "Quizzes", order: 1 },
          ],
        },
      },
    },
  });

  const existingPost = await prisma.post.findFirst({
    where: { classId: classroom.id, title: "Welcome to Qlass" },
  });

  if (!existingPost) {
    await prisma.post.create({
      data: {
        classId: classroom.id,
        authorId: teacher.id,
        type: PostType.ANNOUNCEMENT,
        status: PostStatus.PUBLISHED,
        title: "Welcome to Qlass",
        content: "This is your demo classroom. Explore stream, classwork, and grading.",
        publishedAt: new Date(),
      },
    });

    const homework = await prisma.assignmentCategory.findFirst({
      where: { classId: classroom.id, name: "Homework" },
    });

    await prisma.post.create({
      data: {
        classId: classroom.id,
        authorId: teacher.id,
        type: PostType.ASSIGNMENT,
        status: PostStatus.PUBLISHED,
        title: "Hello World Essay",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        points: 100,
        categoryId: homework?.id,
        publishedAt: new Date(),
        assignment: {
          create: {
            instructions: "Write a short essay introducing yourself.",
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
  console.log("  Student: student@qlass.local / password123");
  console.log("  Join code: DEMOCLS");
  console.log("  Admin user id:", admin.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
