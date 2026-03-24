import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/assistant-home-actions.ts
 *
 * Covers:
 *  getAssistantHomeData — today's bookings for authenticated assistant only
 *  getAssistantHomeData — upcoming time-off entries sorted by startDate
 *  getAssistantHomeData — recent messages (last 3)
 *  getAssistantHomeData — earnings this week (sum of completed booking totals)
 *  getAssistantHomeData — non-assistant (unauthenticated) rejected with "Unauthorized"
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, drizzle-orm/pg-core, @/lib/auth.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then(onFulfilled: (v: unknown) => unknown) {
      return resolved.then(onFulfilled);
    },
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetCurrentUser = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(user: { id: string; email: string } | null, selectResponses: unknown[][] = []) {
  mockGetCurrentUser.mockResolvedValue(user);

  let callIdx = 0;
  const selectFn = vi.fn(() => {
    const rows = selectResponses[callIdx] ?? [];
    callIdx++;
    return makeChain(rows);
  });

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
      delete: vi.fn(() => ({ where: vi.fn() })),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    profiles: { id: "id", firstName: "firstName", avatarUrl: "avatarUrl" },
    assistantProfiles: {
      profileId: "profileId",
      averageRating: "averageRating",
    },
    bookings: {
      id: "id",
      staffId: "staffId",
      clientId: "clientId",
      serviceId: "serviceId",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      location: "location",
      status: "status",
    },
    services: { id: "id", name: "name", category: "category" },
    messages: {
      id: "id",
      body: "body",
      isRead: "isRead",
      createdAt: "createdAt",
      senderId: "senderId",
      recipientId: "recipientId",
    },
    enrollments: {
      id: "id",
      status: "status",
      progressPercent: "progressPercent",
      programId: "programId",
      clientId: "clientId",
      enrolledAt: "enrolledAt",
    },
    trainingPrograms: { id: "id", name: "name", category: "category" },
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
      label: "label",
      notes: "notes",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    sum: vi.fn((...a: unknown[]) => ({ type: "sum", a })),
    countDistinct: vi.fn((...a: unknown[]) => ({ type: "countDistinct", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/auth", () => ({ getCurrentUser: mockGetCurrentUser }));
  // AssistantHomePage types
  vi.doMock("@/app/dashboard/AssistantHomePage", () => ({}));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("assistant-home-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- unauthenticated ---- */

  describe("unauthenticated", () => {
    it("throws Unauthorized when user is null", async () => {
      vi.resetModules();
      setupMocks(null);
      const { getAssistantHomeData } = await import("@/app/dashboard/assistant-home-actions");

      await expect(getAssistantHomeData()).rejects.toThrow("Unauthorized");
    });
  });

  /* ---- today's bookings ---- */

  describe("today's bookings", () => {
    it("returns today's bookings for the authenticated assistant only", async () => {
      vi.resetModules();
      setupMocks({ id: "staff-1", email: "staff@studio.com" }, [
        // 1: profileRow
        [{ firstName: "Alice", avatarUrl: null }],
        // 2: assistantProfile
        [{ averageRating: 4.8 }],
        // 3: todayBookingsRaw
        [
          {
            id: 10,
            status: "confirmed",
            startsAt: new Date("2026-04-01T10:00:00Z"),
            durationMinutes: 90,
            totalInCents: 12000,
            location: "Studio",
            clientFirstName: "Jane",
            clientLastName: "Doe",
            serviceName: "Classic Full Set",
            serviceCategory: "lash",
          },
        ],
        // 4: earningsRow
        [{ total: "50000" }],
        // 5: clientsRow
        [{ count: "5" }],
        // 6: recentMessagesRaw
        [],
        // 7: enrollmentsRaw
        [],
        // 8: timeOffRaw
        [],
      ]);
      const { getAssistantHomeData } = await import("@/app/dashboard/assistant-home-actions");

      const data = await getAssistantHomeData();

      expect(data.firstName).toBe("Alice");
      expect(data.todayBookings).toHaveLength(1);
      expect(data.todayBookings[0]).toMatchObject({
        id: 10,
        serviceName: "Classic Full Set",
        serviceCategory: "lash",
      });
      expect(data.stats.appointmentsToday).toBe(1);
    });
  });

  /* ---- earnings ---- */

  describe("earnings", () => {
    it("sums completed booking totals for the current week", async () => {
      vi.resetModules();
      setupMocks({ id: "staff-1", email: "staff@studio.com" }, [
        [{ firstName: "Alice", avatarUrl: null }],
        [{ averageRating: null }],
        [], // no today bookings
        [{ total: "36000" }], // earnings: $360
        [{ count: "3" }],
        [],
        [],
        [],
      ]);
      const { getAssistantHomeData } = await import("@/app/dashboard/assistant-home-actions");

      const data = await getAssistantHomeData();

      expect(data.stats.earningsThisWeek).toBe(36000);
    });
  });

  /* ---- recent messages ---- */

  describe("recent messages", () => {
    it("returns last 3 messages received by the assistant", async () => {
      vi.resetModules();
      setupMocks({ id: "staff-1", email: "staff@studio.com" }, [
        [{ firstName: "Alice", avatarUrl: null }],
        [{ averageRating: null }],
        [],
        [{ total: null }],
        [{ count: "0" }],
        [
          {
            id: 1,
            body: "Hi Alice!",
            isRead: false,
            createdAt: new Date(),
            senderFirstName: "Jane",
            senderAvatarUrl: null,
          },
          {
            id: 2,
            body: "See you tomorrow",
            isRead: true,
            createdAt: new Date(),
            senderFirstName: "Bob",
            senderAvatarUrl: null,
          },
          {
            id: 3,
            body: "Thanks!",
            isRead: true,
            createdAt: new Date(),
            senderFirstName: "Carol",
            senderAvatarUrl: null,
          },
        ],
        [],
        [],
      ]);
      const { getAssistantHomeData } = await import("@/app/dashboard/assistant-home-actions");

      const data = await getAssistantHomeData();

      expect(data.recentMessages).toHaveLength(3);
      expect(data.recentMessages[0].body).toBe("Hi Alice!");
    });
  });

  /* ---- time-off ---- */

  describe("time-off entries", () => {
    it("returns upcoming time-off entries sorted by startDate", async () => {
      vi.resetModules();
      setupMocks({ id: "staff-1", email: "staff@studio.com" }, [
        [{ firstName: "Alice", avatarUrl: null }],
        [{ averageRating: null }],
        [],
        [{ total: null }],
        [{ count: "0" }],
        [],
        [],
        [
          {
            id: 1,
            startDate: "2026-04-10",
            endDate: "2026-04-11",
            label: "Vacation",
            notes: JSON.stringify({ status: "approved", reason: "Beach trip" }),
            createdAt: new Date(),
          },
        ],
      ]);
      const { getAssistantHomeData } = await import("@/app/dashboard/assistant-home-actions");

      const data = await getAssistantHomeData();

      expect(data.timeOffEntries).toHaveLength(1);
      expect(data.timeOffEntries[0]).toMatchObject({
        startDate: "2026-04-10",
        status: "approved",
        reason: "Beach trip",
      });
    });
  });
});
