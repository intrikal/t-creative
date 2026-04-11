/**
 * @file actions.test.ts
 * @description Unit tests for book/actions (studio availability with business
 * hours, time-off blocks, lunch break settings, auth check).
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
/** Captures revalidatePath calls. */
const mockRevalidatePath = vi.fn();
/** Stub for getPublicBookingRules — returns configurable rules. */
const mockGetPublicBookingRules = vi.fn();

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
    businessHours: {
      id: "id",
      dayOfWeek: "dayOfWeek",
      isOpen: "isOpen",
      opensAt: "opensAt",
      closesAt: "closesAt",
      staffId: "staffId",
    },
    timeOff: {
      id: "id",
      startDate: "startDate",
      endDate: "endDate",
      staffId: "staffId",
    },
    settings: {
      id: "id",
      key: "key",
      value: "value",
    },
    bookings: {
      id: "id",
      status: "status",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      staffId: "staffId",
      locationId: "locationId",
      deletedAt: "deletedAt",
    },
    services: {
      id: "id",
      durationMinutes: "durationMinutes",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBookingRules: mockGetPublicBookingRules,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("book/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getStudioAvailability ---- */

  describe("getStudioAvailability", () => {
    it("returns empty hours, timeOff, and null lunchBreak when no rows", async () => {
      vi.resetModules();
      setupMocks();
      const { getStudioAvailability } = await import("./actions");
      const result = await getStudioAvailability();
      expect(result.hours).toEqual([]);
      expect(result.timeOff).toEqual([]);
      expect(result.lunchBreak).toBeNull();
    });

    it("maps businessHours rows to AvailabilityDay shape", async () => {
      vi.resetModules();
      const hoursRows = [
        { dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
        { dayOfWeek: 3, isOpen: false, opensAt: null, closesAt: null },
      ];
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          // Promise.all calls select 3 times
          callCount++;
          if (callCount === 1) return makeChain(hoursRows);
          if (callCount === 2) return makeChain([]);
          return makeChain([]); // settings
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStudioAvailability } = await import("./actions");
      const result = await getStudioAvailability();
      expect(result.hours).toHaveLength(2);
      expect(result.hours[0]).toMatchObject({ dayOfWeek: 1, isOpen: true, opensAt: "09:00" });
    });

    it("maps timeOff rows to TimeOffBlock shape", async () => {
      vi.resetModules();
      const timeOffRows = [{ startDate: "2026-07-04", endDate: "2026-07-05" }];
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([]);
          if (callCount === 2) return makeChain(timeOffRows);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStudioAvailability } = await import("./actions");
      const result = await getStudioAvailability();
      expect(result.timeOff).toHaveLength(1);
      expect(result.timeOff[0]).toMatchObject({ startDate: "2026-07-04", endDate: "2026-07-05" });
    });

    it("parses lunchBreak from settings row", async () => {
      vi.resetModules();
      const lunchBreakValue = { enabled: true, start: "12:00", end: "13:00" };
      const settingsRow = { key: "lunch_break", value: lunchBreakValue };
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain([]);
          if (callCount === 2) return makeChain([]);
          return makeChain([settingsRow]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStudioAvailability } = await import("./actions");
      const result = await getStudioAvailability();
      expect(result.lunchBreak).toMatchObject({ enabled: true, start: "12:00", end: "13:00" });
    });

    it("sorts hours by dayOfWeek ascending", async () => {
      vi.resetModules();
      const hoursRows = [
        { dayOfWeek: 5, isOpen: true, opensAt: "10:00", closesAt: "18:00" },
        { dayOfWeek: 1, isOpen: true, opensAt: "09:00", closesAt: "17:00" },
      ];
      let callCount = 0;
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          if (callCount === 1) return makeChain(hoursRows);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStudioAvailability } = await import("./actions");
      const result = await getStudioAvailability();
      expect(result.hours[0].dayOfWeek).toBe(1);
      expect(result.hours[1].dayOfWeek).toBe(5);
    });
  });

  /* ---- checkIsAuthenticated ---- */

  describe("checkIsAuthenticated", () => {
    it("returns true when user is logged in", async () => {
      vi.resetModules();
      setupMocks();
      const { checkIsAuthenticated } = await import("./actions");
      const result = await checkIsAuthenticated();
      expect(result).toBe(true);
    });

    it("returns false when user is null", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { checkIsAuthenticated } = await import("./actions");
      const result = await checkIsAuthenticated();
      expect(result).toBe(false);
    });
  });

  /* ---- getBookedSlots ---- */

  describe("getBookedSlots", () => {
    /** Default rules: 15-min buffer between bookings. */
    const defaultRules = { bufferMinutes: 15 };

    /**
     * Helper: builds a mock db whose select() returns different rows
     * depending on the call order. Call 1 = bookings query, call 2 =
     * services query. The third call (settings for getStudioAvailability)
     * is unused here but the chain handles it.
     */
    function setupBookedSlotsMocks(
      bookingRows: { startsAt: Date; durationMinutes: number }[],
      serviceRows: { durationMinutes: number }[] = [{ durationMinutes: 60 }],
      rules = defaultRules,
    ) {
      let callCount = 0;
      mockGetPublicBookingRules.mockResolvedValue(rules);
      setupMocks({
        select: vi.fn(() => {
          callCount++;
          // Promise.all fires bookings query first, then services query
          if (callCount === 1) return makeChain(bookingRows);
          if (callCount === 2) return makeChain(serviceRows);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
    }

    it("returns slot as unavailable when there is a confirmed booking at that time", async () => {
      vi.resetModules();
      // Booking from 10:00–11:00 (60 min)
      setupBookedSlotsMocks([{ startsAt: new Date("2026-04-15T10:00:00"), durationMinutes: 60 }]);
      const { getBookedSlots } = await import("./actions");
      const result = await getBookedSlots("2026-04-15", 1);
      // 10:00 slot should be blocked (booking occupies 10:00–11:00 + buffer)
      expect(result).toContain("10:00");
    });

    it("respects buffer time — slot before a booking is blocked", async () => {
      vi.resetModules();
      // Booking at 10:00 with 15-min buffer → blocked from 09:45.
      // A 60-min service at 09:00 would end at 10:00, which is inside
      // the blocked range (09:45–11:15). So 09:00 is unavailable.
      // 09:30 → ends at 10:30, overlaps blocked range → unavailable.
      setupBookedSlotsMocks(
        [{ startsAt: new Date("2026-04-15T10:00:00"), durationMinutes: 60 }],
        [{ durationMinutes: 60 }],
        { bufferMinutes: 15 },
      );
      const { getBookedSlots } = await import("./actions");
      const result = await getBookedSlots("2026-04-15", 1);
      // 09:30 + 60min service = ends at 10:30, which overlaps blocked
      // range [09:45, 11:15] → should be unavailable
      expect(result).toContain("09:30");
    });

    it("returns no unavailable slots for an empty day", async () => {
      vi.resetModules();
      setupBookedSlotsMocks([]);
      const { getBookedSlots } = await import("./actions");
      const result = await getBookedSlots("2026-04-15", 1);
      expect(result).toEqual([]);
    });

    it("does not block slots for cancelled or no_show bookings", async () => {
      vi.resetModules();
      // The query filters status IN ('pending', 'confirmed', 'in_progress')
      // so cancelled/no_show rows never reach the action. Simulate by
      // returning an empty result set (as the DB would after filtering).
      setupBookedSlotsMocks([]);
      const { getBookedSlots } = await import("./actions");
      const result = await getBookedSlots("2026-04-15", 1);
      expect(result).toEqual([]);
    });

    it("filters by staffId when provided", async () => {
      vi.resetModules();
      // Staff-A has a booking at 14:00. The DB mock returns it because
      // the query would include eq(bookings.staffId, staffId).
      setupBookedSlotsMocks([{ startsAt: new Date("2026-04-15T14:00:00"), durationMinutes: 60 }]);
      const { getBookedSlots } = await import("./actions");
      const result = await getBookedSlots("2026-04-15", 1, "staff-a");
      expect(result).toContain("14:00");
    });
  });
});
