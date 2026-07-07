/** Pure render functions for notification emails. No transport, no Prisma. */

export type EmailNotification = {
  title: string;
  body?: string | null;
  link?: string | null;
};

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolves a notification link (stored as a relative path) against the app base URL. */
export function absoluteLink(baseUrl: string, link?: string | null): string | null {
  if (!link) return null;
  if (/^https?:\/\//.test(link)) return link;
  return `${baseUrl.replace(/\/$/, "")}${link.startsWith("/") ? "" : "/"}${link}`;
}

const FOOTER_TEXT =
  "You are receiving this because of your Qlass email preferences. Change them in Settings.";

function wrapHtml(inner: string, baseUrl: string): string {
  const settingsUrl = absoluteLink(baseUrl, "/settings");
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1e293b">
${inner}
<p style="margin-top:32px;font-size:12px;color:#64748b">${FOOTER_TEXT.replace(
    "Settings",
    `<a href="${settingsUrl}" style="color:#64748b">Settings</a>`
  )}</p>
</div>`;
}

/** Single-notification email (IMMEDIATE preference). */
export function renderNotificationEmail(
  n: EmailNotification,
  baseUrl: string
): RenderedEmail {
  const url = absoluteLink(baseUrl, n.link);
  const textParts = [n.title];
  if (n.body) textParts.push(n.body);
  if (url) textParts.push(`View: ${url}`);
  textParts.push("", FOOTER_TEXT);

  const htmlParts = [`<h2 style="font-size:18px;margin:0 0 8px">${escapeHtml(n.title)}</h2>`];
  if (n.body) htmlParts.push(`<p style="margin:0 0 16px">${escapeHtml(n.body)}</p>`);
  if (url)
    htmlParts.push(
      `<p><a href="${url}" style="display:inline-block;background:#1e293b;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none">Open in Qlass</a></p>`
    );

  return {
    subject: n.title,
    text: textParts.join("\n"),
    html: wrapHtml(htmlParts.join("\n"), baseUrl),
  };
}

/** Daily-digest email summarizing several notifications. */
export function renderDigestEmail(
  notifications: EmailNotification[],
  baseUrl: string
): RenderedEmail {
  const count = notifications.length;
  const subject = `Qlass daily digest: ${count} update${count === 1 ? "" : "s"}`;

  const textLines = notifications.map((n) => {
    const url = absoluteLink(baseUrl, n.link);
    return `- ${n.title}${n.body ? ` — ${n.body}` : ""}${url ? ` (${url})` : ""}`;
  });
  const text = [subject, "", ...textLines, "", FOOTER_TEXT].join("\n");

  const items = notifications
    .map((n) => {
      const url = absoluteLink(baseUrl, n.link);
      const title = url
        ? `<a href="${url}" style="color:#1e293b">${escapeHtml(n.title)}</a>`
        : escapeHtml(n.title);
      return `<li style="margin-bottom:8px">${title}${
        n.body ? `<br/><span style="color:#64748b;font-size:13px">${escapeHtml(n.body)}</span>` : ""
      }</li>`;
    })
    .join("\n");
  const html = wrapHtml(
    `<h2 style="font-size:18px;margin:0 0 8px">Your daily Qlass digest</h2>
<ul style="padding-left:20px;margin:0">${items}</ul>`,
    baseUrl
  );

  return { subject, text, html };
}
