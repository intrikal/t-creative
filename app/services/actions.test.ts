import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/services/actions.ts
 *
 * Covers:
 *  getPublishedServices — returns active services in category/sortOrder order
 *  getPublishedServices — inactive services are excluded (filtered by DB, not client)
 *  getPublishedServices — returns empty array when no active services
 *  getPublishedServices — null price fields passed through as-is
 *  getPublishedServices — multiple categories returned in DB order
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, next/cache.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    then(onFulfilled: (v: unknown) => unknown) {
      return resolved.then(onFulfilled);
    },
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(rows: unknown[] = []) {
  const selectFn = vi.fn(() => makeChain(rows));

  vi.doMock("@/db", () => ({
    db: {
      select: selectFn,
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }));
  vi.doMock("@/db/schema", () => ({
    services: {
      id: "id",
      category: "category",
      name: "name",
      description: "description",
      priceInCents: "priceInCents",
      priceMinInCents: "priceMinInCents",
      priceMaxInCents: "priceMaxInCents",
      durationMinutes: "durationMinutes",
      isActive: "isActive",
      sortOrder: "sortOrder",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
  }));
  vi.doMock("next/cache", () => ({
    cacheTag: vi.fn(),
    cacheLife: vi.fn(),
    revalidateTag: vi.fn(),
  }));

  return { selectFn };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("services/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ---- happy path ---- */

  describe("getPublishedServices — with services", () => {
    it("returns active services with all fields", async () => {
      vi.resetModules();
      setupMocks([
        {
          id: 1,
          category: "lash",
          name: "Classic Full Set",
          description: "Full set of classic lashes",
          priceInCents: 12000,
          priceMinInCents: null,
          priceMaxInCents: null,
          durationMinutes: 120,
        },
        {
          id: 2,
          category: "lash",
          name: "Lash Fill",
          description: null,
          priceInCents: 7500,
          priceMinInCents: null,
          priceMaxInCents: null,
          durationMinutes: 60,
        },
      ]);
      const { getPublishedServices } = await import("@/app/services/actions");

      const result = await getPublishedServices();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 1,
        category: "lash",
        name: "Classic Full Set",
        priceInCents: 12000,
        durationMinutes: 120,
      });
      expect(result[1].name).toBe("Lash Fill");
    });

    it("passes through null price fields unchanged", async () => {
      vi.resetModules();
      setupMocks([
        {
          id: 3,
          category: "jewelry",
          name: "Permanent Bracelet",
          description: "Starting from price",
          priceInCents: null,
          priceMinInCents: 8000,
          priceMaxInCents: 15000,
          durationMinutes: 45,
        },
      ]);
      const { getPublishedServices } = await import("@/app/services/actions");

      const result = await getPublishedServices();

      expect(result[0].priceInCents).toBeNull();
      expect(result[0].priceMinInCents).toBe(8000);
      expect(result[0].priceMaxInCents).toBe(15000);
    });

    it("returns multiple categories in DB order", async () => {
      vi.resetModules();
      setupMocks([
        {
          id: 1,
          category: "lash",
          name: "Classic Full Set",
          description: null,
          priceInCents: 12000,
          priceMinInCents: null,
          priceMaxInCents: null,
          durationMinutes: 120,
        },
        {
          id: 2,
          category: "jewelry",
          name: "Permanent Bracelet",
          description: null,
          priceInCents: 8000,
          priceMinInCents: null,
          priceMaxInCents: null,
          durationMinutes: 45,
        },
        {
          id: 3,
          category: "consulting",
          name: "Style Consult",
          description: null,
          priceInCents: 5000,
          priceMinInCents: null,
          priceMaxInCents: null,
          durationMinutes: 30,
        },
      ]);
      const { getPublishedServices } = await import("@/app/services/actions");

      const result = await getPublishedServices();

      expect(result).toHaveLength(3);
      expect(result.map((s) => s.category)).toEqual(["lash", "jewelry", "consulting"]);
    });
  });

  /* ---- inactive excluded ---- */

  describe("getPublishedServices — inactive excluded", () => {
    it("returns only what the DB returns (isActive filter is applied by DB)", async () => {
      vi.resetModules();
      // The mock simulates DB already filtering — only active services returned
      setupMocks([
        {
          id: 1,
          category: "lash",
          name: "Classic Full Set",
          description: null,
          priceInCents: 12000,
          priceMinInCents: null,
          priceMaxInCents: null,
          durationMinutes: 120,
        },
        // inactive service (id: 99) would not appear — DB filters it
      ]);
      const { getPublishedServices } = await import("@/app/services/actions");

      const result = await getPublishedServices();

      // Only 1 service returned (inactive one excluded by DB)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  /* ---- empty ---- */

  describe("getPublishedServices — empty", () => {
    it("returns empty array when no active services exist", async () => {
      vi.resetModules();
      setupMocks([]);
      const { getPublishedServices } = await import("@/app/services/actions");

      const result = await getPublishedServices();

      expect(result).toEqual([]);
    });
  });
});
