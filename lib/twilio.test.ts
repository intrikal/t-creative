// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Twilio SMS sending module.
 *
 * Covers:
 *  - isTwilioConfigured: returns true only when all 3 env vars are set
 *  - sendSms (not configured): returns false and warns
 *  - sendSms (success): calls Twilio, writes success sync_log, returns true
 *  - sendSms (failure): Twilio throws → returns false, writes failed sync_log
 *
 * Mocks: twilio SDK (messages.create), db (insert for sync_log, select for dedup),
 * db/schema, drizzle-orm.
 */

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                   */
/* ------------------------------------------------------------------ */

// mockMessagesCreate: captures SMS send calls to the Twilio SDK
const mockMessagesCreate = vi.fn();
// mockDbInsertValues: captures sync_log row writes
const mockDbInsertValues = vi.fn();

// Mock the Twilio SDK so tests don't send real SMS messages
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: mockMessagesCreate } })),
}));

// Mock the database so tests don't need a real Postgres connection
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
  // Reset all mocks, env stubs, and set default happy-path behavior for Twilio
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Default: Twilio send succeeds and returns a message SID
    mockMessagesCreate.mockResolvedValue({ sid: "SM_test_123" });
    mockDbInsertValues.mockResolvedValue(undefined);
  });

  // Tests for the environment-variable gate — all 3 vars must be set for SMS to work
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

  // Tests for the main SMS sending function
  describe("sendSms", () => {
    // When Twilio is not configured, the app should still work — just skip SMS
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
