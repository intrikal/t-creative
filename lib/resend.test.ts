// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Resend email sending helper module.
 *
 * Covers:
 *  - isResendConfigured: returns true only when RESEND_API_KEY is set
 *  - RESEND_FROM: uses env var when set, falls back to default sender
 *  - sendEmail: returns false and logs warning when not configured
 *
 * Mocks: db (insert for sync_log), db/schema.
 * Uses vi.stubEnv + vi.resetModules to test different env var combinations.
 */

// Mock the database so tests don't need a real Postgres connection — sendEmail
// writes to sync_log on each send attempt
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Mock the schema import — the actual table definitions are not needed for unit tests
vi.mock("@/db/schema", () => ({
  syncLog: {},
}));

describe("lib/resend", () => {
  // Clear module cache so env var changes apply on next import
  beforeEach(() => {
    vi.resetModules();
  });

  // Tests for the environment-variable gate that controls whether emails can be sent
  describe("isResendConfigured", () => {
    // API key present — Resend can send emails
    it("returns true when RESEND_API_KEY is set", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_123");

      const { isResendConfigured } = await import("./resend");
      expect(isResendConfigured()).toBe(true);
    });

    it("returns false when RESEND_API_KEY is missing", async () => {
      vi.stubEnv("RESEND_API_KEY", "");

      const { isResendConfigured } = await import("./resend");
      expect(isResendConfigured()).toBe(false);
    });
  });

  // Tests the "From" header — customizable per-studio, with a branded default
  describe("RESEND_FROM", () => {
    it("uses env var when set", async () => {
      vi.stubEnv("RESEND_FROM_EMAIL", "Studio <studio@example.com>");
      vi.stubEnv("RESEND_API_KEY", "re_test_123");

      const { RESEND_FROM } = await import("./resend");
      expect(RESEND_FROM).toBe("Studio <studio@example.com>");
    });

    it("falls back to default when env var is missing", async () => {
      vi.stubEnv("RESEND_FROM_EMAIL", "");
      vi.stubEnv("RESEND_API_KEY", "");

      const { RESEND_FROM } = await import("./resend");
      expect(RESEND_FROM).toBe("T Creative <noreply@tcreativestudio.com>");
    });
  });

  // Tests the main email sending function's graceful degradation path
  describe("sendEmail", () => {
    // When Resend is not configured, the app should still work — just skip emails
    it("returns false and warns when not configured", async () => {
      vi.stubEnv("RESEND_API_KEY", "");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { sendEmail } = await import("./resend");
      const result = await sendEmail({
        to: "test@example.com",
        subject: "Test",
        react: null as unknown as React.ReactElement,
        entityType: "test",
        localId: "1",
      });

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith("[resend] Not configured — skipping email:", "Test");

      warnSpy.mockRestore();
    });
  });
});
