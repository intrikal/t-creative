/**
 * @file actions.test.ts
 * @description Unit tests for aftercare/actions server actions (CRUD for aftercare
 * sections & studio policies, plus seed defaults).
 *
 * Testing utilities used:
 * - describe: Groups related test cases into logical blocks (one per action function).
 * - it: Defines a single test case with a human-readable description.
 * - expect: Makes assertions about values — the core of each test's pass/fail logic.
 * - vi: Vitest's mock utility namespace (vi.fn, vi.doMock, vi.resetModules, etc.).
 * - vi.fn(): Creates a mock function whose calls can be inspected and return value controlled.
 * - vi.doMock(): Lazily registers a module mock effective on the next dynamic import().
 * - vi.resetModules(): Clears the module registry so the next import() gets fresh mocks.
 * - vi.clearAllMocks(): Resets call counts/args on every mock without removing implementation.
 * - beforeEach: Runs before every `it` block to clear mocks and set default auth state.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

/**
 * Creates a chainable mock that mimics Drizzle's query-builder API.
 * Every method (from, where, leftJoin, ...) returns the same chain,
 * and the chain is thenable — resolving to `rows` — so await works.
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

/** Stub for requireAdmin — controls whether the request is authenticated and admin-authorized. */
const mockRequireAdmin = vi.fn();
/** Captures revalidatePath calls so tests can verify correct cache invalidation. */
const mockRevalidatePath = vi.fn();

/**
 * Registers all module mocks needed by the actions under test.
 * Accepts an optional custom db object; falls back to a default
 * mock that returns empty result sets for all operations.
 */
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
    policies: {
      id: "id",
      type: "type",
      slug: "slug",
      title: "title",
      content: "content",
      category: "category",
      sortOrder: "sortOrder",
      isPublished: "isPublished",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({
    requireAdmin: mockRequireAdmin,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("aftercare/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ id: "user-1", email: "admin@test.com" });
  });

  /* ---- getAftercareSections ---- */

  describe("getAftercareSections", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { getAftercareSections } = await import("./actions");
      await expect(getAftercareSections()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no rows", async () => {
      vi.resetModules();
      setupMocks();
      const { getAftercareSections } = await import("./actions");
      const result = await getAftercareSections();
      expect(result).toEqual([]);
    });

    it("maps rows to AftercareSection shape, parsing JSON content", async () => {
      vi.resetModules();
      const row = {
        id: 1,
        title: "Lash Extensions",
        category: "lash",
        content: JSON.stringify({ dos: ["Keep dry"], donts: ["No oil"] }),
        sortOrder: 0,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAftercareSections } = await import("./actions");
      const result = await getAftercareSections();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        title: "Lash Extensions",
        category: "lash",
        dos: ["Keep dry"],
        donts: ["No oil"],
      });
    });

    it("returns empty dos/donts for invalid JSON content", async () => {
      vi.resetModules();
      const row = { id: 2, title: "Bad", category: null, content: "not-json", sortOrder: 0 };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAftercareSections } = await import("./actions");
      const result = await getAftercareSections();
      expect(result[0].dos).toEqual([]);
      expect(result[0].donts).toEqual([]);
    });
  });

  /* ---- getPolicies ---- */

  describe("getPolicies", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { getPolicies } = await import("./actions");
      await expect(getPolicies()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no rows", async () => {
      vi.resetModules();
      setupMocks();
      const { getPolicies } = await import("./actions");
      const result = await getPolicies();
      expect(result).toEqual([]);
    });

    it("maps rows to PolicyEntry shape", async () => {
      vi.resetModules();
      const row = {
        id: 5,
        title: "Cancellation Policy",
        content: "48 hour notice required.",
        sortOrder: 0,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getPolicies } = await import("./actions");
      const result = await getPolicies();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 5,
        title: "Cancellation Policy",
        content: "48 hour notice required.",
      });
    });
  });

  /* ---- createAftercareSection ---- */

  describe("createAftercareSection", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { createAftercareSection } = await import("./actions");
      await expect(createAftercareSection({ title: "Test", dos: [], donts: [] })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("inserts aftercare section with slugified title", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      // First select returns sort order, second returns the insert result
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([{ sortOrder: 2 }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAftercareSection } = await import("./actions");
      await createAftercareSection({
        title: "Lash Care",
        category: "lash",
        dos: ["Keep dry"],
        donts: ["No oil"],
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "aftercare",
          slug: "lash-care-aftercare",
          title: "Lash Care",
          category: "lash",
        }),
      );
    });

    it("uses sortOrder 0 when no existing sections", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAftercareSection } = await import("./actions");
      await createAftercareSection({ title: "Test", dos: [], donts: [] });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 0 }));
    });

    it("revalidates dashboard paths", async () => {
      vi.resetModules();
      setupMocks();
      const { createAftercareSection } = await import("./actions");
      await createAftercareSection({ title: "Test", dos: [], donts: [] });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/aftercare");
    });
  });

  /* ---- updateAftercareSection ---- */

  describe("updateAftercareSection", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { updateAftercareSection } = await import("./actions");
      await expect(
        updateAftercareSection(1, { title: "Test", dos: [], donts: [] }),
      ).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with correct fields", async () => {
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
      const { updateAftercareSection } = await import("./actions");
      await updateAftercareSection(5, {
        title: "Updated Lash",
        dos: ["Brush daily"],
        donts: ["No mascara"],
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated Lash",
          slug: "updated-lash-aftercare",
          content: JSON.stringify({ dos: ["Brush daily"], donts: ["No mascara"] }),
        }),
      );
    });

    it("revalidates dashboard paths", async () => {
      vi.resetModules();
      setupMocks();
      const { updateAftercareSection } = await import("./actions");
      await updateAftercareSection(1, { title: "T", dos: [], donts: [] });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/aftercare");
    });
  });

  /* ---- deleteAftercareSection ---- */

  describe("deleteAftercareSection", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { deleteAftercareSection } = await import("./actions");
      await expect(deleteAftercareSection(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteAftercareSection } = await import("./actions");
      await deleteAftercareSection(3);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates dashboard paths", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteAftercareSection } = await import("./actions");
      await deleteAftercareSection(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/aftercare");
    });
  });

  /* ---- createPolicy ---- */

  describe("createPolicy", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { createPolicy } = await import("./actions");
      await expect(createPolicy({ title: "Test Policy", content: "Content" })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("inserts policy with slugified title", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createPolicy } = await import("./actions");
      await createPolicy({ title: "Booking & Deposits", content: "All deposits non-refundable." });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "studio_policy",
          slug: "booking-deposits-policy",
          title: "Booking & Deposits",
          content: "All deposits non-refundable.",
          sortOrder: 0,
        }),
      );
    });

    it("revalidates dashboard paths", async () => {
      vi.resetModules();
      setupMocks();
      const { createPolicy } = await import("./actions");
      await createPolicy({ title: "Test", content: "Content" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/aftercare");
    });
  });

  /* ---- updatePolicy ---- */

  describe("updatePolicy", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { updatePolicy } = await import("./actions");
      await expect(updatePolicy(1, { title: "T", content: "C" })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("calls db.update with correct fields", async () => {
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
      const { updatePolicy } = await import("./actions");
      await updatePolicy(5, { title: "Late Arrivals", content: "10 min grace period." });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Late Arrivals",
          slug: "late-arrivals-policy",
          content: "10 min grace period.",
        }),
      );
    });

    it("revalidates dashboard paths", async () => {
      vi.resetModules();
      setupMocks();
      const { updatePolicy } = await import("./actions");
      await updatePolicy(1, { title: "T", content: "C" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/aftercare");
    });
  });

  /* ---- deletePolicy ---- */

  describe("deletePolicy", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { deletePolicy } = await import("./actions");
      await expect(deletePolicy(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deletePolicy } = await import("./actions");
      await deletePolicy(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates dashboard paths", async () => {
      vi.resetModules();
      setupMocks();
      const { deletePolicy } = await import("./actions");
      await deletePolicy(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/aftercare");
    });
  });

  /* ---- seedAftercareDefaults ---- */

  describe("seedAftercareDefaults", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Not authenticated"));
      setupMocks();
      const { seedAftercareDefaults } = await import("./actions");
      await expect(seedAftercareDefaults()).rejects.toThrow("Not authenticated");
    });

    it("does not insert when existing rows found", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1 }])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { seedAftercareDefaults } = await import("./actions");
      await seedAftercareDefaults();
      expect(mockInsertValues).not.toHaveBeenCalled();
    });

    it("inserts defaults when no existing rows", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { seedAftercareDefaults } = await import("./actions");
      await seedAftercareDefaults();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: "aftercare" }),
          expect.objectContaining({ type: "studio_policy" }),
        ]),
      );
    });
  });
});
