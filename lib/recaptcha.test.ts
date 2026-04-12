import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/recaptcha — Google reCAPTCHA v3 server-side verification.
 *
 * Covers:
 *  - Valid token    → returns true  (Google says success)
 *  - Invalid token  → returns false (Google says not success)
 *  - Missing secret in development  → returns true  (skips verification)
 *  - Missing secret in production   → returns false (blocks verification)
 *  - Google API network error       → returns false (catch path)
 *
 * Mocks: global fetch, @sentry/nextjs.
 * Uses vi.stubEnv + vi.resetModules because RECAPTCHA_SECRET_KEY and NODE_ENV
 * are read inside the function on every call (no module-level cache), but
 * resetModules is still used for consistency with the Sentry mock.
 */

const mockCaptureException = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

describe("lib/recaptcha", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ── valid / invalid token ─────────────────────────────────────────────────

  it("returns true when Google responds with success: true", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "test-secret");
    vi.stubEnv("NODE_ENV", "production");
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as Response);

    const { verifyRecaptchaToken } = await import("./recaptcha");
    expect(await verifyRecaptchaToken("valid-token")).toBe(true);
  });

  it("returns false when Google responds with success: false", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "test-secret");
    vi.stubEnv("NODE_ENV", "production");
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: false }),
    } as unknown as Response);

    const { verifyRecaptchaToken } = await import("./recaptcha");
    expect(await verifyRecaptchaToken("invalid-token")).toBe(false);
  });

  // ── missing secret key ────────────────────────────────────────────────────

  it("returns true (skips verification) when secret key is missing in development", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "development");

    const { verifyRecaptchaToken } = await import("./recaptcha");
    // fetch must not be called — no key means no network request in dev
    expect(await verifyRecaptchaToken("any-token")).toBe(true);
  });

  it("returns false when secret key is missing in production", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "");
    vi.stubEnv("NODE_ENV", "production");

    const { verifyRecaptchaToken } = await import("./recaptcha");
    expect(await verifyRecaptchaToken("any-token")).toBe(false);
  });

  // ── Google API error ──────────────────────────────────────────────────────

  it("returns false and captures exception when fetch throws (network error)", async () => {
    vi.stubEnv("RECAPTCHA_SECRET_KEY", "test-secret");
    vi.stubEnv("NODE_ENV", "production");
    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    const { verifyRecaptchaToken } = await import("./recaptcha");
    expect(await verifyRecaptchaToken("any-token")).toBe(false);
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
