import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing resend
vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  syncLog: {},
}));

describe("lib/resend", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("isResendConfigured", () => {
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

  describe("sendEmail", () => {
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
