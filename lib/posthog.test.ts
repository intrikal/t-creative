import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock state                                                  */
/* ------------------------------------------------------------------ */

const mockCapture = vi.fn();
const mockIdentify = vi.fn();

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("lib/posthog", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    // Re-mock after resetModules so the lazy singleton picks up the fresh mock
    vi.doMock("posthog-node", () => ({
      PostHog: function PostHog() {
        return { capture: mockCapture, identify: mockIdentify };
      },
    }));

    vi.doMock("@sentry/nextjs", () => ({
      captureException: vi.fn(),
    }));
  });

  /* ---------- trackEvent ---------- */

  describe("trackEvent", () => {
    it("calls posthog.capture with correct distinctId, event, and properties", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");

      const { trackEvent } = await import("./posthog");
      trackEvent("user-123", "booking_created", { bookingId: 42 });

      expect(mockCapture).toHaveBeenCalledOnce();
      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: "user-123",
        event: "booking_created",
        properties: { bookingId: 42 },
      });
    });

    it("does not call posthog.capture when POSTHOG_API_KEY is missing", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "");

      const { trackEvent } = await import("./posthog");
      trackEvent("user-123", "booking_created", { bookingId: 1 });

      expect(mockCapture).not.toHaveBeenCalled();
    });

    it("does not throw when POSTHOG_API_KEY is missing", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "");

      const { trackEvent } = await import("./posthog");
      expect(() => trackEvent("user-123", "test_event")).not.toThrow();
    });

    it("swallows errors thrown by posthog.capture", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");
      mockCapture.mockImplementationOnce(() => {
        throw new Error("PostHog network error");
      });

      const { trackEvent } = await import("./posthog");
      expect(() => trackEvent("user-123", "failing_event")).not.toThrow();
    });

    it("passes undefined properties when not provided", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");

      const { trackEvent } = await import("./posthog");
      trackEvent("user-456", "page_viewed");

      expect(mockCapture).toHaveBeenCalledWith({
        distinctId: "user-456",
        event: "page_viewed",
        properties: undefined,
      });
    });
  });

  /* ---------- identifyUser ---------- */

  describe("identifyUser", () => {
    it("calls posthog.identify with correct userId and properties", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");

      const { identifyUser } = await import("./posthog");
      identifyUser("user-789", { email: "alice@example.com", plan: "pro" });

      expect(mockIdentify).toHaveBeenCalledOnce();
      expect(mockIdentify).toHaveBeenCalledWith({
        distinctId: "user-789",
        properties: { email: "alice@example.com", plan: "pro" },
      });
    });

    it("does not call posthog.identify when POSTHOG_API_KEY is missing", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "");

      const { identifyUser } = await import("./posthog");
      identifyUser("user-789", { email: "alice@example.com" });

      expect(mockIdentify).not.toHaveBeenCalled();
    });

    it("does not throw when POSTHOG_API_KEY is missing", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "");

      const { identifyUser } = await import("./posthog");
      expect(() => identifyUser("user-789", { role: "admin" })).not.toThrow();
    });

    it("swallows errors thrown by posthog.identify", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "phc_test_key");
      mockIdentify.mockImplementationOnce(() => {
        throw new Error("PostHog identify failed");
      });

      const { identifyUser } = await import("./posthog");
      expect(() => identifyUser("user-789", { email: "x@y.com" })).not.toThrow();
    });
  });

  /* ---------- isPostHogConfigured ---------- */

  describe("isPostHogConfigured", () => {
    it("returns true when POSTHOG_API_KEY is set", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "phc_real_key");

      const { isPostHogConfigured } = await import("./posthog");
      expect(isPostHogConfigured()).toBe(true);
    });

    it("returns false when POSTHOG_API_KEY is empty", async () => {
      vi.stubEnv("POSTHOG_API_KEY", "");

      const { isPostHogConfigured } = await import("./posthog");
      expect(isPostHogConfigured()).toBe(false);
    });
  });
});
