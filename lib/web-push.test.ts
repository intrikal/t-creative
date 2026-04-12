import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for lib/web-push — VAPID-based Web Push notification sender.
 *
 * Covers:
 *  - isPushConfigured: true when both VAPID keys are present, false otherwise
 *  - sendPushNotification: sends to each subscription, handles 410 expiry,
 *    returns 0 when no subscriptions exist
 *
 * Mocks: web-push, @/db (select + delete), @/db/schema, drizzle-orm, @sentry/nextjs.
 * Uses vi.stubEnv + vi.resetModules so module-level VAPID constants are re-evaluated
 * on each import.
 */

// Terminal mock refs held outside vi.mock() so they survive vi.resetModules().
// vi.clearAllMocks() clears their call history; beforeEach re-sets implementations.
const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();
const mockSelectWhere = vi.fn();
const mockDeleteWhere = vi.fn();
const mockCaptureException = vi.fn();

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
}));

// select().from().where() — terminal mock is `mockSelectWhere` (returns subscriptions array)
// delete().where()        — terminal mock is `mockDeleteWhere` (returns void)
vi.mock("@/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockSelectWhere,
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: mockDeleteWhere,
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  pushSubscriptions: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn().mockReturnValue({}),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

describe("lib/web-push", () => {
  beforeEach(() => {
    // Reset module cache so VAPID constants are re-read from fresh env stubs.
    vi.resetModules();
    vi.clearAllMocks();
    // Re-set implementations cleared by clearAllMocks().
    mockSelectWhere.mockResolvedValue([]);
    mockDeleteWhere.mockResolvedValue(undefined);
    mockSendNotification.mockResolvedValue(undefined);
  });

  // ── isPushConfigured ──────────────────────────────────────────────────────

  describe("isPushConfigured", () => {
    it("returns true when both VAPID keys are present", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-pub-key");
      vi.stubEnv("VAPID_PRIVATE_KEY", "test-priv-key");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", ""); // avoid URL() parse at module init

      const { isPushConfigured } = await import("./web-push");
      expect(isPushConfigured()).toBe(true);
    });

    it("returns false when VAPID keys are missing", async () => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
      vi.stubEnv("VAPID_PRIVATE_KEY", "");

      const { isPushConfigured } = await import("./web-push");
      expect(isPushConfigured()).toBe(false);
    });
  });

  // ── sendPushNotification ──────────────────────────────────────────────────

  describe("sendPushNotification", () => {
    const fakeSub = {
      id: "sub-1",
      endpoint: "https://push.example.com/fcm/send/abc",
      p256dh: "p256dh-value",
      auth: "auth-value",
      profileId: "profile-1",
    };

    // Ensure VAPID is configured for all sendPushNotification tests so
    // isPushConfigured() returns true and the function doesn't short-circuit.
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "test-pub-key");
      vi.stubEnv("VAPID_PRIVATE_KEY", "test-priv-key");
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    });

    it("calls webpush.sendNotification with correct args for a valid subscription", async () => {
      mockSelectWhere.mockResolvedValue([fakeSub]);

      const { sendPushNotification } = await import("./web-push");
      const result = await sendPushNotification("profile-1", {
        title: "New booking",
        body: "Your session is confirmed",
      });

      expect(mockSendNotification).toHaveBeenCalledWith(
        {
          endpoint: fakeSub.endpoint,
          keys: { p256dh: fakeSub.p256dh, auth: fakeSub.auth },
        },
        JSON.stringify({ title: "New booking", body: "Your session is confirmed" }),
        { TTL: 86400 },
      );
      expect(result).toBe(1);
    });

    it("deletes subscription and returns 0 when push returns 410 (expired)", async () => {
      mockSelectWhere.mockResolvedValue([fakeSub]);
      mockSendNotification.mockRejectedValue({ statusCode: 410 });

      const { sendPushNotification } = await import("./web-push");
      const result = await sendPushNotification("profile-1", {
        title: "Hello",
        body: "World",
      });

      // Expired subscription must be removed from the DB.
      expect(mockDeleteWhere).toHaveBeenCalled();
      // Sentry must NOT be called for expected 410 errors.
      expect(mockCaptureException).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it("returns 0 and does not call sendNotification when user has no subscriptions", async () => {
      mockSelectWhere.mockResolvedValue([]); // already the default, explicit for clarity

      const { sendPushNotification } = await import("./web-push");
      const result = await sendPushNotification("profile-1", {
        title: "Hello",
        body: "World",
      });

      expect(result).toBe(0);
      expect(mockSendNotification).not.toHaveBeenCalled();
    });
  });
});
