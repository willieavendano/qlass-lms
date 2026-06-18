import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SystemRole } from "@prisma/client";
import { rateLimit, clientIp, tooManyRequests } from "@/lib/ratelimit";

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["STUDENT", "TEACHER"]).optional(),
});

export async function POST(req: Request) {
  // Throttle anonymous account creation per source IP.
  const limit = rateLimit(`register:${clientIp(req)}`, {
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (!limit.ok) return tooManyRequests(limit.retryAfterMs);

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 400 }
      );
    }
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash,
        systemRole:
          data.role === "TEACHER" ? SystemRole.TEACHER : SystemRole.STUDENT,
      },
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
