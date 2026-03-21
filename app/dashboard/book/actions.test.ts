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
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
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
});
