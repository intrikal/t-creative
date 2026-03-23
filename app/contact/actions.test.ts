import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                    */
/* ------------------------------------------------------------------ */

const mockInsertValues = vi.fn().mockResolvedValue(undefined);
const mockRateLimitLimit = vi.fn();
const mockVerifyRecaptchaToken = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockTrackEvent = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                          */
/* ------------------------------------------------------------------ */

function setupMocks() {
  vi.doMock("@/db", () => ({
    db: {
      insert: vi.fn(() => ({ values: mockInsertValues })),
    },
  }));

  vi.doMock("@/db/schema", () => ({
    inquiries: {
      name: "name",
      email: "email",
      interest: "interest",
      message: "message",
      status: "status",
    },
  }));

  vi.doMock("@upstash/ratelimit", () => {
    const RatelimitConstructor = vi.fn(function () {
      return { limit: mockRateLimitLimit };
    }) as unknown as { new (...args: unknown[]): unknown; slidingWindow: ReturnType<typeof vi.fn> };
    RatelimitConstructor.slidingWindow = vi.fn((count: number, window: string) => ({
      count,
      window,
    }));
    return { Ratelimit: RatelimitConstructor };
  });

  vi.doMock("@/lib/redis", () => ({
    redis: { get: vi.fn(), set: vi.fn() },
  }));

  vi.doMock("@/lib/recaptcha", () => ({
    verifyRecaptchaToken: mockVerifyRecaptchaToken,
  }));

  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
  }));

  vi.doMock("@/lib/posthog", () => ({
    trackEvent: mockTrackEvent,
  }));

  vi.doMock("@/emails/InquiryReply", () => ({
    InquiryReply: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Test data factory                                                   */
/* ------------------------------------------------------------------ */

function makeFormData(
  overrides: Partial<{
    name: string;
    email: string;
    interest: string;
    message: string;
    recaptchaToken: string;
  }> = {},
) {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    interest: "Lash Extensions",
    message: "I'd love to book an appointment.",
    recaptchaToken: "valid-recaptcha-token",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("submitContactForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: rate limit allows, reCAPTCHA passes
    mockRateLimitLimit.mockResolvedValue({ success: true });
    mockVerifyRecaptchaToken.mockResolvedValue(true);
  });

  /* ---- Valid submission ---- */

  describe("valid submission", () => {
    it("inserts inquiry into the database", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await submitContactForm(makeFormData());

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Jane Doe",
          email: "jane@example.com",
          interest: "lash",
          message: "[Lash Extensions] I'd love to book an appointment.",
          status: "new",
        }),
      );
    });

    it("sends a confirmation email to the submitter", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await submitContactForm(makeFormData());

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@example.com",
          subject: expect.stringContaining("inquiry"),
          entityType: "contact_inquiry",
        }),
      );
    });

    it("returns { success: true }", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      const result = await submitContactForm(makeFormData());

      expect(result).toEqual({ success: true });
    });

    it("maps interest label to the correct DB category", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await submitContactForm(makeFormData({ interest: "Permanent Jewelry" }));

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ interest: "jewelry" }),
      );
    });

    it("stores null category for unmapped interests", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await submitContactForm(makeFormData({ interest: "Other" }));

      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ interest: null }));
    });

    it("fires a PostHog analytics event", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await submitContactForm(makeFormData());

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "jane@example.com",
        "contact_form_submitted",
        expect.objectContaining({ interest: "Lash Extensions" }),
      );
    });
  });

  /* ---- reCAPTCHA invalid ---- */

  describe("reCAPTCHA token invalid", () => {
    it("throws when reCAPTCHA verification fails", async () => {
      vi.resetModules();
      mockVerifyRecaptchaToken.mockResolvedValue(false);
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData())).rejects.toThrow("Bot check failed");
    });

    it("does not insert into the database when reCAPTCHA fails", async () => {
      vi.resetModules();
      mockVerifyRecaptchaToken.mockResolvedValue(false);
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData())).rejects.toThrow();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("does not send an email when reCAPTCHA fails", async () => {
      vi.resetModules();
      mockVerifyRecaptchaToken.mockResolvedValue(false);
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData())).rejects.toThrow();
      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  /* ---- Missing required fields (Zod validation) ---- */

  describe("missing required fields", () => {
    it("throws when name is empty", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData({ name: "" }))).rejects.toThrow(
        "Invalid form data",
      );
    });

    it("throws when email is invalid", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData({ email: "not-an-email" }))).rejects.toThrow(
        "Invalid form data",
      );
    });

    it("throws when message is empty", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData({ message: "" }))).rejects.toThrow(
        "Invalid form data",
      );
    });

    it("throws when recaptchaToken is missing", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData({ recaptchaToken: "" }))).rejects.toThrow(
        "Invalid form data",
      );
    });

    it("does not call reCAPTCHA or insert when validation fails", async () => {
      vi.resetModules();
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData({ name: "" }))).rejects.toThrow();
      expect(mockVerifyRecaptchaToken).not.toHaveBeenCalled();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });
  });

  /* ---- Rate limited ---- */

  describe("rate limiting", () => {
    it("throws after 5 submissions per minute", async () => {
      vi.resetModules();
      mockRateLimitLimit.mockResolvedValue({ success: false });
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData())).rejects.toThrow("Too many submissions");
    });

    it("does not verify reCAPTCHA when rate limited", async () => {
      vi.resetModules();
      mockRateLimitLimit.mockResolvedValue({ success: false });
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData())).rejects.toThrow();
      expect(mockVerifyRecaptchaToken).not.toHaveBeenCalled();
    });

    it("does not insert into the database when rate limited", async () => {
      vi.resetModules();
      mockRateLimitLimit.mockResolvedValue({ success: false });
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      await expect(submitContactForm(makeFormData())).rejects.toThrow();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("allows submission when rate limit has not been reached", async () => {
      vi.resetModules();
      mockRateLimitLimit.mockResolvedValue({ success: true });
      setupMocks();
      const { submitContactForm } = await import("@/app/contact/actions");

      const result = await submitContactForm(makeFormData());
      expect(result).toEqual({ success: true });
    });
  });
});
