import { NextResponse } from "next/server";
import { z } from "zod";
import { ClassRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requireClassAccess } from "@/lib/permissions";

const schema = z.object({
  name: z.string().min(1).optional(),
  section: z.string().optional(),
  bannerColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  const membership = await requireClassAccess(session.user.id, params.id, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const data = schema.parse(await req.json());
  const classroom = await prisma.class.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ class: classroom });
}
