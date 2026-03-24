import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/bookings/select-actions.ts
 *
 * Covers:
 *  getStaffForSelect   — returns non-client users, sorted by firstName
 *  getServicesForSelect — returns active services with default duration/price
 *  getClientsForSelect — returns active clients with preferredRebookIntervalDays
 *  searchClients       — returns [] for empty query, results for matching query
 *  getStaffForSelect   — returns [] when no staff exist
 *
 * Note: This file provides dropdown select lists. Staff availability, time-off,
 * overlap detection, slot calculation, business hours, and buffer logic live
 * in separate booking/scheduling files (not tested here).
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
    leftJoin: () => chain,
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
      phone: "phone",
      email: "email",
      role: "role",
      isActive: "isActive",
    },
    services: {
      id: "id",
      name: "name",
      category: "category",
      durationMinutes: "durationMinutes",
      priceInCents: "priceInCents",
      depositInCents: "depositInCents",
      isActive: "isActive",
    },
    clientPreferences: {
      profileId: "profileId",
      preferredRebookIntervalDays: "preferredRebookIntervalDays",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a, as: vi.fn() })),
      {
        as: vi.fn(),
      },
    ),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
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

describe("select-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  /* ---- getStaffForSelect ---- */

  describe("getStaffForSelect", () => {
    it("returns non-client users with id and name", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            { id: "staff-1", firstName: "Alice", lastName: "Smith" },
            { id: "staff-2", firstName: "Bob", lastName: "Jones" },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaffForSelect } = await import("@/app/dashboard/bookings/select-actions");

      const result = await getStaffForSelect();

      expect(result).toEqual([
        { id: "staff-1", name: "Alice Smith" },
        { id: "staff-2", name: "Bob Jones" },
      ]);
    });

    it("returns empty array when no staff exist", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getStaffForSelect } = await import("@/app/dashboard/bookings/select-actions");

      const result = await getStaffForSelect();

      expect(result).toEqual([]);
    });
  });

  /* ---- getServicesForSelect ---- */

  describe("getServicesForSelect", () => {
    it("returns active services with durationMinutes defaulting to 60", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              name: "Classic Full Set",
              category: "lash",
              durationMinutes: null, // should default to 60
              priceInCents: 12000,
              depositInCents: null, // should default to 0
            },
            {
              id: 2,
              name: "Permanent Bracelet",
              category: "jewelry",
              durationMinutes: 30,
              priceInCents: 8000,
              depositInCents: 2500,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getServicesForSelect } = await import("@/app/dashboard/bookings/select-actions");

      const result = await getServicesForSelect();

      expect(result[0].durationMinutes).toBe(60); // null → 60
      expect(result[0].depositInCents).toBe(0); // null → 0
      expect(result[1].durationMinutes).toBe(30);
      expect(result[1].depositInCents).toBe(2500);
    });
  });

  /* ---- getClientsForSelect ---- */

  describe("getClientsForSelect", () => {
    it("returns active clients with name and preferredRebookIntervalDays", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: "client-1",
              firstName: "Jane",
              lastName: "Doe",
              phone: "555-0100",
              preferredRebookIntervalDays: 28,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientsForSelect } = await import("@/app/dashboard/bookings/select-actions");

      const result = await getClientsForSelect();

      expect(result[0]).toEqual({
        id: "client-1",
        name: "Jane Doe",
        phone: "555-0100",
        preferredRebookIntervalDays: 28,
      });
    });
  });

  /* ---- searchClients ---- */

  describe("searchClients", () => {
    it("returns empty array immediately for empty query without hitting DB", async () => {
      vi.resetModules();
      const mockSelect = vi.fn(() => makeChain([]));
      setupMocks({
        select: mockSelect,
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { searchClients } = await import("@/app/dashboard/bookings/select-actions");

      const result = await searchClients("   ");

      expect(result).toEqual([]);
      // Empty query short-circuits — DB should not be queried
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it("returns matched clients for a non-empty query", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: "client-2",
              firstName: "Trini",
              lastName: "Lopez",
              phone: null,
              preferredRebookIntervalDays: null,
              score: 0.8,
            },
          ]),
        ),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { searchClients } = await import("@/app/dashboard/bookings/select-actions");

      const result = await searchClients("Tri");

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "client-2", name: "Trini Lopez" });
    });
  });
});
