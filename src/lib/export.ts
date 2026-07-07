/** Pure logic for the data export/delete workflow. No Prisma, no transport. */

export type ExportProfile = {
  id: string;
  name: string | null;
  email: string;
  systemRole: string;
  emailDigest: string;
  createdAt: Date;
};

export type ExportMembership = {
  role: string;
  joinedAt: Date;
  class: { id: string; name: string };
};

export type ExportPost = {
  id: string;
  classId: string;
  type: string;
  status: string;
  title: string | null;
  content: string | null;
  aiGenerated: boolean;
  createdAt: Date;
};

export type ExportSubmission = {
  id: string;
  status: string;
  turnedInAt: Date | null;
  assignmentTitle: string | null;
  classId: string;
  grade: { points: number | null; maxPoints: number | null; feedback: string | null } | null;
  attachments: { fileName: string; mimeType: string; size: number }[];
};

export type ExportComment = { id: string; content: string; createdAt: Date };
export type ExportNotification = {
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: Date;
};

export type UserExport = {
  version: 1;
  generatedAt: string;
  profile: ExportProfile;
  memberships: ExportMembership[];
  authoredPosts: ExportPost[];
  submissions: ExportSubmission[];
  comments: ExportComment[];
  notifications: ExportNotification[];
};

export function buildUserExport(input: {
  generatedAt: Date;
  profile: ExportProfile;
  memberships: ExportMembership[];
  authoredPosts: ExportPost[];
  submissions: ExportSubmission[];
  comments: ExportComment[];
  notifications: ExportNotification[];
}): UserExport {
  return {
    version: 1,
    generatedAt: input.generatedAt.toISOString(),
    profile: input.profile,
    memberships: input.memberships,
    authoredPosts: input.authoredPosts,
    submissions: input.submissions,
    comments: input.comments,
    notifications: input.notifications,
  };
}

/** A class the user owns, with counts that exclude the user themself. */
export type OwnedClassInfo = {
  id: string;
  name: string;
  otherOwnerCount: number;
  otherMemberCount: number;
};

export type DeletePlan = {
  /** Classes that block deletion: the user is the sole owner but other members remain. */
  blockingClasses: { id: string; name: string }[];
  /** Classes safe to delete with the account: sole owner, no other members. */
  removableClassIds: string[];
};

/** Partitions the user's owned classes for account deletion. Classes with a
 *  co-owner are neither blocking nor removable — they simply survive. */
export function planClassDeletion(owned: OwnedClassInfo[]): DeletePlan {
  const blockingClasses: { id: string; name: string }[] = [];
  const removableClassIds: string[] = [];
  for (const c of owned) {
    if (c.otherOwnerCount > 0) continue;
    if (c.otherMemberCount > 0) blockingClasses.push({ id: c.id, name: c.name });
    else removableClassIds.push(c.id);
  }
  return { blockingClasses, removableClassIds };
}
