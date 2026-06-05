import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await requireSession();
  if (!isAdmin(session.user.systemRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { suspended: body.suspended },
  });
  return NextResponse.json({ user });
}
