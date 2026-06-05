import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

export async function GET() {
  const session = await requireSession();
  if (!isAdmin(session.user.systemRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [users, classes, posts, submissions] = await Promise.all([
    prisma.user.count(),
    prisma.class.count(),
    prisma.post.count(),
    prisma.submission.count(),
  ]);
  return NextResponse.json({
    stats: { users, classes, posts, submissions },
  });
}
