import { describe, it, expect, vi, beforeEach } from "vitest";

describe("lib/turnstile", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

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
