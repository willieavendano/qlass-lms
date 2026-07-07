import nodemailer, { type Transporter } from "nodemailer";

/** SMTP transport built from env. Email is optional: when unconfigured every
 *  send is a logged no-op so the app behaves identically without SMTP. */

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

let cached: Transporter | null = null;

function getTransport(): Transporter {
  if (cached) return cached;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return cached;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Sends one email. Never throws: delivery problems are logged so callers
 *  (request handlers) are never failed by the mail server. */
export async function sendEmail(msg: OutgoingEmail): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[email] SMTP not configured; skipping "${msg.subject}" to ${msg.to}`);
    return false;
  }
  try {
    await getTransport().sendMail({
      from: process.env.SMTP_FROM ?? "noreply@qlass.local",
      ...msg,
    });
    return true;
  } catch (e) {
    console.error(`[email] failed to send "${msg.subject}" to ${msg.to}:`, e);
    return false;
  }
}
