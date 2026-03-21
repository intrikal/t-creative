/**
 * @file notification-inbox.test.ts
 * @description Unit tests for notification-inbox server actions (inbox summary,
 * mark-all-read, mark-one-read, paginated inbox).
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
    offset: () => chain,
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

/** Registers all module mocks; accepts optional custom db object. */
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
      channel: "channel",
      type: "type",
      title: "title",
      body: "body",
      createdAt: "createdAt",
      readAt: "readAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    count: vi.fn(() => ({ type: "count" })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("notification-inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getInboxSummary ---- */

  describe("getInboxSummary", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getInboxSummary } = await import("./notification-inbox");
      await expect(getInboxSummary()).rejects.toThrow("Not authenticated");
    });

    it("returns empty items and zero unreadCount when no notifications", async () => {
      vi.resetModules();
      setupMocks();
      const { getInboxSummary } = await import("./notification-inbox");
      const result = await getInboxSummary();
      expect(result.items).toEqual([]);
      expect(result.unreadCount).toBe(0);
    });

    it("maps rows to InboxItem shape", async () => {
      vi.resetModules();
      const createdAt = new Date("2026-03-01T10:00:00Z");
      const readAt = new Date("2026-03-01T12:00:00Z");
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              title: "Booking confirmed",
              body: "Your appointment is confirmed.",
              type: "booking_confirmation",
              createdAt,
              readAt,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInboxSummary } = await import("./notification-inbox");
      const result = await getInboxSummary();
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        id: 1,
        title: "Booking confirmed",
        type: "booking_confirmation",
        createdAt: createdAt.toISOString(),
        readAt: readAt.toISOString(),
      });
    });

    it("counts unread items where readAt is null", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              title: "Unread",
              body: null,
              type: "general",
              createdAt: new Date(),
              readAt: null,
            },
            {
              id: 2,
              title: "Read",
              body: null,
              type: "general",
              createdAt: new Date(),
              readAt: new Date(),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInboxSummary } = await import("./notification-inbox");
      const result = await getInboxSummary();
      expect(result.unreadCount).toBe(1);
    });

    it("sets readAt to null on InboxItem when row readAt is null", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 3,
              title: "Unread notification",
              body: null,
              type: "promotion",
              createdAt: new Date("2026-03-10T08:00:00Z"),
              readAt: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInboxSummary } = await import("./notification-inbox");
      const result = await getInboxSummary();
      expect(result.items[0].readAt).toBeNull();
    });
  });

  /* ---- markAllInboxRead ---- */

  describe("markAllInboxRead", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { markAllInboxRead } = await import("./notification-inbox");
      await expect(markAllInboxRead()).rejects.toThrow("Not authenticated");
    });

    it("calls db.update to set readAt for all unread notifications", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { markAllInboxRead } = await import("./notification-inbox");
      await markAllInboxRead();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ readAt: expect.any(Date) }),
      );
    });
  });

  /* ---- markOneRead ---- */

  describe("markOneRead", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { markOneRead } = await import("./notification-inbox");
      await expect(markOneRead(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update to set readAt for the given notification id", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { markOneRead } = await import("./notification-inbox");
      await markOneRead(42);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ readAt: expect.any(Date) }),
      );
    });
  });

  /* ---- getInboxPage ---- */

  describe("getInboxPage", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getInboxPage } = await import("./notification-inbox");
      await expect(getInboxPage({})).rejects.toThrow("Not authenticated");
    });

    it("returns items, total, page, and pageSize", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 10,
                title: "Hello",
                body: null,
                type: "general",
                createdAt: new Date("2026-03-01T00:00:00Z"),
                readAt: null,
              },
            ]);
          }
          // Second call: count query
          return makeChain([{ value: 1 }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInboxPage } = await import("./notification-inbox");
      const result = await getInboxPage({ page: 1, pageSize: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it("defaults to page 1 and pageSize 20 when not provided", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]);
          return makeChain([{ value: 0 }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInboxPage } = await import("./notification-inbox");
      const result = await getInboxPage({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it("returns empty items when no notifications match", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([]);
          return makeChain([{ value: 0 }]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getInboxPage } = await import("./notification-inbox");
      const result = await getInboxPage({ type: "promotion" });
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
