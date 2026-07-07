/**
 * Pure gradebook CSV shaping — kept DB-agnostic so it can be unit tested
 * without a database. The route layer (`/api/classes/[id]/grades/export`)
 * queries Prisma and feeds plain objects in here.
 */

export type GradebookStudent = {
  id: string;
  name: string | null;
  email: string | null;
};

export type GradebookAssignment = {
  id: string;
  title: string;
  points: number | null;
};

export type GradebookGrade = {
  points: number;
  /** Max for this grade; null when neither the grade nor assignment set one. */
  max: number | null;
};

/** grades[assignmentId][studentId] -> grade, present only when graded. */
export type GradeLookup = Map<string, Map<string, GradebookGrade>>;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(",");
}

/**
 * Build a students(rows) × assignments(columns) CSV. The "Overall %" is a
 * running average over only the assignments a student has actually been graded
 * on — not the full term — so it's meaningful mid-semester.
 */
export function buildGradebookCsv(
  students: GradebookStudent[],
  assignments: GradebookAssignment[],
  grades: GradeLookup
): string {
  const header = [
    "Student",
    "Email",
    ...assignments.map(
      (a) => `${a.title}${a.points != null ? ` (/${a.points})` : ""}`
    ),
    "Points Earned",
    "Points Possible",
    "Overall %",
  ];

  const rows = students.map((student) => {
    const cells: Array<string | number | null> = [
      student.name ?? "",
      student.email ?? "",
    ];
    let earned = 0;
    let possible = 0;
    for (const assignment of assignments) {
      const grade = grades.get(assignment.id)?.get(student.id);
      if (grade) {
        cells.push(grade.points);
        earned += grade.points;
        if (grade.max !== null) possible += grade.max;
      } else {
        cells.push(""); // not yet graded / not submitted
      }
    }
    const overall =
      possible > 0 ? `${((earned / possible) * 100).toFixed(1)}%` : "";
    cells.push(Number(earned.toFixed(2)), Number(possible.toFixed(2)), overall);
    return cells;
  });

  return [csvRow(header), ...rows.map(csvRow)].join("\r\n") + "\r\n";
}
