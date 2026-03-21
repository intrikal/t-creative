// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Cloudflare Turnstile bot-check verifier.
 *
 * Covers:
 *  - Success: Cloudflare reports success → true
 *  - Failure: Cloudflare reports failure → false
 *  - Empty token: still sends to API, returns false
 *  - Network error: propagates (no internal catch)
 *  - Dev bypass: returns true when secret is unconfigured in development
 *  - Prod guard: returns false when secret is unconfigured in production
 *
 * Mocks: global fetch (simulates Cloudflare siteverify endpoint).
 * Uses vi.stubEnv to toggle TURNSTILE_SECRET_KEY and NODE_ENV.
 */
describe("lib/turnstile", () => {
  // Clear module cache and unstub all env vars + globals for a clean slate
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // Tests for the main verification function — called by all public-facing POST endpoints
  describe("verifyTurnstileToken", () => {
    it("returns true when Cloudflare reports success", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue({ success: true }),
        }),
      );

      const { verifyTurnstileToken } = await import("./turnstile");
      const result = await verifyTurnstileToken("valid-token");
      expect(result).toBe(true);
    });

    it("returns false when Cloudflare reports failure", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue({ success: false }),
        }),
      );

      const { verifyTurnstileToken } = await import("./turnstile");
      const result = await verifyTurnstileToken("bad-token");
      expect(result).toBe(false);
    });

    it("returns false for empty token when configured", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          json: vi.fn().mockResolvedValue({ success: false }),
        }),
      );

      const { verifyTurnstileToken } = await import("./turnstile");
      const result = await verifyTurnstileToken("");
      expect(result).toBe(false);
    });

    it("propagates network errors (no catch in source)", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

      const { verifyTurnstileToken } = await import("./turnstile");
      await expect(verifyTurnstileToken("token")).rejects.toThrow("Network failure");
    });

    it("returns true in development when secret is not configured", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("NODE_ENV", "development");

      const { verifyTurnstileToken } = await import("./turnstile");
      const result = await verifyTurnstileToken("any-token");
      expect(result).toBe(true);
    });

    it("returns false in production when secret is not configured", async () => {
      vi.stubEnv("TURNSTILE_SECRET_KEY", "");
      vi.stubEnv("NODE_ENV", "production");

      const { verifyTurnstileToken } = await import("./turnstile");
      const result = await verifyTurnstileToken("any-token");
      expect(result).toBe(false);
    });
  });
});
