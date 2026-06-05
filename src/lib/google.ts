import { google, classroom_v1, drive_v3 } from "googleapis";
import { prisma } from "@/lib/db";

/**
 * OAuth scopes the Classroom import requires beyond the basic login scopes.
 * These are SENSITIVE/RESTRICTED Google scopes — an unverified app may use them
 * for up to 100 test users; production use requires Google OAuth verification.
 */
export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.topics.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
];

/** Drive is needed to download file attachments referenced by Classroom materials. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

/** Full scope string for the incremental "Connect Google Classroom" sign-in. */
export const CONNECT_SCOPES = [
  "openid",
  "email",
  "profile",
  ...CLASSROOM_SCOPES,
  DRIVE_SCOPE,
].join(" ");

export type NotConnectedReason = "not_connected" | "missing_scopes";

/** Thrown when the current user has no usable Google Classroom authorization. */
export class GoogleNotConnectedError extends Error {
  constructor(public reason: NotConnectedReason) {
    super(reason);
    this.name = "GoogleNotConnectedError";
  }
}

/**
 * Fetch the user's linked Google account and verify it carries the Classroom
 * scopes. Throws GoogleNotConnectedError if absent or under-scoped.
 */
export async function getGoogleAccount(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) {
    throw new GoogleNotConnectedError("not_connected");
  }
  const granted = new Set(account.scope?.split(" ") ?? []);
  const missing = CLASSROOM_SCOPES.some((s) => !granted.has(s));
  if (missing) {
    throw new GoogleNotConnectedError("missing_scopes");
  }
  return account;
}

/**
 * Build an OAuth2 client seeded with the user's stored tokens. googleapis
 * auto-refreshes the access token when it expires (a refresh_token is present);
 * the "tokens" listener persists any refreshed credentials back to the Account.
 */
async function getOAuthClient(userId: string) {
  const account = await getGoogleAccount(userId);
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2.setCredentials({
    access_token: account.access_token ?? undefined,
    refresh_token: account.refresh_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    scope: account.scope ?? undefined,
  });
  oauth2.on("tokens", (tokens) => {
    // Persist refreshed credentials. Fire-and-forget — failing to cache a
    // refreshed token should not break the in-flight request.
    void prisma.account
      .update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token ?? account.access_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : account.expires_at,
          ...(tokens.refresh_token
            ? { refresh_token: tokens.refresh_token }
            : {}),
        },
      })
      .catch(() => {});
  });
  return oauth2;
}

export async function getClassroomClient(
  userId: string
): Promise<classroom_v1.Classroom> {
  const auth = await getOAuthClient(userId);
  return google.classroom({ version: "v1", auth });
}

export async function getDriveClient(userId: string): Promise<drive_v3.Drive> {
  const auth = await getOAuthClient(userId);
  return google.drive({ version: "v3", auth });
}
