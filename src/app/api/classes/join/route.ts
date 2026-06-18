import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";

const schema = z.object({
  joinCode: z.string().min(6).max(10),
});

export async function POST(req: Request) {
  const session = await requireSession();
  // Throttle join-code guessing per user (codes are short and enumerable).
  const limit = rateLimit(`join:${session.user.id}`, {
    limit: 15,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return tooManyRequests(limit.retryAfterMs);

  try {
    const { joinCode } = schema.parse(await req.json());
    const classroom = await prisma.class.findFirst({
      where: { joinCode: joinCode.toUpperCase(), archived: false },
    });
    if (!classroom) {
      return NextResponse.json({ error: "Invalid join code" }, { status: 404 });
    }
    const existing = await prisma.classMembership.findUnique({
      where: {
        classId_userId: { classId: classroom.id, userId: session.user.id },
      },
    });
    if (existing) {
      return NextResponse.json({ class: classroom, alreadyMember: true });
    }
    await prisma.classMembership.create({
      data: {
        classId: classroom.id,
        userId: session.user.id,
        role: ClassRole.STUDENT,
      },
    });
    return NextResponse.json({ class: classroom });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Join failed" }, { status: 500 });
  }
}
