import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Tests for lib/location-filter — shared location_id WHERE-clause helper.
 *
 * Covers:
 *  - locationFilter: pushes eq condition when locationId is a number,
 *    leaves conditions unchanged for null/undefined
 *  - getActiveLocationIds: returns an array of active location IDs from the DB
 *
 * Mocks: drizzle-orm (eq), @/db, @/db/schema.
 */

// ── drizzle-orm mock ──────────────────────────────────────────────────────────

const mockEq = vi.fn().mockReturnValue({ type: "eq_condition" });

vi.mock("drizzle-orm", () => ({
  eq: mockEq,
}));

// ── DB mock for getActiveLocationIds ──────────────────────────────────────────

// select({ id }).from(locations).where(eq(...)).orderBy(locations.name)
const mockOrderBy = vi.fn();
const mockDbWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
const mockFrom = vi.fn().mockReturnValue({ where: mockDbWhere });
const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

vi.mock("@/db", () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock("@/db/schema", () => ({
  locations: { id: "locations.id", name: "locations.name", isActive: "locations.isActive" },
}));

describe("lib/location-filter", () => {
  // Fake PgColumn — only the reference matters for the eq() call.
  const fakeColumn = {} as unknown as PgColumn;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set implementations cleared by clearAllMocks().
    mockEq.mockReturnValue({ type: "eq_condition" });
    mockOrderBy.mockResolvedValue([]);
    mockDbWhere.mockReturnValue({ orderBy: mockOrderBy });
  });

  // ── locationFilter ──────────────────────────────────────────────────────────

  describe("locationFilter", () => {
    it("pushes an eq condition into the array when locationId is a number", async () => {
      const { locationFilter } = await import("./location-filter");
      const conditions: SQL[] = [];

      locationFilter(conditions, fakeColumn, 3);

      expect(mockEq).toHaveBeenCalledWith(fakeColumn, 3);
      expect(conditions).toHaveLength(1);
    });

    it("does not push any condition when locationId is null", async () => {
      const { locationFilter } = await import("./location-filter");
      const conditions: SQL[] = [];

      locationFilter(conditions, fakeColumn, null);

      expect(mockEq).not.toHaveBeenCalled();
      expect(conditions).toHaveLength(0);
    });

    it("does not push any condition when locationId is undefined", async () => {
      const { locationFilter } = await import("./location-filter");
      const conditions: SQL[] = [];

      locationFilter(conditions, fakeColumn, undefined);

      expect(mockEq).not.toHaveBeenCalled();
      expect(conditions).toHaveLength(0);
    });
  });

  // ── getActiveLocationIds ────────────────────────────────────────────────────

  describe("getActiveLocationIds", () => {
    it("returns an array of active location IDs ordered by name", async () => {
      mockOrderBy.mockResolvedValue([{ id: 1 }, { id: 3 }, { id: 7 }]);

      const { getActiveLocationIds } = await import("./location-filter");
      const result = await getActiveLocationIds();

      expect(result).toEqual([1, 3, 7]);
    });

    it("returns an empty array when no active locations exist", async () => {
      mockOrderBy.mockResolvedValue([]);

      const { getActiveLocationIds } = await import("./location-filter");
      const result = await getActiveLocationIds();

      expect(result).toEqual([]);
    });
  });
});
