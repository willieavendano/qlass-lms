import { describe, it, expect } from "vitest";
import { unitOutlineSchema, unitDraftsSchema } from "./schemas";

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
});
