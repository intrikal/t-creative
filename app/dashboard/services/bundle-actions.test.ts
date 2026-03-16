import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

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

const mockGetUser = vi.fn();
const mockTrackEvent = vi.fn();
const mockRevalidatePath = vi.fn();

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
    serviceBundles: {
      id: "id",
      name: "name",
      description: "description",
      serviceNames: "serviceNames",
      originalPriceInCents: "originalPriceInCents",
      bundlePriceInCents: "bundlePriceInCents",
      isActive: "isActive",
      createdAt: "createdAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("bundle-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getBundles ---- */

  describe("getBundles", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getBundles } = await import("./bundle-actions");
      await expect(getBundles()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no bundles exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getBundles } = await import("./bundle-actions");
      const result = await getBundles();
      expect(result).toEqual([]);
    });

    it("returns bundles from db", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              name: "Lash Bundle",
              serviceNames: ["Classic Full Set", "Volume Full Set"],
              bundlePriceInCents: 25000,
              isActive: true,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBundles } = await import("./bundle-actions");
      const result = await getBundles();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: "Lash Bundle" });
    });
  });

  /* ---- createBundle ---- */

  describe("createBundle", () => {
    const input = {
      name: "Lash Bundle",
      description: "A great lash bundle",
      serviceNames: ["Classic Full Set", "Volume Full Set"],
      originalPriceInCents: 28500,
      bundlePriceInCents: 25000,
      isActive: true,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createBundle } = await import("./bundle-actions");
      await expect(createBundle(input)).rejects.toThrow("Not authenticated");
    });

    it("inserts bundle with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1, name: "Lash Bundle" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBundle } = await import("./bundle-actions");
      const result = await createBundle(input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Lash Bundle",
          serviceNames: ["Classic Full Set", "Volume Full Set"],
          bundlePriceInCents: 25000,
          isActive: true,
        }),
      );
      expect(result).toMatchObject({ id: 1, name: "Lash Bundle" });
    });

    it("stores null description when empty string is provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBundle } = await import("./bundle-actions");
      await createBundle({ ...input, description: "" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });

    it("fires PostHog bundle_created event", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBundle } = await import("./bundle-actions");
      await createBundle(input);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "bundle_created",
        expect.objectContaining({ name: "Lash Bundle" }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createBundle } = await import("./bundle-actions");
      await createBundle(input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- updateBundle ---- */

  describe("updateBundle", () => {
    const input = {
      name: "Updated Bundle",
      description: "Updated",
      serviceNames: ["Classic Full Set"],
      originalPriceInCents: 12000,
      bundlePriceInCents: 10000,
      isActive: false,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateBundle } = await import("./bundle-actions");
      await expect(updateBundle(1, input)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with updated fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 1, name: "Updated Bundle" }]),
        })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateBundle } = await import("./bundle-actions");
      await updateBundle(1, input);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Bundle", isActive: false }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({
            where: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            })),
          })),
        })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateBundle } = await import("./bundle-actions");
      await updateBundle(1, input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- deleteBundle ---- */

  describe("deleteBundle", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteBundle } = await import("./bundle-actions");
      await expect(deleteBundle(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the bundle", async () => {
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
      const { deleteBundle } = await import("./bundle-actions");
      await deleteBundle(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("fires PostHog bundle_deleted event", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteBundle } = await import("./bundle-actions");
      await deleteBundle(7);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "bundle_deleted",
        expect.objectContaining({ bundleId: 7 }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteBundle } = await import("./bundle-actions");
      await deleteBundle(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- toggleBundleActive ---- */

  describe("toggleBundleActive", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleBundleActive } = await import("./bundle-actions");
      await expect(toggleBundleActive(1, false)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with isActive value", async () => {
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
      const { toggleBundleActive } = await import("./bundle-actions");
      await toggleBundleActive(3, false);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleBundleActive } = await import("./bundle-actions");
      await toggleBundleActive(1, true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });
});
