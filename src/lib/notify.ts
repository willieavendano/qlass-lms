import { EmailDigest, type NotificationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { renderNotificationEmail } from "@/lib/email-templates";

export type NotificationPayload = {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
};

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "http://localhost:3000";
}

/** Single entry point for notifying users: writes Notification rows, then
 *  emails recipients whose preference is IMMEDIATE. Email failures never
 *  propagate to the caller. */
export async function notifyUsers(
  userIds: string[],
  payload: NotificationPayload
): Promise<void> {
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? undefined,
      link: payload.link ?? undefined,
    })),
  });

  try {
    const immediate = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        emailDigest: EmailDigest.IMMEDIATE,
        suspended: false,
      },
      select: { email: true },
    });
    if (immediate.length === 0) return;
    const rendered = renderNotificationEmail(payload, baseUrl());
    await Promise.allSettled(
      immediate.map((u) => sendEmail({ to: u.email, ...rendered }))
    );
  } catch (e) {
    console.error("[notify] immediate email dispatch failed:", e);
  }
}
