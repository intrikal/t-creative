// @vitest-environment node

/**
 * tests/unit/rate-limiter.test.ts
 *
 * Unit tests for the rate-limiting logic in proxy.ts.
 *
 * Actual rate-limited endpoints (4, not 8):
 *   /api/chat/fallback        — 10 req / 60 s
 *   /api/book/guest-request   —  5 req / 60 s
 *   /api/book/waitlist        —  5 req / 60 s
 *   /api/book/upload-reference — 20 req / 60 s
 *
 * Strategy:
 *   - Mock @upstash/ratelimit so Ratelimit.limit() returns controlled results.
 *   - Mock @/lib/redis and @supabase/ssr so the proxy doesn't make network calls.
 *   - Call proxy() directly with a fake NextRequest.
 *   - Assert on the returned NextResponse.
 *
 * NOTE on spec vs reality:
 *   - The proxy currently returns a plain 429 with no X-RateLimit-* headers.
 *     Tests 8 (headers) document that gap.
 *   - The proxy has no explicit fail-open guard for Redis errors — a thrown
 *     error from Ratelimit.limit() would propagate. Tests 6–7 document that gap.
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// vi.hoisted ensures these are available inside vi.mock factories (which are hoisted)
const { mockLimit, RatelimitConstructor } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  // Must be a real function (not arrow) for `new` to work; vi.fn wraps it so .mock is trackable
  const RatelimitConstructor = vi.fn(function () {
    return { limit: mockLimit };
  });
  return { mockLimit, RatelimitConstructor };
});

vi.mock("@upstash/ratelimit", () => {
  // Ratelimit.slidingWindow is a static factory used in the RATE_LIMITS config
  (RatelimitConstructor as unknown as Record<string, unknown>).slidingWindow = vi.fn(
    (count: number, window: string) => ({ count, window }),
  );
  return { Ratelimit: RatelimitConstructor };
});

// Mock redis so the module-level `new Redis(...)` in lib/redis.ts doesn't fire
vi.mock("@/lib/redis", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

// Mock lib/env so Zod validation doesn't throw at import time
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder-anon-key",
    DATABASE_POOLER_URL: "postgresql://localhost:6543/test",
    DIRECT_URL: "postgresql://localhost:5432/test",
    UPSTASH_REDIS_REST_URL: "https://placeholder.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "placeholder-token",
    RESEND_API_KEY: "re_placeholder",
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "0x_placeholder",
  },
}));

// Mock Supabase SSR so session refresh + ban check don't make network calls
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

// ─── Import AFTER mocks ───────────────────────────────────────────────────────

import { proxy } from "@/proxy";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(pathname: string, method = "POST", ip = "1.2.3.4"): NextRequest {
  const req = new NextRequest(`http://localhost${pathname}`, { method });
  req.headers.set("x-forwarded-for", ip);
  return req;
}

const RATE_LIMITED_PATHS = [
  "/api/chat/fallback",
  "/api/book/guest-request",
  "/api/book/waitlist",
  "/api/book/upload-reference",
];

// ─────────────────────────────────────────────────────────────────────────────
// 1. Endpoint config — correct sliding window params
// ─────────────────────────────────────────────────────────────────────────────

describe("RATE_LIMITS config — endpoint sliding window params", () => {
  it("creates a Ratelimit instance for each rate-limited path", () => {
    // RatelimitConstructor is called once per path at module load
    expect(RatelimitConstructor.mock.calls.length).toBeGreaterThanOrEqual(
      RATE_LIMITED_PATHS.length,
    );
  });

  it("slidingWindow is called with correct params for /api/chat/fallback (10 req / 60s)", () => {
    const slidingWindow = (
      RatelimitConstructor as unknown as Record<string, ReturnType<typeof vi.fn>>
    ).slidingWindow;
    const match = slidingWindow.mock.calls.find(
      ([count, window]: [number, string]) => count === 10 && window === "60 s",
    );
    expect(match, "/api/chat/fallback should use slidingWindow(10, '60 s')").toBeDefined();
  });

  it("slidingWindow is called with correct params for /api/book/guest-request (5 req / 60s)", () => {
    const slidingWindow = (
      RatelimitConstructor as unknown as Record<string, ReturnType<typeof vi.fn>>
    ).slidingWindow;
    const fivePerMin = slidingWindow.mock.calls.filter(
      ([count, window]: [number, string]) => count === 5 && window === "60 s",
    );
    expect(fivePerMin.length, "two endpoints use slidingWindow(5, '60 s')").toBeGreaterThanOrEqual(
      2,
    );
  });

  it("slidingWindow is called with correct params for /api/book/upload-reference (20 req / 60s)", () => {
    const slidingWindow = (
      RatelimitConstructor as unknown as Record<string, ReturnType<typeof vi.fn>>
    ).slidingWindow;
    const match = slidingWindow.mock.calls.find(
      ([count, window]: [number, string]) => count === 20 && window === "60 s",
    );
    expect(match, "/api/book/upload-reference should use slidingWindow(20, '60 s')").toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Under limit — request passes through
// ─────────────────────────────────────────────────────────────────────────────

describe("under limit — request passes through", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({
      success: true,
      remaining: 4,
      limit: 5,
      reset: Date.now() + 60_000,
    });
  });

  for (const path of RATE_LIMITED_PATHS) {
    it(`${path} — under limit returns non-429 response`, async () => {
      const res = await proxy(makeRequest(path));
      expect(res.status).not.toBe(429);
    });
  }

  it("GET requests are never rate-limited (only POST)", async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0, limit: 5, reset: 0 });
    const res = await proxy(makeRequest("/api/book/guest-request", "GET"));
    expect(res.status).not.toBe(429);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3 & 4. At / over limit — request returns 429
// ─────────────────────────────────────────────────────────────────────────────

describe("at or over limit — returns 429", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 5,
      reset: Date.now() + 30_000,
    });
  });

  for (const path of RATE_LIMITED_PATHS) {
    it(`${path} — at limit returns 429`, async () => {
      const res = await proxy(makeRequest(path));
      expect(res.status).toBe(429);
    });
  }

  it("response body contains error message", async () => {
    const res = await proxy(makeRequest("/api/book/guest-request"));
    const body = await res.json();
    expect(body.error).toMatch(/too many requests/i);
  });

  it("response Content-Type is application/json", async () => {
    const res = await proxy(makeRequest("/api/chat/fallback"));
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Independent limits — hitting one endpoint doesn't affect another
// ─────────────────────────────────────────────────────────────────────────────

describe("independent limits per endpoint", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exhausting /api/book/guest-request limit does not block /api/chat/fallback", async () => {
    // Return limited for guest-request, allowed for chat/fallback
    mockLimit
      .mockResolvedValueOnce({ success: false, remaining: 0, limit: 5, reset: 0 }) // guest-request blocked
      .mockResolvedValueOnce({ success: true, remaining: 9, limit: 10, reset: 0 }); // chat/fallback passes

    const res1 = await proxy(makeRequest("/api/book/guest-request"));
    const res2 = await proxy(makeRequest("/api/chat/fallback"));

    expect(res1.status).toBe(429);
    expect(res2.status).not.toBe(429);
  });

  it("exhausting /api/book/waitlist limit does not block /api/book/upload-reference", async () => {
    mockLimit
      .mockResolvedValueOnce({ success: false, remaining: 0, limit: 5, reset: 0 })
      .mockResolvedValueOnce({ success: true, remaining: 19, limit: 20, reset: 0 });

    const res1 = await proxy(makeRequest("/api/book/waitlist"));
    const res2 = await proxy(makeRequest("/api/book/upload-reference"));

    expect(res1.status).toBe(429);
    expect(res2.status).not.toBe(429);
  });

  it("non-rate-limited endpoints are never blocked regardless of limit state", async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0, limit: 0, reset: 0 });

    const res = await proxy(makeRequest("/api/health"));
    expect(res.status).not.toBe(429);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6 & 7. Redis / Ratelimit failure behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("Redis failure behaviour (documents current behaviour — NOT fail-open)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Redis connection failure causes proxy() to throw (no fail-open guard currently)", async () => {
    // The proxy has no try/catch around limiter.limit() — an error propagates.
    // This test documents the current behaviour. To make it fail-open,
    // wrap the limiter.limit() call in a try/catch in proxy.ts.
    mockLimit.mockRejectedValue(new Error("Redis connection refused"));

    await expect(proxy(makeRequest("/api/chat/fallback"))).rejects.toThrow(
      "Redis connection refused",
    );
  });

  it("Redis timeout causes proxy() to throw (no fail-open guard currently)", async () => {
    mockLimit.mockImplementation(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 10)),
    );

    await expect(proxy(makeRequest("/api/book/guest-request"))).rejects.toThrow("timeout");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Rate limit response headers (documents current gap — headers not set)
// ─────────────────────────────────────────────────────────────────────────────

describe("rate limit response headers (documents current gap)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      limit: 5,
      reset: Date.now() + 30_000,
    });
  });

  it("429 response does NOT include X-RateLimit-Limit header (gap: not implemented)", async () => {
    // Documents that X-RateLimit-* headers are absent in the current implementation.
    // To fix: add headers to the 429 response in proxy.ts using the limit result.
    const res = await proxy(makeRequest("/api/chat/fallback"));
    expect(res.status).toBe(429);
    expect(res.headers.get("x-ratelimit-limit")).toBeNull();
    expect(res.headers.get("x-ratelimit-remaining")).toBeNull();
    expect(res.headers.get("x-ratelimit-reset")).toBeNull();
    expect(res.headers.get("retry-after")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Rate limit key uses client IP
// ─────────────────────────────────────────────────────────────────────────────

describe("rate limit key uses client IP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue({ success: true, remaining: 4, limit: 5, reset: 0 });
  });

  it("limit() is called with the x-forwarded-for IP", async () => {
    await proxy(makeRequest("/api/chat/fallback", "POST", "99.88.77.66"));
    expect(mockLimit).toHaveBeenCalledWith("99.88.77.66");
  });

  it("limit() is called with first IP when x-forwarded-for has multiple values", async () => {
    const req = new NextRequest("http://localhost/api/chat/fallback", { method: "POST" });
    req.headers.set("x-forwarded-for", "10.0.0.1, 172.16.0.1, 192.168.1.1");
    await proxy(req);
    expect(mockLimit).toHaveBeenCalledWith("10.0.0.1");
  });

  it("limit() uses 'unknown' when no IP header is present", async () => {
    const req = new NextRequest("http://localhost/api/chat/fallback", { method: "POST" });
    await proxy(req);
    expect(mockLimit).toHaveBeenCalledWith("unknown");
  });

  it("different IPs are tracked independently (mockLimit called with correct IP each time)", async () => {
    await proxy(makeRequest("/api/chat/fallback", "POST", "1.1.1.1"));
    await proxy(makeRequest("/api/chat/fallback", "POST", "2.2.2.2"));

    expect(mockLimit).toHaveBeenNthCalledWith(1, "1.1.1.1");
    expect(mockLimit).toHaveBeenNthCalledWith(2, "2.2.2.2");
  });
});
