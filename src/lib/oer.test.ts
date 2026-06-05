import { describe, it, expect } from "vitest";
import { isAllowedSource, isDeniedSource, OER_SOURCES } from "./oer";

describe("oer rules", () => {
  it("denies College Board / AP Classroom", () => {
    expect(isDeniedSource("https://apclassroom.collegeboard.org/x")).toBe(true);
    expect(isDeniedSource("https://www.collegeboard.org/y")).toBe(true);
  });

  it("denies Canva", () => {
    expect(isDeniedSource("https://www.canva.com/design/abc")).toBe(true);
  });

  it("allows OpenStax and PhET", () => {
    expect(isAllowedSource("https://openstax.org/books/statistics")).toBe(true);
    expect(isAllowedSource("https://phet.colorado.edu/sims/x")).toBe(true);
  });

  it("treats denied sources as not allowed even if otherwise unknown", () => {
    expect(isAllowedSource("https://www.collegeboard.org/y")).toBe(false);
  });

  it("exposes a non-empty curated source list", () => {
    expect(OER_SOURCES.length).toBeGreaterThan(0);
  });
});
