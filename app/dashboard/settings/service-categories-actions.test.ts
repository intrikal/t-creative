import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
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

const mockRequireAdmin = vi.fn();
const mockRevalidatePath = vi.fn();
const mockCaptureException = vi.fn();
const mockSelect = vi.fn(() => makeChain([]));
const mockInsertValues = vi.fn(() => ({
  onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  returning: vi.fn().mockResolvedValue([{ id: 1 }]),
}));
const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
const mockDeleteWhere = vi.fn();
const mockDelete = vi.fn(() => ({ where: mockDeleteWhere }));

function setupMocks() {
  vi.doMock("@/db", () => ({
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    },
  }));
  vi.doMock("@/db/schema", () => ({
    serviceCategories: {
      id: "id",
      name: "name",
      slug: "slug",
      displayOrder: "display_order",
      isActive: "is_active",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({}));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockRequireAdmin }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("service-categories-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue(undefined);
  });

  /* ---- getServiceCategories ---- */

  describe("getServiceCategories", () => {
    it("lists all categories ordered by displayOrder", async () => {
      vi.resetModules();
      const rows = [
        { id: 1, name: "Lash Extensions", slug: "lash", displayOrder: 1, isActive: true },
        { id: 2, name: "Jewelry", slug: "jewelry", displayOrder: 2, isActive: true },
      ];
      mockSelect.mockReturnValue(makeChain(rows));
      setupMocks();
      const { getServiceCategories } = await import("./service-categories-actions");

      const result = await getServiceCategories();

      expect(result).toEqual(rows);
      expect(mockRequireAdmin).toHaveBeenCalledOnce();
    });

    it("requires admin auth", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Unauthorized"));
      setupMocks();
      const { getServiceCategories } = await import("./service-categories-actions");

      await expect(getServiceCategories()).rejects.toThrow("Unauthorized");
    });
  });

  /* ---- saveServiceCategory ---- */

  describe("saveServiceCategory", () => {
    it("creates a new category with name, slug, displayOrder", async () => {
      vi.resetModules();
      setupMocks();
      const { saveServiceCategory } = await import("./service-categories-actions");

      await saveServiceCategory({
        name: "3D Printing",
        slug: "3d_printing",
        displayOrder: 5,
        isActive: true,
      });

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(mockInsertValues).toHaveBeenCalledWith({
        name: "3D Printing",
        slug: "3d_printing",
        displayOrder: 5,
        isActive: true,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("updates an existing category", async () => {
      vi.resetModules();
      setupMocks();
      const { saveServiceCategory } = await import("./service-categories-actions");

      await saveServiceCategory({
        id: 3,
        name: "Crochet Updated",
        slug: "crochet",
        displayOrder: 3,
        isActive: true,
      });

      expect(mockUpdate).toHaveBeenCalledOnce();
      expect(mockUpdateSet).toHaveBeenCalledWith({
        name: "Crochet Updated",
        slug: "crochet",
        displayOrder: 3,
        isActive: true,
      });
    });

    it("deactivates a category (soft delete via isActive: false)", async () => {
      vi.resetModules();
      setupMocks();
      const { saveServiceCategory } = await import("./service-categories-actions");

      await saveServiceCategory({
        id: 2,
        name: "Jewelry",
        slug: "jewelry",
        displayOrder: 2,
        isActive: false,
      });

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it("prevents duplicate slugs via Zod validation (invalid chars)", async () => {
      vi.resetModules();
      setupMocks();
      const { saveServiceCategory } = await import("./service-categories-actions");

      await expect(
        saveServiceCategory({
          name: "Test",
          slug: "INVALID SLUG!",
          displayOrder: 1,
          isActive: true,
        }),
      ).rejects.toThrow();
    });

    it("requires admin auth", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Unauthorized"));
      setupMocks();
      const { saveServiceCategory } = await import("./service-categories-actions");

      await expect(
        saveServiceCategory({
          name: "Test",
          slug: "test",
          displayOrder: 1,
          isActive: true,
        }),
      ).rejects.toThrow("Unauthorized");
    });
  });

  /* ---- deleteServiceCategory ---- */

  describe("deleteServiceCategory", () => {
    it("deletes a category by id", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteServiceCategory } = await import("./service-categories-actions");

      await deleteServiceCategory(1);

      expect(mockDelete).toHaveBeenCalledOnce();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("requires admin auth", async () => {
      vi.resetModules();
      mockRequireAdmin.mockRejectedValue(new Error("Unauthorized"));
      setupMocks();
      const { deleteServiceCategory } = await import("./service-categories-actions");

      await expect(deleteServiceCategory(1)).rejects.toThrow("Unauthorized");
    });

    it("rejects invalid id", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteServiceCategory } = await import("./service-categories-actions");

      await expect(deleteServiceCategory(-1)).rejects.toThrow();
      await expect(deleteServiceCategory(0)).rejects.toThrow();
    });
  });
});
