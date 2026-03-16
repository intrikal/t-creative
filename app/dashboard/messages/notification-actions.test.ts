import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockTrackEvent = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockGetEmailRecipient = vi.fn();
const mockRevalidatePath = vi.fn();

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    notifications: {
      id: "id",
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
      body: "body",
      relatedEntityType: "relatedEntityType",
      relatedEntityId: "relatedEntityId",
      errorMessage: "errorMessage",
      scheduledFor: "scheduledFor",
      sentAt: "sentAt",
      createdAt: "createdAt",
      externalId: "externalId",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@react-email/components", () => ({ Text: vi.fn() }));
  vi.doMock("react", () => ({ createElement: vi.fn(() => null) }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("notification-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getNotifications ---- */

  describe("getNotifications", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getNotifications } = await import("./notification-actions");
      await expect(getNotifications()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no notifications", async () => {
      vi.resetModules();
      setupMocks();
      const { getNotifications } = await import("./notification-actions");
      const result = await getNotifications();
      expect(result).toEqual([]);
    });

    it("maps rows to NotificationRow shape with ISO date strings", async () => {
      vi.resetModules();
      const now = new Date("2026-03-15T10:00:00Z");
      const row = {
        id: 1,
        profileId: "p1",
        recipientFirstName: "Jane",
        recipientLastName: "Doe",
        type: "general" as const,
        channel: "email" as const,
        status: "sent" as const,
        title: "Test Notification",
        body: "Body text",
        relatedEntityType: null,
        relatedEntityId: null,
        errorMessage: null,
        scheduledFor: null,
        sentAt: now,
        createdAt: now,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getNotifications } = await import("./notification-actions");
      const result = await getNotifications();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        profileId: "p1",
        recipientName: "Jane Doe",
        type: "general",
        channel: "email",
        title: "Test Notification",
        sentAt: now.toISOString(),
        createdAt: now.toISOString(),
      });
    });

    it("filters by profileId when provided", async () => {
      vi.resetModules();
      const now = new Date("2026-03-15T10:00:00Z");
      const row = {
        id: 2,
        profileId: "profile-specific",
        recipientFirstName: "Bob",
        recipientLastName: null,
        type: "booking_reminder" as const,
        channel: "internal" as const,
        status: "delivered" as const,
        title: "Reminder",
        body: null,
        relatedEntityType: "booking",
        relatedEntityId: 5,
        errorMessage: null,
        scheduledFor: null,
        sentAt: null,
        createdAt: now,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getNotifications } = await import("./notification-actions");
      const result = await getNotifications("profile-specific");
      expect(result).toHaveLength(1);
      expect(result[0].profileId).toBe("profile-specific");
      expect(result[0].recipientName).toBe("Bob");
      expect(result[0].sentAt).toBeNull();
    });
  });

  /* ---- sendNotification ---- */

  describe("sendNotification", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { sendNotification } = await import("./notification-actions");
      await expect(
        sendNotification({ profileId: "p1", type: "general", channel: "internal", title: "Test" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts notification with status 'delivered' for internal channel", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendNotification } = await import("./notification-actions");
      await sendNotification({
        profileId: "p1",
        type: "general",
        channel: "internal",
        title: "Hello",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "delivered", channel: "internal" }),
      );
    });

    it("inserts notification with status 'pending' for email channel", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 11 }]),
      }));
      mockGetEmailRecipient.mockResolvedValue(null); // no recipient, so no email send
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendNotification } = await import("./notification-actions");
      await sendNotification({
        profileId: "p1",
        type: "general",
        channel: "email",
        title: "Email Notif",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "pending", channel: "email" }),
      );
    });

    it("sends email and updates status to 'sent' when recipient found and email succeeds", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      mockGetEmailRecipient.mockResolvedValue({ email: "jane@example.com" });
      mockSendEmail.mockResolvedValue(true);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 12 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendNotification } = await import("./notification-actions");
      await sendNotification({
        profileId: "p1",
        type: "general",
        channel: "email",
        title: "Email Test",
        body: "Body text",
      });
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "jane@example.com" }),
      );
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
    });

    it("updates status to 'failed' when email send fails", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      mockGetEmailRecipient.mockResolvedValue({ email: "jane@example.com" });
      mockSendEmail.mockResolvedValue(false);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 13 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendNotification } = await import("./notification-actions");
      await sendNotification({
        profileId: "p1",
        type: "general",
        channel: "email",
        title: "Email Fail",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed", errorMessage: "Email delivery failed" }),
      );
    });

    it("updates status to 'failed' when no email recipient found", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      mockGetEmailRecipient.mockResolvedValue(null);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 14 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { sendNotification } = await import("./notification-actions");
      await sendNotification({
        profileId: "p1",
        type: "general",
        channel: "email",
        title: "No Recipient",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          errorMessage: "No email recipient found or email notifications disabled",
        }),
      );
    });

    it("calls trackEvent and revalidatePath", async () => {
      vi.resetModules();
      mockGetEmailRecipient.mockResolvedValue(null);
      setupMocks();
      const { sendNotification } = await import("./notification-actions");
      await sendNotification({
        profileId: "p2",
        type: "booking_reminder",
        channel: "internal",
        title: "Reminder",
      });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "notification_sent",
        expect.objectContaining({
          type: "booking_reminder",
          channel: "internal",
          recipientId: "p2",
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/messages");
    });
  });

  /* ---- recordNotification ---- */

  describe("recordNotification", () => {
    it("inserts notification record with status 'sent'", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 20 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { recordNotification } = await import("./notification-actions");
      await recordNotification({
        profileId: "p1",
        type: "booking_confirmation",
        channel: "email",
        title: "Booking Confirmed",
        body: "Your booking is confirmed",
        relatedEntityType: "booking",
        relatedEntityId: 5,
        externalId: "ext-123",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "p1",
          status: "sent",
          title: "Booking Confirmed",
          relatedEntityType: "booking",
          relatedEntityId: 5,
          externalId: "ext-123",
          sentAt: expect.any(Date),
        }),
      );
    });

    it("does not require auth (no getUser call)", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { recordNotification } = await import("./notification-actions");
      // Should not throw even without auth
      await expect(
        recordNotification({
          profileId: "p1",
          type: "general",
          channel: "internal",
          title: "Test",
        }),
      ).resolves.toBeUndefined();
    });
  });
});
