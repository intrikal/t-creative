/**
 * Unit tests for the corporate event inquiry submission action.
 *
 * Tests the full submitCorporateInquiry flow: Zod validation, reCAPTCHA
 * bot check, DB insert, PostHog analytics tracking, and admin email
 * notification. Each test uses vi.resetModules() + vi.doMock() for
 * isolated module state.
 *
 * Related files:
 *   - app/events/corporate/actions.ts — the server action under test
 */

// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

// vi.fn(): creates mock functions that record calls for assertion
const mockVerifyRecaptcha = vi.fn(); // Google reCAPTCHA v3 bot verification
const mockTrackEvent = vi.fn(); // PostHog analytics event tracker
const mockSendEmail = vi.fn().mockResolvedValue(true); // email service
const mockInsertValues = vi.fn(); // DB insert — captures the inquiry row data

// setupMocks: registers all vi.doMock() replacements for a fresh module graph.
// Mocks the DB, schema, reCAPTCHA verification, PostHog, email service,
// and the email template component. The `recaptchaValid` option controls
// whether the bot check passes or fails.
function setupMocks(opts: { recaptchaValid?: boolean } = {}) {
  const { recaptchaValid = true } = opts;

  mockInsertValues.mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
  });

  vi.doMock("@/db", () => ({
    db: {
      insert: vi.fn(() => ({ values: mockInsertValues })),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    inquiries: {
      id: "id",
      name: "name",
      email: "email",
      phone: "phone",
      interest: "interest",
      message: "message",
      status: "status",
    },
  }));
  vi.doMock("@/lib/recaptcha", () => ({
    verifyRecaptchaToken: mockVerifyRecaptcha.mockResolvedValue(recaptchaValid),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    RESEND_FROM: "noreply@example.com",
  }));
  vi.doMock("@/emails/CorporateEventInquiry", () => ({
    CorporateEventInquiry: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

// Mock data: a complete valid corporate event inquiry form submission
// representing a company requesting a team bonding lash event
const validData = {
  contactName: "Jane Smith",
  email: "jane@acme.com",
  phone: "+1234567890",
  companyName: "Acme Corp",
  headcount: 25,
  preferredDate: "2026-06-15",
  services: "lash",
  eventType: "team_bonding",
  details: "Looking for a fun team event.",
  recaptchaToken: "valid-token",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

// Tests for the corporate event inquiry submission server action
describe("corporate/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Tests the submitCorporateInquiry action: validation, DB persistence,
  // reCAPTCHA gating, analytics tracking, and admin email notification
  describe("submitCorporateInquiry", () => {
    it("returns success: true on valid submission", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      const result = await submitCorporateInquiry(validData);
      expect(result).toEqual({ success: true });
    });

    it("inserts inquiry with correct fields", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      await submitCorporateInquiry(validData);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Jane Smith",
          email: "jane@acme.com",
          interest: "consulting",
          status: "new",
        }),
      );
    });

    it("message starts with [Corporate Event] and includes company name", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      await submitCorporateInquiry(validData);
      const { message } = mockInsertValues.mock.calls[0][0] as { message: string };
      expect(message).toContain("[Corporate Event] Acme Corp");
    });

    it("message includes event type label and headcount", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      await submitCorporateInquiry(validData);
      const { message } = mockInsertValues.mock.calls[0][0] as { message: string };
      expect(message).toContain("Team Bonding");
      expect(message).toContain("Headcount: 25");
    });

    it("returns error for invalid email", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      const result = await submitCorporateInquiry({ ...validData, email: "not-an-email" });
      expect(result).toEqual({ success: false, error: expect.any(String) });
    });

    it("returns error when contactName is too short", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      const result = await submitCorporateInquiry({ ...validData, contactName: "X" });
      expect(result).toEqual({ success: false, error: expect.any(String) });
    });

    it("returns error when companyName is empty", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      const result = await submitCorporateInquiry({ ...validData, companyName: "" });
      expect(result).toEqual({ success: false, error: expect.any(String) });
    });

    it("returns error when reCAPTCHA verification fails", async () => {
      vi.resetModules();
      setupMocks({ recaptchaValid: false });
      const { submitCorporateInquiry } = await import("./actions");
      const result = await submitCorporateInquiry(validData);
      expect(result).toEqual({ success: false, error: "Bot check failed. Please try again." });
    });

    it("does not insert when reCAPTCHA fails", async () => {
      vi.resetModules();
      setupMocks({ recaptchaValid: false });
      const { submitCorporateInquiry } = await import("./actions");
      await submitCorporateInquiry(validData);
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("tracks corporate_inquiry_submitted with company and event details", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      await submitCorporateInquiry(validData);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "jane@acme.com",
        "corporate_inquiry_submitted",
        expect.objectContaining({
          companyName: "Acme Corp",
          eventType: "team_bonding",
          services: "lash",
          headcount: 25,
        }),
      );
    });

    it("sends admin notification email with company name in subject", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      await submitCorporateInquiry(validData);
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining("Acme Corp"),
          entityType: "corporate_inquiry",
        }),
      );
    });

    it("omits phone from insert when not provided", async () => {
      vi.resetModules();
      setupMocks();
      const { submitCorporateInquiry } = await import("./actions");
      const { phone: _phone, ...dataWithoutPhone } = validData;
      await submitCorporateInquiry(dataWithoutPhone);
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ phone: null }));
    });
  });
});
