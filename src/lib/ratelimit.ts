/**
 * Minimal fixed-window in-memory rate limiter. Sufficient for the single-
 * instance Railway deployment used in the pilot. If/when Qlass runs multiple
 * instances, swap this for a shared store (e.g. Upstash Redis) keyed the same
 * way — the call sites won't need to change.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now()
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    // Opportunistically sweep expired buckets so the map can't grow unbounded
    // under a flood of distinct keys.
    if (buckets.size >= MAX_BUCKETS) {
      buckets.forEach((b, k) => {
        if (now >= b.resetAt) buckets.delete(k);
      });
    }
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= opts.limit) {
    return { ok: false, remaining: 0, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { ok: true, remaining: opts.limit - existing.count, retryAfterMs: 0 };
}

/** Test/utility hook to clear all buckets. */
export function resetRateLimits() {
  buckets.clear();
}

/**
 * Best-effort client IP from proxy headers (Railway/Vercel set
 * `x-forwarded-for`). Falls back to a constant so the limiter still applies a
 * shared bucket rather than failing open per-request.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Standard 429 body + Retry-After header for an over-limit request. */
export function tooManyRequests(retryAfterMs: number): Response {
  const retryAfter = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
