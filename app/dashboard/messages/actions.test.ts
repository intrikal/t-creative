/**
 * @file actions.test.ts
 * @description Unit tests for messages/actions (threads listing, message sending
 * with auto-status transition, email notifications, thread CRUD, quick replies,
 * contacts).
 *
 * Testing utilities: describe, it, expect, vi, vi.doMock, vi.resetModules,
 * vi.clearAllMocks, beforeEach.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 */
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

/** Stub for supabase auth.getUser. */
const mockGetUser = vi.fn();
/** Captures PostHog trackEvent calls. */
const mockTrackEvent = vi.fn();
/** Captures Resend sendEmail calls. */
const mockSendEmail = vi.fn().mockResolvedValue(true);
/** Captures Zoho CRM createZohoDeal calls. */
const mockCreateZohoDeal = vi.fn();
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();

/** Registers all module mocks; accepts optional custom db object. */
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    execute: vi.fn().mockResolvedValue([]),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    threads: {
      id: "id",
      subject: "subject",
      threadType: "threadType",
      status: "status",
      isStarred: "isStarred",
      isArchived: "isArchived",
      isClosed: "isClosed",
      isGroup: "isGroup",
      bookingId: "bookingId",
      lastMessageAt: "lastMessageAt",
      createdAt: "createdAt",
      clientId: "clientId",
      referencePhotoUrls: "referencePhotoUrls",
    },
    messages: {
      id: "id",
      threadId: "threadId",
      body: "body",
      isRead: "isRead",
      createdAt: "createdAt",
      senderId: "senderId",
      readAt: "readAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      avatarUrl: "avatarUrl",
      role: "role",
      notifyEmail: "notifyEmail",
    },
    quickReplies: {
      id: "id",
      label: "label",
      body: "body",
      isActive: "isActive",
      sortOrder: "sortOrder",
    },
    services: {
      id: "id",
      name: "name",
      durationMinutes: "durationMinutes",
      priceInCents: "priceInCents",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      staffId: "staffId",
      clientNotes: "clientNotes",
    },
    threadParticipants: {
      threadId: "threadId",
      profileId: "profileId",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_firstName`,
      lastName: `${name}_lastName`,
      email: `${name}_email`,
      role: `${name}_role`,
      avatarUrl: `${name}_avatarUrl`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: mockCreateZohoDeal }));
  vi.doMock("@/emails/MessageNotification", () => ({
    MessageNotification: vi.fn(() => null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("messages/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "admin@example.com" } } });
  });

  /* ---- getThreads ---- */

  describe("getThreads", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getThreads } = await import("./actions");
      await expect(getThreads()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when there are no threads", async () => {
      vi.resetModules();
      setupMocks();
      const { getThreads } = await import("./actions");
      const result = await getThreads();
      expect(result).toEqual([]);
    });

    it("maps thread rows with lastMessageBody and unreadCount", async () => {
      vi.resetModules();
      const threadRow = {
        id: 10,
        subject: "Test Thread",
        threadType: "general",
        status: "new",
        isStarred: false,
        isArchived: false,
        isClosed: false,
        isGroup: false,
        bookingId: null,
        lastMessageAt: new Date("2026-03-01T10:00:00Z"),
        createdAt: new Date("2026-03-01T09:00:00Z"),
        clientId: "client-1",
        clientFirstName: "Jane",
        clientLastName: "Doe",
        clientEmail: "jane@example.com",
        clientPhone: null,
        clientAvatarUrl: null,
        referencePhotoUrls: null,
      };
      const mockExecute = vi
        .fn()
        .mockResolvedValueOnce([{ thread_id: 10, body: "Hello", sender_id: "client-1" }])
        .mockResolvedValueOnce([{ thread_id: 10, cnt: "2" }]);
      setupMocks({
        select: vi.fn(() => makeChain([threadRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: mockExecute,
      });
      const { getThreads } = await import("./actions");
      const result = await getThreads();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 10,
        subject: "Test Thread",
        lastMessageBody: "Hello",
        lastMessageSenderId: "client-1",
        unreadCount: 2,
      });
    });

    it("defaults unreadCount to 0 when no unread messages", async () => {
      vi.resetModules();
      const threadRow = {
        id: 10,
        subject: "Test",
        threadType: "general",
        status: "new",
        isStarred: false,
        isArchived: false,
        isClosed: false,
        isGroup: false,
        bookingId: null,
        lastMessageAt: new Date(),
        createdAt: new Date(),
        clientId: null,
        clientFirstName: null,
        clientLastName: null,
        clientEmail: null,
        clientPhone: null,
        clientAvatarUrl: null,
        referencePhotoUrls: null,
      };
      const mockExecute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      setupMocks({
        select: vi.fn(() => makeChain([threadRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: mockExecute,
      });
      const { getThreads } = await import("./actions");
      const result = await getThreads();
      expect(result[0].unreadCount).toBe(0);
      expect(result[0].lastMessageBody).toBeNull();
    });
  });

  /* ---- sendMessage ---- */

  describe("sendMessage", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { sendMessage } = await import("./actions");
      await expect(sendMessage(1, "Hello")).rejects.toThrow("Not authenticated");
    });

    it("inserts a message and returns the full message row", async () => {
      vi.resetModules();
      const insertedMsg = { id: 99 };
      const fullMsg = {
        id: 99,
        threadId: 1,
        body: "Hello",
        isRead: false,
        createdAt: new Date(),
        senderId: "user-1",
        senderFirstName: "Admin",
        senderLastName: "User",
        senderRole: "admin",
        senderAvatarUrl: null,
      };
      // sendMessage select order:
      // 1. thread status/clientId check
      // 2. full message fetch (innerJoin with sender profile)
      // 3. participants (innerJoin) — inside try block
      // 4. thread subject — inside try block
      let selectCount = 0;
      const customDb = {
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ status: "new", clientId: "client-1" }]);
          if (selectCount === 2) return makeChain([fullMsg]); // full message
          if (selectCount === 3) return makeChain([]); // participants (empty → no email)
          return makeChain([{ subject: "Test Thread" }]); // thread subject
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([insertedMsg]),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      };
      setupMocks(customDb);
      const { sendMessage } = await import("./actions");
      const result = await sendMessage(1, "Hello");
      expect(result).toMatchObject({ id: 99, body: "Hello" });
    });

    it("auto-moves thread status from 'new' to 'contacted' when admin replies", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      let selectCount = 0;
      const fullMsg = {
        id: 1,
        threadId: 1,
        body: "Hi",
        isRead: false,
        createdAt: new Date(),
        senderId: "user-1",
        senderFirstName: "A",
        senderLastName: "B",
        senderRole: "admin",
        senderAvatarUrl: null,
      };
      // Select order: (1) thread status (new+clientId≠user → auto-contact), (2) full message, (3) participants, (4) subject
      const customDb = {
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ status: "new", clientId: "client-1" }]);
          if (selectCount === 2) return makeChain([fullMsg]);
          if (selectCount === 3) return makeChain([]); // participants
          return makeChain([{ subject: "Thread" }]); // subject
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      };
      setupMocks(customDb);
      const { sendMessage } = await import("./actions");
      await sendMessage(1, "Hi");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: "contacted" }));
    });

    it("sends email to participants with notifyEmail=true", async () => {
      vi.resetModules();
      let selectCount = 0;
      const participant = {
        id: "client-1",
        email: "client@example.com",
        firstName: "Jane",
        notifyEmail: true,
      };
      const fullMsg = {
        id: 1,
        threadId: 1,
        body: "Hi",
        isRead: false,
        createdAt: new Date(),
        senderId: "user-1",
        senderFirstName: "Admin",
        senderLastName: "User",
        senderRole: "admin",
        senderAvatarUrl: null,
      };
      // Select order: (1) thread status, (2) full message, (3) participants, (4) thread subject
      const customDb = {
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ status: "pending", clientId: "client-1" }]);
          if (selectCount === 2) return makeChain([fullMsg]);
          if (selectCount === 3) return makeChain([participant]);
          return makeChain([{ subject: "Test" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      };
      setupMocks(customDb);
      const { sendMessage } = await import("./actions");
      await sendMessage(1, "Hi");
      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "client@example.com" }),
      );
    });

    it("does not send email to sender themselves", async () => {
      vi.resetModules();
      let selectCount = 0;
      // participant is the same user sending the message
      const participant = {
        id: "user-1",
        email: "admin@example.com",
        firstName: "Admin",
        notifyEmail: true,
      };
      const fullMsg = {
        id: 1,
        threadId: 1,
        body: "Hi",
        isRead: false,
        createdAt: new Date(),
        senderId: "user-1",
        senderFirstName: "Admin",
        senderLastName: "User",
        senderRole: "admin",
        senderAvatarUrl: null,
      };
      // Select order: (1) thread status, (2) full message, (3) participants (same user → skip), (4) thread subject
      const customDb = {
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ status: "pending", clientId: "client-1" }]);
          if (selectCount === 2) return makeChain([fullMsg]);
          if (selectCount === 3) return makeChain([participant]);
          return makeChain([{ subject: "Test" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      };
      setupMocks(customDb);
      const { sendMessage } = await import("./actions");
      await sendMessage(1, "Hi");
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("calls trackEvent and revalidatePath", async () => {
      vi.resetModules();
      let selectCount = 0;
      const fullMsg = {
        id: 1,
        threadId: 5,
        body: "Hello",
        isRead: false,
        createdAt: new Date(),
        senderId: "user-1",
        senderFirstName: "A",
        senderLastName: "B",
        senderRole: null,
        senderAvatarUrl: null,
      };
      // Select order: (1) thread status, (2) full message, (3) participants, (4) thread subject
      const customDb = {
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ status: "pending", clientId: "client-1" }]);
          if (selectCount === 2) return makeChain([fullMsg]);
          if (selectCount === 3) return makeChain([]); // no participants
          return makeChain([{ subject: "T" }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      };
      setupMocks(customDb);
      const { sendMessage } = await import("./actions");
      await sendMessage(5, "Hello");
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "message_sent", { threadId: 5 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/messages");
    });
  });

  /* ---- markThreadRead ---- */

  describe("markThreadRead", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { markThreadRead } = await import("./actions");
      await expect(markThreadRead(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update to mark messages as read", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { markThreadRead } = await import("./actions");
      await markThreadRead(42);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      );
    });
  });

  /* ---- updateThreadStatus ---- */

  describe("updateThreadStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateThreadStatus } = await import("./actions");
      await expect(updateThreadStatus(1, "resolved")).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with the new status", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { updateThreadStatus } = await import("./actions");
      await updateThreadStatus(10, "approved");
      expect(mockUpdateSet).toHaveBeenCalledWith({ status: "approved" });
    });

    it("revalidates /dashboard/messages", async () => {
      vi.resetModules();
      setupMocks();
      const { updateThreadStatus } = await import("./actions");
      await updateThreadStatus(1, "resolved");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/messages");
    });
  });

  /* ---- createThread ---- */

  describe("createThread", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createThread } = await import("./actions");
      await expect(
        createThread({ subject: "Test", participantIds: ["p1"], body: "Hello" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("creates a single-participant thread with clientId set for client role", async () => {
      vi.resetModules();
      let insertCount = 0;
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockImplementation(() => {
          insertCount++;
          if (insertCount === 1) return Promise.resolve([{ id: 55 }]); // thread insert
          return Promise.resolve([{ id: 1 }]);
        }),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ role: "client" }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { createThread } = await import("./actions");
      const result = await createThread({
        subject: "New Thread",
        participantIds: ["client-1"],
        body: "Hello!",
      });
      expect(result).toEqual({ threadId: 55 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "New Thread", clientId: "client-1" }),
      );
    });

    it("creates a group thread with isGroup=true and clientId=null", async () => {
      vi.resetModules();
      let insertCount = 0;
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockImplementation(() => {
          insertCount++;
          if (insertCount === 1) return Promise.resolve([{ id: 66 }]);
          return Promise.resolve([{ id: 1 }]);
        }),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { createThread } = await import("./actions");
      const result = await createThread({
        subject: "Group Chat",
        participantIds: ["p1", "p2"],
        body: "Welcome!",
      });
      expect(result).toEqual({ threadId: 66 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ isGroup: true, clientId: null }),
      );
    });

    it("calls trackEvent and revalidatePath", async () => {
      vi.resetModules();
      let insertCount = 0;
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockImplementation(() => {
              insertCount++;
              if (insertCount === 1) return Promise.resolve([{ id: 77 }]);
              return Promise.resolve([{ id: 1 }]);
            }),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { createThread } = await import("./actions");
      await createThread({ subject: "Subj", participantIds: ["p1"], body: "Hi" });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "thread_created",
        expect.objectContaining({ subject: "Subj" }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/messages");
    });
  });

  /* ---- toggleThreadStar ---- */

  describe("toggleThreadStar", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleThreadStar } = await import("./actions");
      await expect(toggleThreadStar(1)).rejects.toThrow("Not authenticated");
    });

    it("flips isStarred when thread exists", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ isStarred: false }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { toggleThreadStar } = await import("./actions");
      await toggleThreadStar(1);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isStarred: true });
    });

    it("does nothing when thread not found", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { toggleThreadStar } = await import("./actions");
      await toggleThreadStar(999);
      expect(mockUpdateSet).not.toHaveBeenCalled();
    });
  });

  /* ---- archiveThread / unarchiveThread ---- */

  describe("archiveThread", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { archiveThread } = await import("./actions");
      await expect(archiveThread(1)).rejects.toThrow("Not authenticated");
    });

    it("sets isArchived=true", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { archiveThread } = await import("./actions");
      await archiveThread(5);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isArchived: true });
    });
  });

  describe("unarchiveThread", () => {
    it("sets isArchived=false", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { unarchiveThread } = await import("./actions");
      await unarchiveThread(5);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isArchived: false });
    });
  });

  /* ---- getQuickReplies ---- */

  describe("getQuickReplies", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getQuickReplies } = await import("./actions");
      await expect(getQuickReplies()).rejects.toThrow("Not authenticated");
    });

    it("returns quick replies list", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1, label: "Hi", body: "Hello there!" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { getQuickReplies } = await import("./actions");
      const result = await getQuickReplies();
      expect(result).toEqual([{ id: 1, label: "Hi", body: "Hello there!" }]);
    });
  });

  /* ---- getVisibleContacts ---- */

  describe("getVisibleContacts", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getVisibleContacts } = await import("./actions");
      await expect(getVisibleContacts()).rejects.toThrow("Not authenticated");
    });

    it("returns contacts excluding current user", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: "p2",
              firstName: "Jane",
              lastName: "Doe",
              email: "jane@example.com",
              role: "client",
              avatarUrl: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        execute: vi.fn().mockResolvedValue([]),
      });
      const { getVisibleContacts } = await import("./actions");
      const result = await getVisibleContacts();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("p2");
    });
  });
});
