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
    serviceAddOns: {
      id: "id",
      serviceId: "serviceId",
      name: "name",
      description: "description",
      priceInCents: "priceInCents",
      additionalMinutes: "additionalMinutes",
      isActive: "isActive",
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

describe("addon-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getAddOns ---- */

  describe("getAddOns", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAddOns } = await import("./addon-actions");
      await expect(getAddOns(1)).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no add-ons exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getAddOns } = await import("./addon-actions");
      const result = await getAddOns(1);
      expect(result).toEqual([]);
    });

    it("returns add-ons for a service", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              serviceId: 5,
              name: "Extra Volume",
              priceInCents: 2000,
              additionalMinutes: 15,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAddOns } = await import("./addon-actions");
      const result = await getAddOns(5);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: "Extra Volume" });
    });
  });

  /* ---- createAddOn ---- */

  describe("createAddOn", () => {
    const input = {
      name: "Extra Volume",
      description: "Adds volume",
      priceInCents: 2000,
      additionalMinutes: 15,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createAddOn } = await import("./addon-actions");
      await expect(createAddOn(1, input)).rejects.toThrow("Not authenticated");
    });

    it("inserts add-on with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1, serviceId: 5, name: "Extra Volume" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAddOn } = await import("./addon-actions");
      const result = await createAddOn(5, input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceId: 5,
          name: "Extra Volume",
          priceInCents: 2000,
          additionalMinutes: 15,
          isActive: true,
        }),
      );
      expect(result).toMatchObject({ id: 1, name: "Extra Volume" });
    });

    it("fires PostHog addon_created event", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAddOn } = await import("./addon-actions");
      await createAddOn(5, input);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "addon_created",
        expect.objectContaining({ serviceId: 5, name: "Extra Volume" }),
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
      const { createAddOn } = await import("./addon-actions");
      await createAddOn(5, input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
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
      const { createAddOn } = await import("./addon-actions");
      await createAddOn(5, { ...input, description: "" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ description: null }));
    });
  });

  /* ---- updateAddOn ---- */

  describe("updateAddOn", () => {
    const input = {
      name: "Updated Volume",
      description: "Updated desc",
      priceInCents: 2500,
      additionalMinutes: 20,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateAddOn } = await import("./addon-actions");
      await expect(updateAddOn(1, input)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with updated fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 1, name: "Updated Volume" }]),
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
      const { updateAddOn } = await import("./addon-actions");
      await updateAddOn(1, input);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Volume", priceInCents: 2500 }),
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
      const { updateAddOn } = await import("./addon-actions");
      await updateAddOn(1, input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- deleteAddOn ---- */

  describe("deleteAddOn", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteAddOn } = await import("./addon-actions");
      await expect(deleteAddOn(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the add-on", async () => {
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
      const { deleteAddOn } = await import("./addon-actions");
      await deleteAddOn(7);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("fires PostHog addon_deleted event", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteAddOn } = await import("./addon-actions");
      await deleteAddOn(7);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "addon_deleted",
        expect.objectContaining({ addonId: 7 }),
      );
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteAddOn } = await import("./addon-actions");
      await deleteAddOn(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });

  /* ---- toggleAddOnActive ---- */

  describe("toggleAddOnActive", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleAddOnActive } = await import("./addon-actions");
      await expect(toggleAddOnActive(1, false)).rejects.toThrow("Not authenticated");
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
      const { toggleAddOnActive } = await import("./addon-actions");
      await toggleAddOnActive(3, false);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
    });

    it("revalidates /dashboard/services", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleAddOnActive } = await import("./addon-actions");
      await toggleAddOnActive(1, true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
    });
  });
});
