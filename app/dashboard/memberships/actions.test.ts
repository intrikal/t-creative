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
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    membershipPlans: {
      id: "id",
      name: "name",
      slug: "slug",
      description: "description",
      priceInCents: "priceInCents",
      fillsPerCycle: "fillsPerCycle",
      productDiscountPercent: "productDiscountPercent",
      cycleIntervalDays: "cycleIntervalDays",
      isActive: "isActive",
      displayOrder: "displayOrder",
      perks: "perks",
    },
    membershipSubscriptions: {
      id: "id",
      clientId: "clientId",
      planId: "planId",
      status: "status",
      fillsRemainingThisCycle: "fillsRemainingThisCycle",
      cycleStartAt: "cycleStartAt",
      cycleEndsAt: "cycleEndsAt",
      cancelledAt: "cancelledAt",
      pausedAt: "pausedAt",
      notes: "notes",
      createdAt: "createdAt",
    },
    membershipStatusEnum: {
      enumValues: ["active", "paused", "cancelled", "expired"],
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
  }));
  vi.doMock("date-fns", () => ({
    addDays: vi.fn((date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("memberships/actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getMembershipPlans ---- */

  describe("getMembershipPlans", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getMembershipPlans } = await import("./actions");
      await expect(getMembershipPlans()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no plans exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getMembershipPlans } = await import("./actions");
      const result = await getMembershipPlans();
      expect(result).toEqual([]);
    });

    it("maps plan rows with perks defaulting to []", async () => {
      vi.resetModules();
      const planRow = {
        id: 1,
        name: "Gold Plan",
        slug: "gold",
        description: "Best plan",
        priceInCents: 9900,
        fillsPerCycle: 2,
        productDiscountPercent: 10,
        cycleIntervalDays: 30,
        isActive: true,
        displayOrder: 1,
        perks: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([planRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMembershipPlans } = await import("./actions");
      const result = await getMembershipPlans();
      expect(result).toHaveLength(1);
      expect(result[0].perks).toEqual([]);
      expect(result[0].name).toBe("Gold Plan");
    });

    it("includes inactive plans when includeInactive is true", async () => {
      vi.resetModules();
      const plans = [
        {
          id: 1,
          name: "Active",
          slug: "active",
          description: null,
          priceInCents: 5000,
          fillsPerCycle: 1,
          productDiscountPercent: 5,
          cycleIntervalDays: 30,
          isActive: true,
          displayOrder: 0,
          perks: [],
        },
        {
          id: 2,
          name: "Inactive",
          slug: "inactive",
          description: null,
          priceInCents: 3000,
          fillsPerCycle: 1,
          productDiscountPercent: 0,
          cycleIntervalDays: 30,
          isActive: false,
          displayOrder: 1,
          perks: [],
        },
      ];
      setupMocks({
        select: vi.fn(() => makeChain(plans)),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMembershipPlans } = await import("./actions");
      const result = await getMembershipPlans(true);
      expect(result).toHaveLength(2);
    });
  });

  /* ---- getMemberships ---- */

  describe("getMemberships", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getMemberships } = await import("./actions");
      await expect(getMemberships()).rejects.toThrow("Not authenticated");
    });

    it("returns empty array when no subscriptions exist", async () => {
      vi.resetModules();
      setupMocks();
      const { getMemberships } = await import("./actions");
      const result = await getMemberships();
      expect(result).toEqual([]);
    });

    it("maps subscription rows to MembershipRow shape", async () => {
      vi.resetModules();
      const row = {
        id: "sub-abc",
        clientId: "client-1",
        clientFirstName: "Jane",
        clientLastName: "Doe",
        clientEmail: "jane@test.com",
        planId: 1,
        planName: "Gold",
        planSlug: "gold",
        priceInCents: 9900,
        fillsPerCycle: 2,
        productDiscountPercent: 10,
        fillsRemainingThisCycle: 1,
        status: "active",
        cycleStartAt: new Date("2026-03-01"),
        cycleEndsAt: new Date("2026-03-31"),
        cancelledAt: null,
        pausedAt: null,
        notes: "VIP client",
        createdAt: new Date("2026-02-01"),
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getMemberships } = await import("./actions");
      const result = await getMemberships();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: "sub-abc",
        clientName: "Jane Doe",
        clientEmail: "jane@test.com",
        planName: "Gold",
        status: "active",
      });
    });
  });

  /* ---- getClientMembership ---- */

  describe("getClientMembership", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientMembership } = await import("./actions");
      await expect(getClientMembership("client-1")).rejects.toThrow("Not authenticated");
    });

    it("returns null when client has no membership", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientMembership } = await import("./actions");
      const result = await getClientMembership("client-1");
      expect(result).toBeNull();
    });

    it("returns ClientMembership shape when membership exists", async () => {
      vi.resetModules();
      const row = {
        id: "sub-xyz",
        planName: "Silver",
        planSlug: "silver",
        priceInCents: 5900,
        fillsPerCycle: 1,
        fillsRemainingThisCycle: 1,
        productDiscountPercent: 5,
        cycleEndsAt: new Date("2026-04-01"),
        status: "active",
        perks: ["Discount", "Priority booking"],
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientMembership } = await import("./actions");
      const result = await getClientMembership("client-1");
      expect(result).not.toBeNull();
      expect(result?.planName).toBe("Silver");
      expect(result?.perks).toEqual(["Discount", "Priority booking"]);
    });

    it("defaults perks to [] when null", async () => {
      vi.resetModules();
      const row = {
        id: "sub-xyz",
        planName: "Silver",
        planSlug: "silver",
        priceInCents: 5900,
        fillsPerCycle: 1,
        fillsRemainingThisCycle: 1,
        productDiscountPercent: 5,
        cycleEndsAt: new Date("2026-04-01"),
        status: "active",
        perks: null,
      };
      setupMocks({
        select: vi.fn(() => makeChain([row])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientMembership } = await import("./actions");
      const result = await getClientMembership("client-1");
      expect(result?.perks).toEqual([]);
    });
  });

  /* ---- createMembership ---- */

  describe("createMembership", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createMembership } = await import("./actions");
      await expect(createMembership({ clientId: "c1", planId: 1 })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("throws when plan is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createMembership } = await import("./actions");
      await expect(createMembership({ clientId: "c1", planId: 999 })).rejects.toThrow(
        "Plan not found",
      );
    });

    it("inserts subscription with active status and returns id", async () => {
      vi.resetModules();
      const plan = {
        id: 1,
        name: "Gold",
        slug: "gold",
        description: null,
        priceInCents: 9900,
        fillsPerCycle: 2,
        productDiscountPercent: 10,
        cycleIntervalDays: 30,
        isActive: true,
        displayOrder: 0,
        perks: [],
      };
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-sub-1" }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([plan])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createMembership } = await import("./actions");
      const result = await createMembership({ clientId: "client-1", planId: 1 });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "client-1",
          planId: 1,
          status: "active",
          fillsRemainingThisCycle: 2,
        }),
      );
      expect(result).toEqual({ id: "new-sub-1" });
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      const plan = { id: 1, fillsPerCycle: 1, cycleIntervalDays: 30 };
      setupMocks({
        select: vi.fn(() => makeChain([plan])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createMembership } = await import("./actions");
      await createMembership({ clientId: "c1", planId: 1 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });

  /* ---- updateMembershipStatus ---- */

  describe("updateMembershipStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateMembershipStatus } = await import("./actions");
      await expect(updateMembershipStatus("sub-1", "active")).rejects.toThrow("Not authenticated");
    });

    it("sets cancelledAt when status is cancelled", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateMembershipStatus } = await import("./actions");
      await updateMembershipStatus("sub-1", "cancelled");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled", cancelledAt: expect.any(Date) }),
      );
    });

    it("sets pausedAt when status is paused", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateMembershipStatus } = await import("./actions");
      await updateMembershipStatus("sub-1", "paused");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "paused", pausedAt: expect.any(Date) }),
      );
    });

    it("clears pausedAt when reactivating to active", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "sub-1" }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { updateMembershipStatus } = await import("./actions");
      await updateMembershipStatus("sub-1", "active");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", pausedAt: null }),
      );
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      setupMocks();
      const { updateMembershipStatus } = await import("./actions");
      await updateMembershipStatus("sub-1", "active");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });

  /* ---- useMembershipFill ---- */

  describe("useMembershipFill", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { useMembershipFill } = await import("./actions");
      await expect(useMembershipFill("sub-1")).rejects.toThrow("Not authenticated");
    });

    it("throws when membership is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { useMembershipFill } = await import("./actions");
      await expect(useMembershipFill("nonexistent")).rejects.toThrow("Membership not found");
    });

    it("throws when no fills remaining", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ fillsRemainingThisCycle: 0 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { useMembershipFill } = await import("./actions");
      await expect(useMembershipFill("sub-1")).rejects.toThrow("No fills remaining this cycle");
    });

    it("decrements fills remaining by 1", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ fillsRemainingThisCycle: 2 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { useMembershipFill } = await import("./actions");
      await useMembershipFill("sub-1");
      expect(mockUpdateSet).toHaveBeenCalledWith({ fillsRemainingThisCycle: 1 });
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ fillsRemainingThisCycle: 1 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { useMembershipFill } = await import("./actions");
      await useMembershipFill("sub-1");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });

  /* ---- renewMembership ---- */

  describe("renewMembership", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { renewMembership } = await import("./actions");
      await expect(renewMembership("sub-1")).rejects.toThrow("Not authenticated");
    });

    it("throws when membership is not found", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { renewMembership } = await import("./actions");
      await expect(renewMembership("sub-999")).rejects.toThrow("Membership not found");
    });

    it("resets fills and advances cycle dates", async () => {
      vi.resetModules();
      const cycleEndsAt = new Date("2026-03-31");
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ cycleEndsAt, fillsPerCycle: 2, cycleIntervalDays: 30 }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { renewMembership } = await import("./actions");
      await renewMembership("sub-1");
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          fillsRemainingThisCycle: 2,
          cycleStartAt: cycleEndsAt,
          pausedAt: null,
        }),
      );
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([{ cycleEndsAt: new Date(), fillsPerCycle: 1, cycleIntervalDays: 30 }]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { renewMembership } = await import("./actions");
      await renewMembership("sub-1");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });

  /* ---- updateMembershipNotes ---- */

  describe("updateMembershipNotes", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateMembershipNotes } = await import("./actions");
      await expect(updateMembershipNotes("sub-1", "Note")).rejects.toThrow("Not authenticated");
    });

    it("updates notes field", async () => {
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
      const { updateMembershipNotes } = await import("./actions");
      await updateMembershipNotes("sub-1", "Important note");
      expect(mockUpdateSet).toHaveBeenCalledWith({ notes: "Important note" });
    });

    it("sets notes to null when empty string is passed", async () => {
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
      const { updateMembershipNotes } = await import("./actions");
      await updateMembershipNotes("sub-1", "");
      expect(mockUpdateSet).toHaveBeenCalledWith({ notes: null });
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      setupMocks();
      const { updateMembershipNotes } = await import("./actions");
      await updateMembershipNotes("sub-1", "Note");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });

  /* ---- createMembershipPlan ---- */

  describe("createMembershipPlan", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { createMembershipPlan } = await import("./actions");
      await expect(
        createMembershipPlan({
          name: "Plan",
          slug: "plan",
          priceInCents: 9900,
          fillsPerCycle: 1,
          productDiscountPercent: 5,
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts plan with defaults and returns id", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createMembershipPlan } = await import("./actions");
      const result = await createMembershipPlan({
        name: "Gold",
        slug: "gold",
        priceInCents: 9900,
        fillsPerCycle: 2,
        productDiscountPercent: 10,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Gold",
          slug: "gold",
          priceInCents: 9900,
          cycleIntervalDays: 30, // default
          displayOrder: 0, // default
          perks: [], // default
        }),
      );
      expect(result).toEqual({ id: 42 });
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { createMembershipPlan } = await import("./actions");
      await createMembershipPlan({
        name: "Plan",
        slug: "plan",
        priceInCents: 9900,
        fillsPerCycle: 1,
        productDiscountPercent: 5,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });

  /* ---- updateMembershipPlan ---- */

  describe("updateMembershipPlan", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { updateMembershipPlan } = await import("./actions");
      await expect(updateMembershipPlan(1, { name: "New Name" })).rejects.toThrow(
        "Not authenticated",
      );
    });

    it("calls db.update with provided fields only", async () => {
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
      const { updateMembershipPlan } = await import("./actions");
      await updateMembershipPlan(1, { name: "Updated Gold", priceInCents: 10900 });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Updated Gold", priceInCents: 10900 }),
      );
    });

    it("can toggle isActive flag", async () => {
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
      const { updateMembershipPlan } = await import("./actions");
      await updateMembershipPlan(1, { isActive: false });
      expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });

    it("revalidates /dashboard/memberships", async () => {
      vi.resetModules();
      setupMocks();
      const { updateMembershipPlan } = await import("./actions");
      await updateMembershipPlan(1, { name: "New Name" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/bookings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/memberships");
    });
  });
});
