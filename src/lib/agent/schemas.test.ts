import { describe, it, expect } from "vitest";
import { unitOutlineSchema, unitDraftsSchema, unitReviewSchema } from "./schemas";
import { buildReviewPrompt } from "./unit-builder";

describe("agent schemas", () => {
  it("accepts a valid outline", () => {
    const ok = unitOutlineSchema.safeParse({
      title: "Sampling Distributions",
      objectives: ["Understand sampling variability"],
      lessons: [{ title: "Intro", summary: "What is a sampling distribution" }],
    });
    expect(ok.success).toBe(true);
  });

  it("rejects drafts with no assignments", () => {
    const bad = unitDraftsSchema.safeParse({
      assignments: [],
      material: { title: "x", body: "y" },
    });
    expect(bad.success).toBe(false);
  });

  it("accepts a valid review and rejects out-of-range clarity", () => {
    const review = {
      summary: "Solid drafts; one ambiguous prompt.",
      clarityScore: 4,
      gradeLevelFit: "on_level",
      sourceSafety: "pass",
      findings: [
        {
          target: "assignment 1: Intro",
          severity: "warn",
          issue: "Question 3 is ambiguous",
          suggestion: "Specify which dataset to use",
        },
      ],
    };
    expect(unitReviewSchema.safeParse(review).success).toBe(true);
    expect(
      unitReviewSchema.safeParse({ ...review, clarityScore: 6 }).success
    ).toBe(false);
    expect(
      unitReviewSchema.safeParse({ ...review, gradeLevelFit: "way_off" }).success
    ).toBe(false);
  });
});

describe("buildReviewPrompt", () => {
  const input = { topic: "Stats", gradeLevel: "AP", assignmentCount: 1 };
  const outline = {
    title: "Sampling Distributions",
    objectives: ["Understand sampling variability"],
    lessons: [{ title: "Intro", summary: "s" }],
  };
  const drafts = {
    assignments: [
      {
        title: "CLT worksheet",
        instructions: "Do the worksheet",
        points: 10,
        questions: ["What is the CLT?"],
      },
    ],
    material: { title: "Explainer", body: "The CLT says..." },
  };

  it("includes drafts, grade level, and the proprietary-source denylist", () => {
    const prompt = buildReviewPrompt(input, outline, drafts);
    expect(prompt).toContain("CLT worksheet");
    expect(prompt).toContain("intended grade level: AP");
    expect(prompt).toContain("collegeboard.org");
  });
});
