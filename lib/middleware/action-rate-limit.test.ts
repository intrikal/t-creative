import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the action rate limiter (createActionLimiter).
 *
 * Covers:
 *  - Calls ratelimit.limit() with the authenticated user's ID
 *  - Throws when the rate limit is exceeded
 *  - Passes through silently when Redis is not configured (dev environment)
 *
 * Mocks: @/lib/redis, @upstash/ratelimit, @/lib/auth
 */

const mockLimit = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/auth", () => ({
  getUser: mockGetUser,
}));

vi.mock("@/lib/redis", () => ({
  redis: {},
}));

vi.mock("@upstash/ratelimit", () => {
  class MockRatelimit {
    limit = mockLimit;
    static slidingWindow = vi.fn().mockReturnValue("sliding-window-config");
  }
  return { Ratelimit: MockRatelimit };
});

describe("lib/middleware/action-rate-limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-123", email: "test@example.com" });
    mockLimit.mockResolvedValue({ success: true });
    // Default: Redis is configured
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("calls ratelimit.limit with the authenticated user ID", async () => {
    const { createActionLimiter } = await import("./action-rate-limit");
    const limiter = createActionLimiter("test-action", { requests: 10, window: "60 s" });

    await limiter();

    expect(mockGetUser).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalledWith("user-123");
  });

  it("throws when rate limit is exceeded", async () => {
    mockLimit.mockResolvedValue({ success: false });

    const { createActionLimiter } = await import("./action-rate-limit");
    const limiter = createActionLimiter("test-action", { requests: 5, window: "60 s" });

    await expect(limiter()).rejects.toThrow("Rate limit exceeded. Please try again shortly.");
  });

  it("does not throw when rate limit is not exceeded", async () => {
    mockLimit.mockResolvedValue({ success: true });

    const { createActionLimiter } = await import("./action-rate-limit");
    const limiter = createActionLimiter("test-action", { requests: 10, window: "60 s" });

    await expect(limiter()).resolves.toBeUndefined();
  });

  it("skips rate limiting when Redis is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { createActionLimiter } = await import("./action-rate-limit");
    const limiter = createActionLimiter("test-action", { requests: 10, window: "60 s" });

    await expect(limiter()).resolves.toBeUndefined();
    expect(mockLimit).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });
});
