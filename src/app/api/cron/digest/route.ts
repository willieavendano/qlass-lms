import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { EmailDigest } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderDigestEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

const FALLBACK_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Daily digest sender. Auth is a shared secret (external scheduler), not a
 *  session — this route must stay out of the NextAuth middleware matcher. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  }
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ sent: 0, skipped: "SMTP not configured" });
  }

  const now = new Date();
  const users = await prisma.user.findMany({
    where: { emailDigest: EmailDigest.DAILY, suspended: false },
    select: { id: true, email: true, digestSentAt: true },
  });

  let sent = 0;
  for (const user of users) {
    const since = user.digestSentAt ?? new Date(now.getTime() - FALLBACK_WINDOW_MS);
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, read: false, createdAt: { gt: since } },
      orderBy: { createdAt: "asc" },
      select: { title: true, body: true, link: true },
    });
    if (notifications.length === 0) continue;

    const rendered = renderDigestEmail(
      notifications,
      process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    );
    const ok = await sendEmail({ to: user.email, ...rendered });
    if (ok) {
      await prisma.user.update({
        where: { id: user.id },
        data: { digestSentAt: now },
      });
      sent += 1;
    }
  }

  return NextResponse.json({ sent, checked: users.length });
}
