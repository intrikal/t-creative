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
    groupBy: () => chain,
    as: () => chain,
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
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "new-id" }]) })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      source: "source",
      isVip: "isVip",
      lifecycleStage: "lifecycleStage",
      internalNotes: "internalNotes",
      tags: "tags",
      role: "role",
      createdAt: "createdAt",
      referredBy: "referredBy",
      referralCode: "referralCode",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      staffId: "staffId",
      serviceId: "serviceId",
      startsAt: "startsAt",
      totalInCents: "totalInCents",
      status: "status",
    },
    services: { id: "id", name: "name", category: "category" },
    loyaltyTransactions: {
      id: "id",
      profileId: "profileId",
      points: "points",
      type: "type",
      description: "description",
      createdAt: "createdAt",
    },
    clientPreferences: {
      profileId: "profileId",
      preferredLashStyle: "preferredLashStyle",
      preferredCurlType: "preferredCurlType",
      preferredLengths: "preferredLengths",
      preferredDiameter: "preferredDiameter",
      naturalLashNotes: "naturalLashNotes",
      retentionProfile: "retentionProfile",
      allergies: "allergies",
      skinType: "skinType",
      adhesiveSensitivity: "adhesiveSensitivity",
      healthNotes: "healthNotes",
      birthday: "birthday",
      preferredContactMethod: "preferredContactMethod",
      preferredServiceTypes: "preferredServiceTypes",
      generalNotes: "generalNotes",
      preferredRebookIntervalDays: "preferredRebookIntervalDays",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => {
        const obj = { type: "sql", args, as: vi.fn(() => obj) };
        return obj;
      }),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
    sum: vi.fn((...args: unknown[]) => ({ type: "sum", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
      email: `${name}_email`,
      phone: `${name}_phone`,
      referredBy: `${name}_referredBy`,
      referralCount: `${name}_referralCount`,
      referrerId: `${name}_referrerId`,
    })),
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

describe("clients/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClients ---- */

  describe("getClients", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClients } = await import("./actions");
      await expect(getClients()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no clients found", async () => {
      vi.resetModules();
      setupMocks();
      const { getClients } = await import("./actions");
      const result = await getClients();
      expect(result).toEqual([]);
    });

    it("maps rows to ClientRow shape with numeric coercions", async () => {
      vi.resetModules();
      const row = {
        id: "c-1",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: null,
        source: "instagram",
        isVip: false,
        lifecycleStage: "active",
        internalNotes: null,
        tags: null,
        referredByName: null,
        referralCount: "3",
        createdAt: new Date("2026-01-01"),
        totalBookings: "5",
        totalSpent: "50000",
        lastVisit: null,
        loyaltyPoints: "200",
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "x" }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClients } = await import("./actions");
      const result = await getClients();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "c-1",
        firstName: "Jane",
        totalBookings: 5,
        totalSpent: 50000,
        loyaltyPoints: 200,
        referralCount: 3,
      });
    });

    it("defaults null numeric fields to 0", async () => {
      vi.resetModules();
      const row = {
        id: "c-1",
        firstName: "Jane",
        lastName: "Doe",
        email: "j@e.com",
        phone: null,
        source: null,
        isVip: false,
        lifecycleStage: null,
        internalNotes: null,
        tags: null,
        referredByName: null,
        referralCount: null,
        createdAt: new Date(),
        totalBookings: null,
        totalSpent: null,
        lastVisit: null,
        loyaltyPoints: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClients } = await import("./actions");
      const result = await getClients();
      expect(result[0].totalBookings).toBe(0);
      expect(result[0].totalSpent).toBe(0);
      expect(result[0].loyaltyPoints).toBe(0);
      expect(result[0].referralCount).toBe(0);
    });
  });

  /* ---- getClientLoyalty ---- */

  describe("getClientLoyalty", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientLoyalty } = await import("./actions");
      await expect(getClientLoyalty()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no rows", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientLoyalty } = await import("./actions");
      const result = await getClientLoyalty();
      expect(result).toEqual([]);
    });

    it("maps rows to LoyaltyRow shape", async () => {
      vi.resetModules();
      const row = {
        id: "c-1",
        firstName: "Jane",
        lastName: "Doe",
        points: "150",
        lastActivity: new Date("2026-02-01"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientLoyalty } = await import("./actions");
      const result = await getClientLoyalty();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "c-1", points: 150 });
    });
  });

  /* ---- createClient ---- */

  describe("createClient", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createClient } = await import("./actions");
      await expect(
        createClient({ firstName: "A", lastName: "B", email: "a@b.com", isVip: false }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts a client row with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createClient } = await import("./actions");
      await createClient({
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        isVip: true,
        source: "instagram",
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "client",
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          isVip: true,
          source: "instagram",
        }),
      );
    });

    it("fires PostHog client_created event", async () => {
      vi.resetModules();
      setupMocks();
      const { createClient } = await import("./actions");
      await createClient({ firstName: "A", lastName: "B", email: "a@b.com", isVip: false });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "client_created",
        expect.objectContaining({ isVip: false }),
      );
    });

    it("calls logAction with create", async () => {
      vi.resetModules();
      setupMocks();
      const { createClient } = await import("./actions");
      await createClient({ firstName: "A", lastName: "B", email: "a@b.com", isVip: false });
      expect(mockLogAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "client" }),
      );
    });

    it("revalidates /dashboard/clients", async () => {
      vi.resetModules();
      setupMocks();
      const { createClient } = await import("./actions");
      await createClient({ firstName: "A", lastName: "B", email: "a@b.com", isVip: false });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
    });
  });

  /* ---- updateClient ---- */

  describe("updateClient", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateClient } = await import("./actions");
      await expect(
        updateClient("c-1", { firstName: "A", lastName: "B", email: "a@b.com", isVip: false }),
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
      const { updateClient } = await import("./actions");
      await updateClient("c-1", {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        isVip: true,
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Jane", isVip: true }),
      );
    });

    it("fires PostHog client_updated event", async () => {
      vi.resetModules();
      setupMocks();
      const { updateClient } = await import("./actions");
      await updateClient("c-1", { firstName: "A", lastName: "B", email: "a@b.com", isVip: false });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "client_updated",
        expect.objectContaining({ clientId: "c-1" }),
      );
    });

    it("revalidates /dashboard/clients", async () => {
      vi.resetModules();
      setupMocks();
      const { updateClient } = await import("./actions");
      await updateClient("c-1", { firstName: "A", lastName: "B", email: "a@b.com", isVip: false });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
    });
  });

  /* ---- deleteClient ---- */

  describe("deleteClient", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteClient } = await import("./actions");
      await expect(deleteClient("c-1")).rejects.toThrow("Not authenticated");
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
      const { deleteClient } = await import("./actions");
      await deleteClient("c-1");
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("fires PostHog client_deleted event", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteClient } = await import("./actions");
      await deleteClient("c-1");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "client_deleted",
        expect.objectContaining({ clientId: "c-1" }),
      );
    });

    it("revalidates /dashboard/clients", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteClient } = await import("./actions");
      await deleteClient("c-1");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
    });
  });

  /* ---- issueLoyaltyReward ---- */

  describe("issueLoyaltyReward", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { issueLoyaltyReward } = await import("./actions");
      await expect(issueLoyaltyReward("p-1", 100, "Bonus")).rejects.toThrow("Not authenticated");
    });

    it("inserts loyalty transaction with correct fields", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "lt-1" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { issueLoyaltyReward } = await import("./actions");
      await issueLoyaltyReward("p-1", 200, "Holiday bonus");
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: "p-1",
          points: 200,
          type: "manual_credit",
          description: "Holiday bonus",
        }),
      );
    });

    it("fires PostHog loyalty_reward_issued event", async () => {
      vi.resetModules();
      setupMocks();
      const { issueLoyaltyReward } = await import("./actions");
      await issueLoyaltyReward("p-1", 50, "Referral bonus");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "loyalty_reward_issued",
        expect.objectContaining({ clientId: "p-1", points: 50 }),
      );
    });

    it("revalidates /dashboard/clients", async () => {
      vi.resetModules();
      setupMocks();
      const { issueLoyaltyReward } = await import("./actions");
      await issueLoyaltyReward("p-1", 10, "Test");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
    });
  });

  /* ---- getClientPreferences ---- */

  describe("getClientPreferences", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientPreferences } = await import("./actions");
      await expect(getClientPreferences("p-1")).rejects.toThrow("Not authenticated");
    });

    it("returns null when no preference row found", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientPreferences } = await import("./actions");
      const result = await getClientPreferences("p-1");
      expect(result).toBeNull();
    });

    it("returns preference row shape when found", async () => {
      vi.resetModules();
      const row = {
        profileId: "p-1",
        preferredLashStyle: "classic",
        preferredCurlType: "C",
        preferredLengths: "12mm",
        preferredDiameter: "0.10",
        naturalLashNotes: "Fine",
        retentionProfile: "good",
        allergies: null,
        skinType: "normal",
        adhesiveSensitivity: false,
        healthNotes: null,
        birthday: "1990-01-01",
        preferredContactMethod: "email",
        preferredServiceTypes: "lash",
        generalNotes: "VIP",
        preferredRebookIntervalDays: 21,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientPreferences } = await import("./actions");
      const result = await getClientPreferences("p-1");
      expect(result).not.toBeNull();
      expect(result!.profileId).toBe("p-1");
      expect(result!.preferredLashStyle).toBe("classic");
    });
  });

  /* ---- upsertClientPreferences ---- */

  describe("upsertClientPreferences", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { upsertClientPreferences } = await import("./actions");
      await expect(upsertClientPreferences({ profileId: "p-1" })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("calls db.insert with onConflictDoUpdate", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { upsertClientPreferences } = await import("./actions");
      await upsertClientPreferences({ profileId: "p-1", preferredLashStyle: "volume" });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: "p-1", preferredLashStyle: "volume" }),
      );
      expect(mockOnConflict).toHaveBeenCalled();
    });

    it("revalidates /dashboard/clients", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { upsertClientPreferences } = await import("./actions");
      await upsertClientPreferences({ profileId: "p-1" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/clients");
    });
  });

  /* ---- getAssistantClients ---- */

  describe("getAssistantClients", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAssistantClients } = await import("./actions");
      await expect(getAssistantClients()).rejects.toThrow("Not authenticated");
    });

    it("returns empty clients and zero stats when no bookings", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantClients } = await import("./actions");
      const result = await getAssistantClients();
      expect(result.clients).toEqual([]);
      expect(result.stats.totalClients).toBe(0);
      expect(result.stats.vipClients).toBe(0);
      expect(result.stats.totalRevenue).toBe(0);
    });

    it("groups bookings by client and computes stats", async () => {
      vi.resetModules();
      const rows = [
        {
          bookingId: 1,
          status: "completed",
          startsAt: new Date("2026-03-01T10:00:00Z"),
          totalInCents: 15000,
          clientId: "c-1",
          clientFirstName: "Jane",
          clientLastName: "Doe",
          clientEmail: "jane@example.com",
          clientPhone: null,
          clientIsVip: true,
          clientNotes: null,
          serviceName: "Lash Extensions",
          serviceCategory: "lash",
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(rows)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistantClients } = await import("./actions");
      const result = await getAssistantClients();
      expect(result.clients).toHaveLength(1);
      expect(result.clients[0].vip).toBe(true);
      expect(result.clients[0].totalVisits).toBe(1);
      expect(result.clients[0].totalSpent).toBe(150);
      expect(result.stats.vipClients).toBe(1);
    });
  });
});
