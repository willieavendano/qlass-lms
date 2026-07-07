import { NextResponse } from "next/server";
import { z } from "zod";
import { EmailDigest } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";

const schema = z.object({
  emailDigest: z.nativeEnum(EmailDigest),
});

export async function GET() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailDigest: true },
  });
  return NextResponse.json({ emailDigest: user?.emailDigest ?? EmailDigest.DAILY });
}

export async function PATCH(req: Request) {
  const session = await requireSession();
  try {
    const data = schema.parse(await req.json());
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { emailDigest: data.emailDigest },
      select: { emailDigest: true },
    });
    return NextResponse.json({ emailDigest: user.emailDigest });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to update preference" }, { status: 500 });
  }
}
