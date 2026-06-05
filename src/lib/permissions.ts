import { ClassRole, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function getClassMembership(userId: string, classId: string) {
  return prisma.classMembership.findUnique({
    where: { classId_userId: { classId, userId } },
  });
}

export async function requireClassAccess(
  userId: string,
  classId: string,
  minRole?: ClassRole[]
) {
  const membership = await getClassMembership(userId, classId);
  if (!membership) return null;
  if (minRole && !minRole.includes(membership.role)) return null;
  return membership;
}

export function isTeacherRole(role: ClassRole) {
  return role === ClassRole.OWNER || role === ClassRole.TEACHER;
}

export async function requireTeacherInClass(userId: string, classId: string) {
  const membership = await requireClassAccess(userId, classId, [
    ClassRole.OWNER,
    ClassRole.TEACHER,
  ]);
  return membership;
}

export function isAdmin(systemRole: SystemRole) {
  return systemRole === SystemRole.ADMIN;
}
