import { describe, it, expect } from "vitest";
import {
  csvCell,
  buildGradebookCsv,
  type GradebookStudent,
  type GradebookAssignment,
  type GradeLookup,
} from "./gradebook";

describe("csvCell", () => {
  it("passes simple values through", () => {
    expect(csvCell("Ada")).toBe("Ada");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes and escapes commas, quotes, and newlines", () => {
    expect(csvCell("Lovelace, Ada")).toBe('"Lovelace, Ada"');
    expect(csvCell('She said "hi"')).toBe('"She said ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("buildGradebookCsv", () => {
  const students: GradebookStudent[] = [
    { id: "s1", name: "Ada Lovelace", email: "ada@example.edu" },
    { id: "s2", name: "Alan Turing", email: "alan@example.edu" },
  ];
  const assignments: GradebookAssignment[] = [
    { id: "a1", title: "Essay 1", points: 100 },
    { id: "a2", title: "Quiz, midterm", points: 20 },
  ];

  function lookup(): GradeLookup {
    const g: GradeLookup = new Map();
    g.set("a1", new Map([["s1", { points: 90, max: 100 }]])); // only Ada graded
    g.set(
      "a2",
      new Map([
        ["s1", { points: 18, max: 20 }],
        ["s2", { points: 20, max: 20 }],
      ])
    );
    return g;
  }

  it("renders a header with per-assignment max points and totals", () => {
    const csv = buildGradebookCsv(students, assignments, lookup());
    const header = csv.split("\r\n")[0];
    expect(header).toBe(
      'Student,Email,Essay 1 (/100),"Quiz, midterm (/20)",Points Earned,Points Possible,Overall %'
    );
  });

  it("computes a running overall % over only graded assignments", () => {
    const rows = buildGradebookCsv(students, assignments, lookup()).split("\r\n");
    // Ada: 90/100 + 18/20 = 108/120 = 90.0%
    expect(rows[1]).toBe("Ada Lovelace,ada@example.edu,90,18,108,120,90.0%");
    // Alan: only a2 graded -> 20/20 = 100.0%, a1 cell blank
    expect(rows[2]).toBe("Alan Turing,alan@example.edu,,20,20,20,100.0%");
  });

  it("leaves Overall % blank when a student has no grades", () => {
    const csv = buildGradebookCsv(students, assignments, new Map());
    const rows = csv.split("\r\n");
    expect(rows[1]).toBe("Ada Lovelace,ada@example.edu,,,0,0,");
    expect(rows[2]).toBe("Alan Turing,alan@example.edu,,,0,0,");
  });

  it("ends with a trailing CRLF", () => {
    expect(buildGradebookCsv(students, assignments, lookup())).toMatch(/\r\n$/);
  });
});
