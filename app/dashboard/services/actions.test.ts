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
    groupBy: () => chain,
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
// Captures PostHog analytics events so tests verify correct tracking without hitting the real API.
const mockTrackEvent = vi.fn();
// Captures audit log writes for verifying create/update/delete actions are tracked.
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();

// Registers vi.doMock() calls for all external dependencies (DB, auth, PostHog, audit, etc.)
// so the imported server actions run against fakes instead of real services.
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
    services: {
      id: "id",
      name: "name",
      category: "category",
      description: "description",
      durationMinutes: "durationMinutes",
      priceInCents: "priceInCents",
      depositInCents: "depositInCents",
      isActive: "isActive",
      sortOrder: "sortOrder",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      status: "status",
      startsAt: "startsAt",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => {
        const result = { type: "sql", args, as: vi.fn(() => ({ type: "sql_aliased", args })) };
        return result;
      }),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("services/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getServices ---- */

  describe("getServices", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getServices } = await import("./actions");
      await expect(getServices()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when there are no services", async () => {
      vi.resetModules();
      setupMocks();
      const { getServices } = await import("./actions");
      const result = await getServices();
      expect(result).toEqual([]);
    });

    it("returns services from db", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ id: 1, name: "Classic Full Set", category: "lash" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getServices } = await import("./actions");
      const result = await getServices();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: "Classic Full Set", category: "lash" });
    });
  });

  /* ---- createService ---- */

  describe("createService", () => {
    const input = {
      name: "Classic Full Set",
      category: "lash" as const,
      description: "A classic set",
      durationMinutes: 90,
      priceInCents: 12000,
      depositInCents: 0,
      isActive: true,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createService } = await import("./actions");
      await expect(createService(input)).rejects.toThrow("Not authenticated");
    });

    it("inserts service and returns row", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 1, name: "Classic Full Set", category: "lash" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createService } = await import("./actions");
      const result = await createService(input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Classic Full Set", category: "lash", isActive: true }),
      );
      expect(result).toMatchObject({ id: 1, name: "Classic Full Set" });
    });

    it("fires PostHog service_created event", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createService } = await import("./actions");
      await createService(input);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "service_created",
        expect.objectContaining({ name: "Classic Full Set", category: "lash" }),
      );
    });

    it("logs audit action", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 42 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createService } = await import("./actions");
      await createService(input);
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "create",
          entityType: "service",
          entityId: "42",
        }),
      );
    });

    it("revalidates /dashboard/services and /services", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createService } = await import("./actions");
      await createService(input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/services");
    });
  });

  /* ---- updateService ---- */

  describe("updateService", () => {
    const input = {
      name: "Updated Set",
      category: "lash" as const,
      description: "Updated",
      durationMinutes: 60,
      priceInCents: 10000,
      depositInCents: 0,
      isActive: true,
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateService } = await import("./actions");
      await expect(updateService(1, input)).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with updated fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: 1, name: "Updated Set" }]),
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
      const { updateService } = await import("./actions");
      await updateService(1, input);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Set", isActive: true }),
      );
    });

    it("fires PostHog service_updated event", async () => {
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
      const { updateService } = await import("./actions");
      await updateService(1, input);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "service_updated",
        expect.objectContaining({ serviceId: 1, name: "Updated Set" }),
      );
    });

    it("logs audit action", async () => {
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
      const { updateService } = await import("./actions");
      await updateService(1, input);
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "update",
          entityType: "service",
          entityId: "1",
        }),
      );
    });

    it("revalidates /dashboard/services and /services", async () => {
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
      const { updateService } = await import("./actions");
      await updateService(1, input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/services");
    });
  });

  /* ---- deleteService ---- */

  describe("deleteService", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteService } = await import("./actions");
      await expect(deleteService(1)).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete with the service id", async () => {
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
      const { deleteService } = await import("./actions");
      await deleteService(5);
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("fires PostHog service_deleted event", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteService } = await import("./actions");
      await deleteService(5);
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "service_deleted",
        expect.objectContaining({ serviceId: 5 }),
      );
    });

    it("logs audit action", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteService } = await import("./actions");
      await deleteService(5);
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "user-1",
          action: "delete",
          entityType: "service",
          entityId: "5",
        }),
      );
    });

    it("revalidates /dashboard/services and /services", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteService } = await import("./actions");
      await deleteService(1);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/services");
    });
  });

  /* ---- toggleServiceActive ---- */

  describe("toggleServiceActive", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleServiceActive } = await import("./actions");
      await expect(toggleServiceActive(1, false)).rejects.toThrow("Not authenticated");
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
      const { toggleServiceActive } = await import("./actions");
      await toggleServiceActive(3, false);
      expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
    });

    it("revalidates /dashboard/services and /services", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleServiceActive } = await import("./actions");
      await toggleServiceActive(1, true);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/services");
    });
  });

  /* ---- seedServiceCatalog ---- */

  describe("seedServiceCatalog", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { seedServiceCatalog } = await import("./actions");
      await expect(seedServiceCatalog()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when all catalog items already exist", async () => {
      vi.resetModules();
      // Return all catalog names as existing so nothing is inserted
      const existingNames = [
        "Classic Full Set",
        "Classic Lash Fill",
        "Hybrid Full Set",
        "Hybrid Fill",
        "Volume Full Set",
        "Volume Fill",
        "Mega Volume Set",
        "Mega Volume Fill",
        "Lash Removal",
        "Permanent Bracelet Weld",
        "Permanent Anklet Weld",
        "Permanent Necklace Weld",
        "Chain Sizing & Repair",
        "Mini Amigurumi (3–5 in)",
        "Standard Amigurumi (6–10 in)",
        "Large Amigurumi (11–16 in)",
        "Discovery Call",
        "HR Strategy Session",
        "Employee Handbook Build",
        "Business Launch Package",
        "Custom Phone Case",
        "3D-Printed Earrings",
        "Custom Décor Piece",
        "Beauty Tool Holder",
        "Signature Facial",
        "LED Light Therapy",
        "Chemical Peel",
        "Brow Lamination & Tint",
        "Lash Lift & Tint",
      ];
      setupMocks({
        select: vi.fn(() => makeChain(existingNames.map((name, i) => ({ id: i + 1, name })))),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { seedServiceCatalog } = await import("./actions");
      const result = await seedServiceCatalog();
      expect(result).toEqual([]);
    });

    it("deletes generic placeholder services and inserts catalog", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 10, name: "Classic Full Set" }]),
      }));
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            { id: 1, name: "Lash Extensions" },
            { id: 2, name: "Permanent Jewelry" },
          ]),
        ),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { seedServiceCatalog } = await import("./actions");
      await seedServiceCatalog();
      // Should have deleted generic entries
      expect(mockDeleteWhere).toHaveBeenCalled();
      // Should have inserted catalog items
      expect(mockInsertValues).toHaveBeenCalled();
    });

    it("revalidates /dashboard/services and /services", async () => {
      vi.resetModules();
      setupMocks();
      const { seedServiceCatalog } = await import("./actions");
      await seedServiceCatalog();
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/services");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/services");
    });
  });

  /* ---- getAssistantServices ---- */

  describe("getAssistantServices", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAssistantServices } = await import("./actions");
      await expect(getAssistantServices()).rejects.toThrow("Not authenticated");
    });

    it("returns empty services and zero stats when no services exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantServices } = await import("./actions");
      const result = await getAssistantServices();
      expect(result.services).toEqual([]);
      expect(result.stats).toMatchObject({
        totalServices: 0,
        certifiedCount: 0,
        avgDuration: 0,
      });
    });

    it("maps services to AssistantServiceRow shape", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 1,
                name: "Classic Full Set",
                category: "lash",
                description: "Classic lash set",
                durationMinutes: 90,
                priceInCents: 12000,
                depositInCents: null,
              },
            ]);
          }
          // Second select: completed bookings (empty — not certified)
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantServices } = await import("./actions");
      const result = await getAssistantServices();
      expect(result.services).toHaveLength(1);
      expect(result.services[0]).toMatchObject({
        id: 1,
        name: "Classic Full Set",
        category: "lash",
        price: 120,
        certified: false,
        timesPerformed: 0,
      });
    });

    it("marks service as certified when completed booking exists", async () => {
      vi.resetModules();
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) {
            return makeChain([
              {
                id: 1,
                name: "Classic Full Set",
                category: "lash",
                description: null,
                durationMinutes: 90,
                priceInCents: 12000,
                depositInCents: null,
              },
            ]);
          }
          return makeChain([
            {
              serviceId: 1,
              firstCompleted: new Date("2025-01-01"),
              timesPerformed: 5,
            },
          ]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantServices } = await import("./actions");
      const result = await getAssistantServices();
      expect(result.services[0].certified).toBe(true);
      expect(result.services[0].timesPerformed).toBe(5);
      expect(result.stats.certifiedCount).toBe(1);
    });
  });
});
