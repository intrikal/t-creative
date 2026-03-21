// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

// Returns an awaitable, chainable object that mimics Drizzle ORM's query builder.
// Every builder method (from, where, join, etc.) returns itself so any chain resolves to `rows`.
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

// vi.fn(): creates a mock function that records how it was called.
// mockGetUser simulates Supabase auth -- tests set its return value to control authentication state.
const mockGetUser = vi.fn();
const mockRevalidatePath = vi.fn();
// Shared insert/update mocks so tests can verify what values were written to the DB.
const mockInsertValues = vi.fn(() => ({
  returning: vi.fn().mockResolvedValue([{ id: 1 }]),
}));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));

// Registers vi.doMock() calls for all external dependencies (DB, auth, schema, ORM)
// so the imported server actions run against fakes instead of real services.
function setupMocks(dbOverrides: Record<string, unknown> = {}) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({ values: mockInsertValues })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    ...dbOverrides,
  };

  vi.doMock("@/db", () => ({ db: defaultDb }));
  vi.doMock("@/db/schema", () => ({
    loyaltyRewards: {
      id: "id",
      label: "label",
      pointsCost: "pointsCost",
      discountInCents: "discountInCents",
      category: "category",
      description: "description",
      active: "active",
      sortOrder: "sortOrder",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("loyalty-rewards-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  /* ---- getLoyaltyRewards ---- */

  describe("getLoyaltyRewards", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getLoyaltyRewards } = await import("./loyalty-rewards-actions");
      await expect(getLoyaltyRewards()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no rewards exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getLoyaltyRewards } = await import("./loyalty-rewards-actions");
      const result = await getLoyaltyRewards();
      expect(result).toEqual([]);
    });

    it("returns rewards from the database", async () => {
      vi.resetModules();
      const mockRewards = [
        {
          id: 1,
          label: "$10 Off",
          pointsCost: 200,
          discountInCents: 1000,
          category: "discount",
          description: "Get $10 off",
          active: true,
          sortOrder: 0,
        },
        {
          id: 2,
          label: "Free Lash Bath",
          pointsCost: 300,
          discountInCents: null,
          category: "add_on",
          description: null,
          active: true,
          sortOrder: 1,
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(mockRewards)),
      });
      const { getLoyaltyRewards } = await import("./loyalty-rewards-actions");
      const result = await getLoyaltyRewards();
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("$10 Off");
      expect(result[1].category).toBe("add_on");
    });
  });

  /* ---- createLoyaltyReward ---- */

  describe("createLoyaltyReward", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createLoyaltyReward } = await import("./loyalty-rewards-actions");
      await expect(
        createLoyaltyReward({
          label: "$10 Off",
          pointsCost: 200,
          discountInCents: 1000,
          category: "discount",
          description: null,
          sortOrder: 0,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("validates required fields", async () => {
      vi.resetModules();
      setupMocks();
      const { createLoyaltyReward } = await import("./loyalty-rewards-actions");
      await expect(
        createLoyaltyReward({
          label: "",
          pointsCost: 200,
          discountInCents: null,
          category: "discount",
          description: null,
          sortOrder: 0,
        }),
      ).rejects.toThrow();
    });

    it("validates pointsCost is positive", async () => {
      vi.resetModules();
      setupMocks();
      const { createLoyaltyReward } = await import("./loyalty-rewards-actions");
      await expect(
        createLoyaltyReward({
          label: "Test",
          pointsCost: 0,
          discountInCents: null,
          category: "add_on",
          description: null,
          sortOrder: 0,
        }),
      ).rejects.toThrow();
    });

    it("inserts reward and revalidates paths", async () => {
      vi.resetModules();
      setupMocks();
      const { createLoyaltyReward } = await import("./loyalty-rewards-actions");
      await createLoyaltyReward({
        label: "$10 Off",
        pointsCost: 200,
        discountInCents: 1000,
        category: "discount",
        description: "Get $10 off",
        sortOrder: 0,
      });

      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "$10 Off",
          pointsCost: 200,
          discountInCents: 1000,
          category: "discount",
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/loyalty");
    });
  });

  /* ---- updateLoyaltyReward ---- */

  describe("updateLoyaltyReward", () => {
    it("validates id is positive", async () => {
      vi.resetModules();
      setupMocks();
      const { updateLoyaltyReward } = await import("./loyalty-rewards-actions");
      await expect(
        updateLoyaltyReward({
          id: 0,
          label: "Test",
          pointsCost: 100,
          discountInCents: null,
          category: "add_on",
          description: null,
          active: true,
          sortOrder: 0,
        }),
      ).rejects.toThrow();
    });

    it("updates reward and revalidates paths", async () => {
      vi.resetModules();
      setupMocks();
      const { updateLoyaltyReward } = await import("./loyalty-rewards-actions");
      await updateLoyaltyReward({
        id: 1,
        label: "Updated Reward",
        pointsCost: 300,
        discountInCents: 1500,
        category: "discount",
        description: "Updated",
        active: true,
        sortOrder: 1,
      });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          label: "Updated Reward",
          pointsCost: 300,
          discountInCents: 1500,
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/loyalty");
    });
  });

  /* ---- deleteLoyaltyReward ---- */

  describe("deleteLoyaltyReward", () => {
    it("validates id is positive", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteLoyaltyReward } = await import("./loyalty-rewards-actions");
      await expect(deleteLoyaltyReward(0)).rejects.toThrow();
    });

    it("soft-deletes by setting active to false", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteLoyaltyReward } = await import("./loyalty-rewards-actions");
      await deleteLoyaltyReward(1);

      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/loyalty");
    });
  });
});
