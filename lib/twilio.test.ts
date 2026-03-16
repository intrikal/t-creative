import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

const mockMessagesCreate = vi.fn();
const mockDbInsertValues = vi.fn();

vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: mockMessagesCreate } })),
}));

vi.mock("@/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: mockDbInsertValues }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  syncLog: {},
  profiles: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/twilio", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    mockMessagesCreate.mockResolvedValue({ sid: "SM_test_123" });
    mockDbInsertValues.mockResolvedValue(undefined);
  });

  describe("isTwilioConfigured", () => {
    it("returns true when all three env vars are set", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test");
      vi.stubEnv("TWILIO_FROM_NUMBER", "+15555555555");

      const { isTwilioConfigured } = await import("./twilio");
      expect(isTwilioConfigured()).toBe(true);
    });

    it("returns false when TWILIO_ACCOUNT_SID is missing", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test");
      vi.stubEnv("TWILIO_FROM_NUMBER", "+15555555555");

      const { isTwilioConfigured } = await import("./twilio");
      expect(isTwilioConfigured()).toBe(false);
    });

    it("returns false when TWILIO_AUTH_TOKEN is missing", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "");
      vi.stubEnv("TWILIO_FROM_NUMBER", "+15555555555");

      const { isTwilioConfigured } = await import("./twilio");
      expect(isTwilioConfigured()).toBe(false);
    });

    it("returns false when TWILIO_FROM_NUMBER is missing", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test");
      vi.stubEnv("TWILIO_FROM_NUMBER", "");

      const { isTwilioConfigured } = await import("./twilio");
      expect(isTwilioConfigured()).toBe(false);
    });
  });

  describe("sendSms", () => {
    it("returns false and warns when Twilio is not configured", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "");
      vi.stubEnv("TWILIO_FROM_NUMBER", "");

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { sendSms } = await import("./twilio");
      const result = await sendSms({
        to: "+15551234567",
        body: "Test message",
        entityType: "booking_reminder_sms",
        localId: "42",
      });

      expect(result).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        "[twilio] Not configured — skipping SMS:",
        "booking_reminder_sms",
      );

      warnSpy.mockRestore();
    });

    it("returns true and writes sync_log on successful send", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test");
      vi.stubEnv("TWILIO_FROM_NUMBER", "+15555555555");

      const { sendSms } = await import("./twilio");
      const result = await sendSms({
        to: "+15551234567",
        body: "Your appointment is tomorrow",
        entityType: "booking_reminder_24h_sms",
        localId: "99",
      });

      expect(result).toBe(true);
      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "+15551234567",
          body: "Your appointment is tomorrow",
        }),
      );
      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "twilio",
          status: "success",
          remoteId: "SM_test_123",
        }),
      );
    });

    it("returns false and logs failure when Twilio API throws", async () => {
      vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
      vi.stubEnv("TWILIO_AUTH_TOKEN", "auth_test");
      vi.stubEnv("TWILIO_FROM_NUMBER", "+15555555555");
      mockMessagesCreate.mockRejectedValue(new Error("Invalid phone number"));

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { sendSms } = await import("./twilio");
      const result = await sendSms({
        to: "not-a-phone",
        body: "Test",
        entityType: "test_sms",
        localId: "1",
      });

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith("[twilio] Failed to send SMS:", "Invalid phone number");
      expect(mockDbInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "twilio",
          status: "failed",
          errorMessage: "Invalid phone number",
        }),
      );

      errorSpy.mockRestore();
    });
  });
});
