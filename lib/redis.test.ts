// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/redis — shared Upstash Redis client singleton.
 *
 * Covers:
 *  - Configured (both env vars present): Redis constructor called with correct url/token
 *  - Not configured (missing env vars): no-op Proxy stub exported; method calls resolve to
 *    null without throwing — prevents build-time crashes in layouts/middleware
 *
 * Mocks: @upstash/redis (Redis class).
 * Uses vi.stubEnv + vi.resetModules to evaluate redis.ts under different env states.
 *
 * Note: Vitest 4 requires a regular `function` (not an arrow function) as the mock
 * implementation when the mock will be called with `new`.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockRedisConstructor: tracks calls to `new Redis(...)`.
// Uses a regular function expression so it is a valid constructor.
// eslint-disable-next-line prefer-arrow-callback
const mockRedisConstructor = vi.fn(function MockRedis(this: object) {
  return this;
});

// Mock @upstash/redis so tests don't need a real Upstash account
vi.mock("@upstash/redis", () => ({
  Redis: mockRedisConstructor,
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/redis", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Restore regular-function implementation after clearAllMocks resets it
    // eslint-disable-next-line prefer-arrow-callback
    mockRedisConstructor.mockImplementation(function MockRedis(this: object) {
      return this;
    });
  });

  describe("redis (configured)", () => {
    // When both required env vars are present, `new Redis({url, token})` must be called
    it("constructs a Redis client when URL and token are both set", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token-abc");

      const { redis } = await import("./redis");

      expect(mockRedisConstructor).toHaveBeenCalledOnce();
      expect(mockRedisConstructor).toHaveBeenCalledWith({
        url: "https://redis.example.upstash.io",
        token: "test-token-abc",
      });
      expect(redis).toBeDefined();
    });
  });

  describe("redis (not configured)", () => {
    // During `next build`, env vars may be absent. The stub must silently return null.
    it("returns a no-op stub and skips the constructor when URL is missing", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

      const { redis } = await import("./redis");

      expect(mockRedisConstructor).not.toHaveBeenCalled();
      // Any method call on the stub must resolve to null without throwing
      await expect(redis.get("some-key")).resolves.toBeNull();
    });

    it("returns a no-op stub and skips the constructor when token is missing", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example.upstash.io");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { redis } = await import("./redis");

      expect(mockRedisConstructor).not.toHaveBeenCalled();
      await expect(redis.get("any-key")).resolves.toBeNull();
    });

    it("returns a no-op stub when both env vars are missing", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { redis } = await import("./redis");

      expect(mockRedisConstructor).not.toHaveBeenCalled();
    });

    // The no-op stub must handle any method call without throwing
    it("no-op stub resolves to null for set, del, and other method calls", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

      const { redis } = await import("./redis");

      await expect(redis.set("k", "v")).resolves.toBeNull();
      await expect(redis.del("k")).resolves.toBeNull();
    });
  });
});
