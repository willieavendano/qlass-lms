import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await requireSession();
  if (!isAdmin(session.user.systemRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      systemRole: true,
      suspended: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ users });
}
