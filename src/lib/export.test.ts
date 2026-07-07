import { describe, it, expect } from "vitest";
import { buildUserExport, planClassDeletion } from "./export";

describe("buildUserExport", () => {
  it("shapes a versioned document with an ISO timestamp", () => {
    const doc = buildUserExport({
      generatedAt: new Date("2026-07-07T12:00:00Z"),
      profile: {
        id: "u1",
        name: "Willie",
        email: "w@x.test",
        systemRole: "TEACHER",
        emailDigest: "DAILY",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
      memberships: [
        { role: "OWNER", joinedAt: new Date(), class: { id: "c1", name: "AP Stats" } },
      ],
      authoredPosts: [],
      submissions: [],
      comments: [],
      notifications: [],
    });
    expect(doc.version).toBe(1);
    expect(doc.generatedAt).toBe("2026-07-07T12:00:00.000Z");
    expect(doc.profile.email).toBe("w@x.test");
    expect(doc.memberships[0].class.name).toBe("AP Stats");
    expect(doc).not.toHaveProperty("passwordHash");
  });
});

describe("planClassDeletion", () => {
  it("blocks classes the user solely owns that still have members", () => {
    const plan = planClassDeletion([
      { id: "c1", name: "AP Stats", otherOwnerCount: 0, otherMemberCount: 12 },
    ]);
    expect(plan.blockingClasses).toEqual([{ id: "c1", name: "AP Stats" }]);
    expect(plan.removableClassIds).toEqual([]);
  });

  it("removes empty solely-owned classes with the account", () => {
    const plan = planClassDeletion([
      { id: "c2", name: "Sandbox", otherOwnerCount: 0, otherMemberCount: 0 },
    ]);
    expect(plan.blockingClasses).toEqual([]);
    expect(plan.removableClassIds).toEqual(["c2"]);
  });

  it("leaves co-owned classes alone (neither blocking nor removable)", () => {
    const plan = planClassDeletion([
      { id: "c3", name: "Team-taught", otherOwnerCount: 1, otherMemberCount: 25 },
    ]);
    expect(plan.blockingClasses).toEqual([]);
    expect(plan.removableClassIds).toEqual([]);
  });
});
