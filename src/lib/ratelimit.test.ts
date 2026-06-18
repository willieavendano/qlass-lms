import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimits } from "./ratelimit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit within a window, then blocks", () => {
    const opts = { limit: 3, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 100).ok).toBe(true);
    expect(rateLimit("k", opts, 200).ok).toBe(true);
    const blocked = rateLimit("k", opts, 300);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(700); // resetAt(1000) - now(300)
  });

  it("resets after the window elapses", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).ok).toBe(true);
    expect(rateLimit("k", opts, 500).ok).toBe(false);
    expect(rateLimit("k", opts, 1000).ok).toBe(true); // new window
  });

  it("tracks keys independently", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("a", opts, 0).ok).toBe(true);
    expect(rateLimit("b", opts, 0).ok).toBe(true);
    expect(rateLimit("a", opts, 0).ok).toBe(false);
  });

  it("reports remaining allowance", () => {
    const opts = { limit: 2, windowMs: 1000 };
    expect(rateLimit("k", opts, 0).remaining).toBe(1);
    expect(rateLimit("k", opts, 0).remaining).toBe(0);
  });
});
