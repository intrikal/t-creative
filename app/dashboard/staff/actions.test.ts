import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/staff/actions.ts
 *
 * Covers:
 *  getStaff — returns role=assistant rows with aggregate stats
 *  getStaff — filters: only assistant role (innerJoin on assistantProfiles)
 *  getStaff — sort: ordered by DB (no client-side sort; DB returns in insert order)
 *  getStaff — empty = [] when no assistants exist
 *  getStaff — aggregate stats: activeBookingsToday and totalShiftsMonth computed
 *  getStaff — status: "inactive" when isActive=false, "off_today" when no shift, "active" when shift today
 *  getShifts — returns formatted shifts with bookedSlots count
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, @/lib/auth, @sentry/nextjs.
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
    groupBy: () => chain,
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

const mockRequireAdmin = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const db = makeDefaultDb();
  if (dbOverrides) Object.assign(db, dbOverrides);

  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      role: "role",
      isActive: "isActive",
      avatarUrl: "avatarUrl",
    },
    assistantProfiles: {
      profileId: "profileId",
      title: "title",
      specialties: "specialties",
      bio: "bio",
      isAvailable: "isAvailable",
      startDate: "startDate",
      averageRating: "averageRating",
    },
    shifts: {
      id: "id",
      assistantId: "assistantId",
      status: "status",
      startsAt: "startsAt",
      endsAt: "endsAt",
      notes: "notes",
    },
    bookings: {
      id: "id",
      staffId: "staffId",
      clientId: "clientId",
      startsAt: "startsAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    count: vi.fn(() => ({ type: "count" })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        as: vi.fn(),
      },
    ),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@/lib/types/staff.types", () => ({}));
}

function makeDefaultDb() {
  return {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("staff/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getStaff ---- */

  describe("getStaff", () => {
    it("returns empty array when no assistants exist", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaff } = await import("@/app/dashboard/staff/actions");

      const result = await getStaff();

      expect(result).toEqual([]);
    });

    it("returns staff rows with activeBookingsToday and totalShiftsMonth stats", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            // Main staff query
            return makeChain([
              {
                id: "staff-1",
                firstName: "Alice",
                lastName: "Smith",
                email: "alice@studio.com",
                phone: "555-0100",
                isActive: true,
                title: "Senior Lash Tech",
                specialties: "lash, volume",
                bio: "Expert in volume sets",
                isAvailable: true,
                startDate: new Date("2023-01-15"),
              },
            ]);
          }
          if (selectCall === 2) {
            // Today's booking counts
            return makeChain([{ staffId: "staff-1", count: 3 }]);
          }
          if (selectCall === 3) {
            // Month's shift counts
            return makeChain([{ assistantId: "staff-1", count: 12 }]);
          }
          // Today's shifts (has a shift today → status = "active")
          return makeChain([{ assistantId: "staff-1" }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaff } = await import("@/app/dashboard/staff/actions");

      const result = await getStaff();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "staff-1",
        name: "Alice Smith",
        initials: "AS",
        role: "Senior Lash Tech",
        activeBookingsToday: 3,
        totalShiftsMonth: 12,
        status: "active",
        specialties: ["lash", "volume"],
      });
    });

    it("sets status to off_today when isActive+isAvailable but no shift today", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            return makeChain([
              {
                id: "staff-2",
                firstName: "Bob",
                lastName: "Jones",
                email: "bob@studio.com",
                phone: null,
                isActive: true,
                title: null,
                specialties: null,
                bio: null,
                isAvailable: true,
                startDate: null,
              },
            ]);
          }
          if (selectCall === 2) return makeChain([]); // no bookings today
          if (selectCall === 3) return makeChain([]); // no shifts this month
          return makeChain([]); // no shift today → off_today
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaff } = await import("@/app/dashboard/staff/actions");

      const result = await getStaff();

      expect(result[0].status).toBe("off_today");
      expect(result[0].activeBookingsToday).toBe(0);
      expect(result[0].totalShiftsMonth).toBe(0);
    });

    it("sets status to inactive when isActive=false", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            return makeChain([
              {
                id: "staff-3",
                firstName: "Carol",
                lastName: "White",
                email: "carol@studio.com",
                phone: null,
                isActive: false, // inactive
                title: null,
                specialties: null,
                bio: null,
                isAvailable: true,
                startDate: null,
              },
            ]);
          }
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaff } = await import("@/app/dashboard/staff/actions");

      const result = await getStaff();

      expect(result[0].status).toBe("inactive");
    });
  });

  /* ---- getShifts ---- */

  describe("getShifts", () => {
    it("returns formatted shifts with staffName and bookedSlots count", async () => {
      vi.resetModules();
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          if (selectCall === 1) {
            // Shifts query
            return makeChain([
              {
                id: 1,
                assistantId: "staff-1",
                status: "scheduled",
                startsAt: new Date("2026-04-01T09:00:00Z"),
                endsAt: new Date("2026-04-01T17:00:00Z"),
                notes: null,
                firstName: "Alice",
                lastName: "Smith",
              },
            ]);
          }
          // Booking count for the shift
          return makeChain([{ count: 4 }]);
        }),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getShifts } = await import("@/app/dashboard/staff/actions");

      const result = await getShifts();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        staffId: "staff-1",
        staffName: "Alice",
        staffInitials: "AS",
        status: "scheduled",
        bookedSlots: 4,
      });
    });
  });
});
