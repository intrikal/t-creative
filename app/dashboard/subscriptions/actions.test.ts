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
    bookingSubscriptions: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      name: "name",
      totalSessions: "totalSessions",
      sessionsUsed: "sessionsUsed",
      intervalDays: "intervalDays",
      pricePerSessionInCents: "pricePerSessionInCents",
      totalPaidInCents: "totalPaidInCents",
      status: "status",
      notes: "notes",
      createdAt: "createdAt",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
    services: {
      id: "id",
      name: "name",
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
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("subscriptions/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getSubscriptions ---- */

  describe("getSubscriptions", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getSubscriptions } = await import("./actions");
      await expect(getSubscriptions()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no subscriptions exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getSubscriptions } = await import("./actions");
      const result = await getSubscriptions();
      expect(result).toEqual([]);
    });

    it("maps rows to SubscriptionRow shape", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              clientId: "client-1",
              clientFirstName: "Jane",
              clientLastName: "Doe",
              clientEmail: "jane@example.com",
              serviceId: 2,
              serviceName: "Classic Full Set",
              name: "Monthly Lash Plan",
              totalSessions: 6,
              sessionsUsed: 2,
              intervalDays: 30,
              pricePerSessionInCents: 12000,
              totalPaidInCents: 72000,
              status: "active",
              notes: null,
              createdAt: new Date("2026-01-01"),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getSubscriptions } = await import("./actions");
      const result = await getSubscriptions();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        clientId: "client-1",
        clientName: "Jane Doe",
        clientEmail: "jane@example.com",
        serviceName: "Classic Full Set",
        name: "Monthly Lash Plan",
        totalSessions: 6,
        sessionsUsed: 2,
        sessionsRemaining: 4,
        status: "active",
      });
    });

    it("handles null lastName in clientName concatenation", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 1,
              clientId: "client-1",
              clientFirstName: "Jane",
              clientLastName: null,
              clientEmail: "jane@example.com",
              serviceId: 2,
              serviceName: "Classic Full Set",
              name: "Plan",
              totalSessions: 4,
              sessionsUsed: 1,
              intervalDays: 14,
              pricePerSessionInCents: 8000,
              totalPaidInCents: 32000,
              status: "active",
              notes: null,
              createdAt: new Date(),
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getSubscriptions } = await import("./actions");
      const result = await getSubscriptions();
      expect(result[0].clientName).toBe("Jane");
    });

    it("accepts optional statusFilter argument", async () => {
      vi.resetModules();
      setupMocks();
      const { getSubscriptions } = await import("./actions");
      // Should not throw when filter is provided
      const result = await getSubscriptions("active");
      expect(result).toEqual([]);
    });
  });

  /* ---- getActiveSubscriptionsForClient ---- */

  describe("getActiveSubscriptionsForClient", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getActiveSubscriptionsForClient } = await import("./actions");
      await expect(getActiveSubscriptionsForClient("client-1")).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("returns empty array when client has no subscriptions", async () => {
      vi.resetModules();
      setupMocks();
      const { getActiveSubscriptionsForClient } = await import("./actions");
      const result = await getActiveSubscriptionsForClient("client-1");
      expect(result).toEqual([]);
    });

    it("filters out subscriptions with no sessions remaining", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            { id: 1, name: "Plan A", totalSessions: 4, sessionsUsed: 4 }, // exhausted
            { id: 2, name: "Plan B", totalSessions: 6, sessionsUsed: 2 }, // active
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getActiveSubscriptionsForClient } = await import("./actions");
      const result = await getActiveSubscriptionsForClient("client-1");
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 2, name: "Plan B", sessionsRemaining: 4 });
    });

    it("returns correct sessionsRemaining for active subscriptions", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ id: 1, name: "Plan A", totalSessions: 10, sessionsUsed: 3 }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getActiveSubscriptionsForClient } = await import("./actions");
      const result = await getActiveSubscriptionsForClient("client-1");
      expect(result[0].sessionsRemaining).toBe(7);
    });
  });

  /* ---- createSubscription ---- */

  describe("createSubscription", () => {
    const input = {
      clientId: "client-1",
      serviceId: 2,
      name: "Monthly Lash Plan",
      totalSessions: 6,
      intervalDays: 30,
      pricePerSessionInCents: 12000,
      totalPaidInCents: 72000,
      notes: "Preferred morning slots",
    };

    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createSubscription } = await import("./actions");
      await expect(createSubscription(input)).rejects.toThrow("Not authenticated");
    });

    it("inserts subscription with sessionsUsed initialized to 0", async () => {
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
      const { createSubscription } = await import("./actions");
      await createSubscription(input);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          serviceId: 2,
          name: "Monthly Lash Plan",
          totalSessions: 6,
          sessionsUsed: 0,
          intervalDays: 30,
        }),
      );
    });

    it("returns the inserted subscription id", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 42 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSubscription } = await import("./actions");
      const result = await createSubscription(input);
      expect(result).toEqual({ id: 42 });
    });

    it("stores null notes when notes is not provided", async () => {
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
      const { createSubscription } = await import("./actions");
      const { notes: _notes, ...inputWithoutNotes } = input;
      await createSubscription(inputWithoutNotes);
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
    });

    it("revalidates /dashboard/subscriptions", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createSubscription } = await import("./actions");
      await createSubscription(input);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/subscriptions");
    });
  });

  /* ---- updateSubscriptionStatus ---- */

  describe("updateSubscriptionStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateSubscriptionStatus } = await import("./actions");
      await expect(updateSubscriptionStatus(1, "paused")).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with the new status", async () => {
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
      const { updateSubscriptionStatus } = await import("./actions");
      await updateSubscriptionStatus(5, "paused");
      expect(mockUpdateSet).toHaveBeenCalledWith({ status: "paused" });
    });

    it("accepts all valid status values", async () => {
      const statuses = ["active", "paused", "completed", "cancelled"] as const;
      for (const status of statuses) {
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
        const { updateSubscriptionStatus } = await import("./actions");
        await updateSubscriptionStatus(1, status);
        expect(mockUpdateSet).toHaveBeenCalledWith({ status });
      }
    });

    it("revalidates /dashboard/subscriptions", async () => {
      vi.resetModules();
      setupMocks();
      const { updateSubscriptionStatus } = await import("./actions");
      await updateSubscriptionStatus(1, "completed");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/subscriptions");
    });
  });

  /* ---- updateSubscriptionNotes ---- */

  describe("updateSubscriptionNotes", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateSubscriptionNotes } = await import("./actions");
      await expect(updateSubscriptionNotes(1, "new notes")).rejects.toThrow("Not authenticated");
    });

    it("calls db.update with notes value", async () => {
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
      const { updateSubscriptionNotes } = await import("./actions");
      await updateSubscriptionNotes(5, "New notes for this plan");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "New notes for this plan" }),
      );
    });

    it("stores null when empty string is provided", async () => {
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
      const { updateSubscriptionNotes } = await import("./actions");
      await updateSubscriptionNotes(5, "");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ notes: null }));
    });

    it("revalidates /dashboard/subscriptions", async () => {
      vi.resetModules();
      setupMocks();
      const { updateSubscriptionNotes } = await import("./actions");
      await updateSubscriptionNotes(1, "some notes");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/subscriptions");
    });
  });
});
