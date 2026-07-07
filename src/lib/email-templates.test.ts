import { describe, it, expect } from "vitest";
import {
  absoluteLink,
  renderNotificationEmail,
  renderDigestEmail,
} from "./email-templates";

const BASE = "http://localhost:3000";

describe("absoluteLink", () => {
  it("resolves relative links against the base URL", () => {
    expect(absoluteLink(BASE, "/class/abc/stream")).toBe(
      "http://localhost:3000/class/abc/stream"
    );
  });

  it("handles trailing slash on base and missing leading slash on link", () => {
    expect(absoluteLink("http://x.test/", "settings")).toBe("http://x.test/settings");
  });

  it("passes through absolute links and returns null for empty ones", () => {
    expect(absoluteLink(BASE, "https://other.test/y")).toBe("https://other.test/y");
    expect(absoluteLink(BASE, null)).toBeNull();
  });
});

describe("renderNotificationEmail", () => {
  it("uses the title as subject and includes body and link", () => {
    const email = renderNotificationEmail(
      { title: "New assignment: Essay 1", body: "Due 7/10", link: "/class/c1/assignments/p1" },
      BASE
    );
    expect(email.subject).toBe("New assignment: Essay 1");
    expect(email.text).toContain("Due 7/10");
    expect(email.text).toContain("http://localhost:3000/class/c1/assignments/p1");
    expect(email.html).toContain("Open in Qlass");
  });

  it("escapes HTML in user-provided content", () => {
    const email = renderNotificationEmail(
      { title: "<script>alert(1)</script>", body: "a & b" },
      BASE
    );
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("a &amp; b");
  });
});

describe("renderDigestEmail", () => {
  it("counts updates in the subject and lists each notification", () => {
    const email = renderDigestEmail(
      [
        { title: "Grade posted: Quiz 1", body: "9 points", link: "/class/c1/assignments/p2" },
        { title: "New announcement in class", link: "/class/c1/stream" },
      ],
      BASE
    );
    expect(email.subject).toBe("Qlass daily digest: 2 updates");
    expect(email.text).toContain("Grade posted: Quiz 1");
    expect(email.text).toContain("New announcement in class");
    expect(email.html).toContain("/class/c1/assignments/p2");
  });

  it("uses singular wording for one update", () => {
    expect(renderDigestEmail([{ title: "x" }], BASE).subject).toBe(
      "Qlass daily digest: 1 update"
    );
  });
});
