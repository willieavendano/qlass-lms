import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNow } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Relative, human time like "3 hours ago" — for stream/notification bylines. */
export function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Generate a join code that isn't already taken. Retries up to `attempts`
 * times; falls back to the last generated code if all attempts collide.
 * Server-only (touches the database) — kept here as a pure helper that takes
 * the lookup function so it stays importable without pulling in Prisma.
 */
export async function generateUniqueJoinCode(
  exists: (code: string) => Promise<boolean>,
  attempts = 10
): Promise<string> {
  let code = generateJoinCode();
  for (let i = 0; i < attempts; i++) {
    if (!(await exists(code))) return code;
    code = generateJoinCode();
  }
  return code;
}

export function formatDueDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
