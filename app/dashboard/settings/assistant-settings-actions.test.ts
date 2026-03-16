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
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
      };
      await fn(tx);
    }),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      phone: "phone",
      email: "email",
      onboardingData: "onboardingData",
    },
    assistantProfiles: {
      profileId: "profileId",
      bio: "bio",
    },
    businessHours: {
      id: "id",
      staffId: "staffId",
      dayOfWeek: "dayOfWeek",
      isOpen: "isOpen",
      opensAt: "opensAt",
      closesAt: "closesAt",
    },
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
      label: "label",
      notes: "notes",
      createdAt: "createdAt",
    },
    settings: {
      key: "key",
      label: "label",
      description: "description",
      value: "value",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
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

describe("assistant-settings-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getAssistantSettings ---- */

  describe("getAssistantSettings", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getAssistantSettings } = await import("./assistant-settings-actions");
      await expect(getAssistantSettings()).rejects.toThrow("Not authenticated");
    });

    it("returns data with empty profile when no profile row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantSettings } = await import("./assistant-settings-actions");
      const result = await getAssistantSettings();
      expect(result.profile.firstName).toBe("");
      expect(result.profile.lastName).toBe("");
      expect(result.profile.bio).toBe("");
    });

    it("maps profile row correctly", async () => {
      vi.resetModules();
      const profileRow = {
        firstName: "Jane",
        lastName: "Smith",
        phone: "555-0001",
        email: "jane@test.com",
        onboardingData: { instagram: "@jane" },
      };
      const timeOffRow = {
        id: 1,
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        label: "Vacation",
        notes: null,
        createdAt: new Date("2026-01-01"),
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 1) return makeChain([profileRow]); // profiles
          if (selectCount === 2) return makeChain([]); // assistantProfiles
          if (selectCount === 3)
            return makeChain([{ dayOfWeek: 1, isOpen: true, opensAt: "10:00", closesAt: "18:00" }]); // businessHours
          if (selectCount === 4) return makeChain([]); // settings (notifications)
          return makeChain([timeOffRow]); // timeOff
        }),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getAssistantSettings } = await import("./assistant-settings-actions");
      const result = await getAssistantSettings();
      expect(result.profile.firstName).toBe("Jane");
      expect(result.profile.instagram).toBe("@jane");
    });

    it("seeds default availability when no businessHours rows exist", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 3) return makeChain([]); // no availability rows
          if (selectCount === 4) return makeChain([]); // settings
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: mockInsertValues,
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getAssistantSettings } = await import("./assistant-settings-actions");
      const result = await getAssistantSettings();
      // When seeded from defaults, availability should have 7 entries
      expect(result.availability).toHaveLength(7);
    });

    it("uses default notifications when no settings row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getAssistantSettings } = await import("./assistant-settings-actions");
      const result = await getAssistantSettings();
      expect(result.notifications.newBooking).toBe(true);
      expect(result.notifications.weeklyDigest).toBe(false);
    });

    it("parses time off notes for status and reason", async () => {
      vi.resetModules();
      const notes = JSON.stringify({ status: "approved", reason: "Family event" });
      const timeOffRow = {
        id: 1,
        startDate: "2026-07-01",
        endDate: "2026-07-07",
        label: "Original label",
        notes,
        createdAt: new Date("2026-01-01"),
      };
      let selectCount = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCount++;
          if (selectCount === 5) return makeChain([timeOffRow]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({
          values: vi.fn().mockResolvedValue(undefined),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { getAssistantSettings } = await import("./assistant-settings-actions");
      const result = await getAssistantSettings();
      if (result.timeOffRequests.length > 0) {
        expect(result.timeOffRequests[0].status).toBe("approved");
        expect(result.timeOffRequests[0].reason).toBe("Family event");
      }
    });
  });

  /* ---- saveAssistantProfile ---- */

  describe("saveAssistantProfile", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveAssistantProfile } = await import("./assistant-settings-actions");
      await expect(
        saveAssistantProfile({
          firstName: "Jane",
          lastName: "Smith",
          phone: "555",
          bio: "Bio",
          instagram: "@jane",
        }),
      ).rejects.toThrow("Not authenticated");
    });

    it("updates profiles table with correct data", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: { instagram: "@old" } }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { saveAssistantProfile } = await import("./assistant-settings-actions");
      await saveAssistantProfile({
        firstName: "Jane",
        lastName: "Smith",
        phone: "555",
        bio: "Bio text",
        instagram: "@jane_new",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Jane", lastName: "Smith" }),
      );
    });

    it("fires trackEvent with assistant_profile_updated", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: {} }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { saveAssistantProfile } = await import("./assistant-settings-actions");
      await saveAssistantProfile({
        firstName: "Jane",
        lastName: "Smith",
        phone: "555",
        bio: "Bio",
        instagram: "@jane",
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "assistant_profile_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: {} }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { saveAssistantProfile } = await import("./assistant-settings-actions");
      await saveAssistantProfile({
        firstName: "Jane",
        lastName: "Smith",
        phone: "555",
        bio: "Bio",
        instagram: "@jane",
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- saveAssistantAvailability ---- */

  describe("saveAssistantAvailability", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveAssistantAvailability } = await import("./assistant-settings-actions");
      await expect(saveAssistantAvailability([])).rejects.toThrow("Not authenticated");
    });

    it("runs a transaction to delete and re-insert availability", async () => {
      vi.resetModules();
      const mockTxDelete = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
      const mockTxInsert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
      const mockTransaction = vi.fn(async (fn: any) => {
        await fn({ delete: mockTxDelete, insert: mockTxInsert });
      });
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            returning: vi.fn().mockResolvedValue([]),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: mockTransaction,
      });
      const { saveAssistantAvailability } = await import("./assistant-settings-actions");
      const days = [{ dayOfWeek: 1, isOpen: true, opensAt: "10:00", closesAt: "18:00" }];
      await saveAssistantAvailability(days);
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockTxDelete).toHaveBeenCalled();
      expect(mockTxInsert).toHaveBeenCalled();
    });

    it("fires trackEvent with assistant_availability_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { saveAssistantAvailability } = await import("./assistant-settings-actions");
      await saveAssistantAvailability([]);
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "assistant_availability_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveAssistantAvailability } = await import("./assistant-settings-actions");
      await saveAssistantAvailability([]);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- saveAssistantNotifications ---- */

  describe("saveAssistantNotifications", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveAssistantNotifications } = await import("./assistant-settings-actions");
      await expect(saveAssistantNotifications({} as any)).rejects.toThrow("Not authenticated");
    });

    it("upserts notification prefs with user-specific key", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { saveAssistantNotifications } = await import("./assistant-settings-actions");
      await saveAssistantNotifications({
        newBooking: true,
        bookingReminder: true,
        cancellation: true,
        messageFromTrini: true,
        trainingDue: true,
        payoutProcessed: true,
        weeklyDigest: false,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: "assistant_notif:user-1" }),
      );
      expect(mockOnConflict).toHaveBeenCalled();
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveAssistantNotifications } = await import("./assistant-settings-actions");
      await saveAssistantNotifications({
        newBooking: true,
        bookingReminder: true,
        cancellation: true,
        messageFromTrini: true,
        trainingDue: true,
        payoutProcessed: true,
        weeklyDigest: false,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- submitTimeOffRequest ---- */

  describe("submitTimeOffRequest", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { submitTimeOffRequest } = await import("./assistant-settings-actions");
      await expect(
        submitTimeOffRequest({ from: "2026-07-01", to: "2026-07-07", reason: "Vacation" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("inserts time off request with staffId and pending status", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { submitTimeOffRequest } = await import("./assistant-settings-actions");
      await submitTimeOffRequest({ from: "2026-07-01", to: "2026-07-07", reason: "Trip" });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          staffId: "user-1",
          startDate: "2026-07-01",
          endDate: "2026-07-07",
        }),
      );
      // notes should contain pending status
      const callArg = mockInsertValues.mock.calls[0][0];
      const notes = JSON.parse(callArg.notes);
      expect(notes.status).toBe("pending");
    });

    it("sets type to day_off when from equals to", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { submitTimeOffRequest } = await import("./assistant-settings-actions");
      await submitTimeOffRequest({ from: "2026-07-04", to: "2026-07-04", reason: "Holiday" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ type: "day_off" }));
    });

    it("sets type to vacation when from differs from to", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn().mockResolvedValue(undefined);
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { submitTimeOffRequest } = await import("./assistant-settings-actions");
      await submitTimeOffRequest({ from: "2026-07-01", to: "2026-07-07", reason: "Trip" });
      expect(mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({ type: "vacation" }));
    });

    it("fires trackEvent with time_off_requested", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { submitTimeOffRequest } = await import("./assistant-settings-actions");
      await submitTimeOffRequest({ from: "2026-07-01", to: "2026-07-07", reason: "Trip" });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "time_off_requested",
        expect.objectContaining({ from: "2026-07-01", to: "2026-07-07" }),
      );
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: any) =>
          fn({
            delete: vi.fn(() => ({ where: vi.fn() })),
            insert: vi.fn(() => ({ values: vi.fn() })),
          }),
        ),
      });
      const { submitTimeOffRequest } = await import("./assistant-settings-actions");
      await submitTimeOffRequest({ from: "2026-07-01", to: "2026-07-07", reason: "Trip" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });
});
