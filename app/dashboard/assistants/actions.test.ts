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
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      role: "role",
      isActive: "isActive",
    },
    assistantProfiles: {
      profileId: "profileId",
      title: "title",
      specialties: "specialties",
      bio: "bio",
      averageRating: "averageRating",
      isAvailable: "isAvailable",
      startDate: "startDate",
      commissionType: "commissionType",
      commissionRatePercent: "commissionRatePercent",
      commissionFlatFeeInCents: "commissionFlatFeeInCents",
      tipSplitPercent: "tipSplitPercent",
    },
    businessHours: {
      staffId: "staffId",
      dayOfWeek: "dayOfWeek",
      isOpen: "isOpen",
      opensAt: "opensAt",
      closesAt: "closesAt",
    },
    bookings: {
      id: "id",
      staffId: "staffId",
      totalInCents: "totalInCents",
      startsAt: "startsAt",
      status: "status",
    },
    payments: {
      id: "id",
      bookingId: "bookingId",
      tipInCents: "tipInCents",
    },
    services: {
      id: "id",
      name: "name",
    },
  }));
  const sqlTag = vi.fn((...args: unknown[]) => {
    const result: any = { type: "sql", args };
    result.as = vi.fn(() => result);
    return result;
  });
  (sqlTag as any).join = vi.fn(() => ({ type: "sql_join" }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    ne: vi.fn((...args: unknown[]) => ({ type: "ne", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    sql: sqlTag,
    gte: vi.fn((...args: unknown[]) => ({ type: "gte", args })),
    lte: vi.fn((...args: unknown[]) => ({ type: "lte", args })),
    lt: vi.fn((...args: unknown[]) => ({ type: "lt", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({
      aliasName: name,
      id: `${name}_id`,
      firstName: `${name}_first`,
      lastName: `${name}_last`,
    })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("assistants/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getAssistants ---- */

  describe("getAssistants", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAssistants } = await import("./actions");
      await expect(getAssistants()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no assistants exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistants } = await import("./actions");
      const result = await getAssistants();
      expect(result).toEqual([]);
    });

    it("maps rows with fallback values for null fields", async () => {
      vi.resetModules();
      const row = {
        id: "asst-1",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: null,
        isActive: true,
        title: null,
        specialties: null,
        bio: null,
        averageRating: null,
        isAvailable: null, // tests fallback to true
        startDate: null,
        commissionType: null, // tests fallback to "percentage"
        commissionRatePercent: null,
        commissionFlatFeeInCents: null,
        tipSplitPercent: null, // tests fallback to 100
        totalSessions: null, // tests fallback to 0
        totalRevenue: null, // tests fallback to 0
        thisMonthSessions: null, // tests fallback to 0
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getAssistants } = await import("./actions");
      const result = await getAssistants();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "asst-1",
        isAvailable: true,
        commissionType: "percentage",
        tipSplitPercent: 100,
        totalSessions: 0,
        totalRevenue: 0,
        thisMonthSessions: 0,
      });
    });
  });

  /* ---- createAssistant ---- */

  describe("createAssistant", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createAssistant } = await import("./actions");
      await expect(
        createAssistant({ firstName: "A", lastName: "B", email: "a@b.com" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts into profiles and assistantProfiles", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
      }));
      const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAssistant } = await import("./actions");
      await createAssistant({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" });
      // Should be called twice: once for profiles, once for assistantProfiles
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it("inserts profile with role=assistant", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn((_: Record<string, unknown>) => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAssistant } = await import("./actions");
      await createAssistant({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" });
      const firstCallArg = mockInsertValues.mock.calls[0][0];
      expect(firstCallArg).toMatchObject({
        role: "assistant",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      });
    });

    it("revalidates /dashboard/team", async () => {
      vi.resetModules();
      setupMocks();
      const { createAssistant } = await import("./actions");
      await createAssistant({ firstName: "A", lastName: "B", email: "a@b.com" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });

    it("uses default commissionType=percentage when not provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn((_: Record<string, unknown>) => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createAssistant } = await import("./actions");
      await createAssistant({ firstName: "A", lastName: "B", email: "a@b.com" });
      // Second call is for assistantProfiles
      const secondCallArg = mockInsertValues.mock.calls[1][0];
      expect(secondCallArg).toMatchObject({ commissionType: "percentage", tipSplitPercent: 100 });
    });
  });

  /* ---- updateAssistant ---- */

  describe("updateAssistant", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateAssistant } = await import("./actions");
      await expect(
        updateAssistant("asst-1", { firstName: "A", lastName: "B", email: "a@b.com" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("updates profiles table with new fields", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ profileId: "asst-1" }])), // existing assistant profile
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateAssistant } = await import("./actions");
      await updateAssistant("asst-1", {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Jane", lastName: "Doe", email: "jane@example.com" }),
      );
    });

    it("updates assistantProfiles when existing record is found", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ profileId: "asst-1" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateAssistant } = await import("./actions");
      await updateAssistant("asst-1", {
        firstName: "A",
        lastName: "B",
        email: "a@b.com",
        title: "Lead",
      });
      // Called twice: profiles update + assistantProfiles update
      expect(mockUpdateSet).toHaveBeenCalledTimes(2);
    });

    it("inserts assistantProfiles when no existing record is found", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])), // no existing profile
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateAssistant } = await import("./actions");
      await updateAssistant("asst-1", { firstName: "A", lastName: "B", email: "a@b.com" });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: "asst-1" }),
      );
    });

    it("revalidates /dashboard/team", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ profileId: "asst-1" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateAssistant } = await import("./actions");
      await updateAssistant("asst-1", { firstName: "A", lastName: "B", email: "a@b.com" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- toggleAssistantStatus ---- */

  describe("toggleAssistantStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { toggleAssistantStatus } = await import("./actions");
      await expect(toggleAssistantStatus("asst-1", "inactive")).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("sets isActive=false and isAvailable=false when status is inactive", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleAssistantStatus } = await import("./actions");
      await toggleAssistantStatus("asst-1", "inactive");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isAvailable: false }));
    });

    it("sets isActive=true and isAvailable=false when status is on_leave", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleAssistantStatus } = await import("./actions");
      await toggleAssistantStatus("asst-1", "on_leave");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isAvailable: false }));
    });

    it("sets isActive=true and isAvailable=true when status is active", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { toggleAssistantStatus } = await import("./actions");
      await toggleAssistantStatus("asst-1", "active");
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isActive: true }));
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isAvailable: true }));
    });

    it("revalidates /dashboard/team", async () => {
      vi.resetModules();
      setupMocks();
      const { toggleAssistantStatus } = await import("./actions");
      await toggleAssistantStatus("asst-1", "active");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- deleteAssistant ---- */

  describe("deleteAssistant", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteAssistant } = await import("./actions");
      await expect(deleteAssistant("asst-1")).rejects.toThrow("Not authenticated");
    });

    it("calls db.delete for the profile", async () => {
      vi.resetModules();
      const mockDeleteWhere = vi.fn();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: mockDeleteWhere })),
      });
      const { deleteAssistant } = await import("./actions");
      await deleteAssistant("asst-1");
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it("revalidates /dashboard/team", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteAssistant } = await import("./actions");
      await deleteAssistant("asst-1");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });

  /* ---- updateCommissionRate ---- */

  describe("updateCommissionRate", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateCommissionRate } = await import("./actions");
      await expect(updateCommissionRate("asst-1", 70)).rejects.toThrow("Not authenticated");
    });

    it("updates commissionRatePercent when existing record found", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ profileId: "asst-1" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateCommissionRate } = await import("./actions");
      await updateCommissionRate("asst-1", 75);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ commissionRatePercent: 75 }),
      );
    });

    it("inserts new assistantProfile when no existing record found", async () => {
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
      const { updateCommissionRate } = await import("./actions");
      await updateCommissionRate("asst-1", 80);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: "asst-1", commissionRatePercent: 80 }),
      );
    });

    it("revalidates /dashboard/team", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ profileId: "asst-1" }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateCommissionRate } = await import("./actions");
      await updateCommissionRate("asst-1", 60);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/team");
    });
  });
});
