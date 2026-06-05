import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { generateUniqueJoinCode } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  section: z.string().max(50).optional(),
  description: z.string().max(2000).optional(),
  bannerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function GET() {
  const session = await requireSession();
  const memberships = await prisma.classMembership.findMany({
    where: { userId: session.user.id },
    include: {
      class: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });
  const classes = memberships.map((m) => ({
    ...m.class,
    role: m.role,
    memberCount: m.class._count.memberships,
  }));
  return NextResponse.json({ classes });
}

export async function POST(req: Request) {
  const session = await requireSession();
  try {
    const body = await req.json();
    const data = createSchema.parse(body);
    const joinCode = await generateUniqueJoinCode(
      async (code) =>
        (await prisma.class.findUnique({ where: { joinCode: code } })) !== null
    );
    const classroom = await prisma.class.create({
      data: {
        name: data.name,
        section: data.section,
        description: data.description,
        bannerColor: data.bannerColor ?? "#0d9488",
        joinCode,
        ownerId: session.user.id,
        memberships: {
          create: {
            userId: session.user.id,
            role: ClassRole.OWNER,
          },
        },
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
      include: { categories: true },
    });
    return NextResponse.json({ class: classroom }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create class" }, { status: 500 });
  }
}
