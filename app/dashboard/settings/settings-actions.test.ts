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
const mockIsSquareConfigured = vi.fn(() => false);
const mockRevalidatePath = vi.fn();

function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
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
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("settings-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getBusinessProfile ---- */

  describe("getBusinessProfile", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getBusinessProfile } = await import("./settings-actions");
      await expect(getBusinessProfile()).rejects.toThrow("Not authenticated");
    });

    it("returns default business profile when no DB row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getBusinessProfile } = await import("./settings-actions");
      const result = await getBusinessProfile();
      expect(result).toMatchObject({
        businessName: "T Creative Studio",
        owner: "Trini",
        currency: "USD ($)",
      });
    });

    it("returns stored value when DB row exists", async () => {
      vi.resetModules();
      const storedProfile = {
        businessName: "My Studio",
        owner: "Jane",
        email: "jane@test.com",
        phone: "555-1234",
        location: "LA",
        timezone: "America/Los_Angeles",
        currency: "USD",
        bookingLink: "book.me",
        bio: "Bio",
      };
      setupMocks({
        select: vi.fn(() => makeChain([{ key: "business_profile", value: storedProfile }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getBusinessProfile } = await import("./settings-actions");
      const result = await getBusinessProfile();
      expect(result).toEqual(storedProfile);
    });
  });

  /* ---- saveBusinessProfile ---- */

  describe("saveBusinessProfile", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveBusinessProfile } = await import("./settings-actions");
      await expect(saveBusinessProfile({} as any)).rejects.toThrow("Not authenticated");
    });

    it("calls db.insert with correct key and label", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveBusinessProfile } = await import("./settings-actions");
      const data = {
        businessName: "My Studio",
        owner: "Jane",
        email: "j@j.com",
        phone: "555",
        location: "LA",
        timezone: "America/Los_Angeles",
        currency: "USD",
        bookingLink: "link",
        bio: "bio",
      };
      await saveBusinessProfile(data);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: "business_profile", label: "Business Profile" }),
      );
    });

    it("fires trackEvent with business_profile_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { saveBusinessProfile } = await import("./settings-actions");
      const data = {
        businessName: "My Studio",
        owner: "Jane",
        email: "j@j.com",
        phone: "555",
        location: "LA",
        timezone: "America/Los_Angeles",
        currency: "USD",
        bookingLink: "link",
        bio: "bio",
      };
      await saveBusinessProfile(data);
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "business_profile_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveBusinessProfile } = await import("./settings-actions");
      const data = {
        businessName: "My Studio",
        owner: "Jane",
        email: "j@j.com",
        phone: "555",
        location: "LA",
        timezone: "America/Los_Angeles",
        currency: "USD",
        bookingLink: "link",
        bio: "bio",
      };
      await saveBusinessProfile(data);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getPolicies ---- */

  describe("getPolicies", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getPolicies } = await import("./settings-actions");
      await expect(getPolicies()).rejects.toThrow("Not authenticated");
    });

    it("returns default policies when no DB row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getPolicies } = await import("./settings-actions");
      const result = await getPolicies();
      expect(result).toMatchObject({
        cancelWindowHours: 48,
        depositRequired: true,
        depositPercent: 25,
      });
    });
  });

  /* ---- savePolicies ---- */

  describe("savePolicies", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { savePolicies } = await import("./settings-actions");
      await expect(savePolicies({} as any)).rejects.toThrow("Not authenticated");
    });

    it("upserts with correct key", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { savePolicies } = await import("./settings-actions");
      await savePolicies({
        cancelWindowHours: 24,
        lateCancelFeePercent: 50,
        noShowFeePercent: 100,
        depositRequired: false,
        depositPercent: 0,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ key: "policy_settings" }),
      );
    });

    it("fires trackEvent with policies_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { savePolicies } = await import("./settings-actions");
      await savePolicies({
        cancelWindowHours: 24,
        lateCancelFeePercent: 50,
        noShowFeePercent: 100,
        depositRequired: false,
        depositPercent: 0,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "policies_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { savePolicies } = await import("./settings-actions");
      await savePolicies({
        cancelWindowHours: 24,
        lateCancelFeePercent: 50,
        noShowFeePercent: 100,
        depositRequired: false,
        depositPercent: 0,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getLoyaltyConfig ---- */

  describe("getLoyaltyConfig", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getLoyaltyConfig } = await import("./settings-actions");
      await expect(getLoyaltyConfig()).rejects.toThrow("Not authenticated");
    });

    it("returns default loyalty config when no DB row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getLoyaltyConfig } = await import("./settings-actions");
      const result = await getLoyaltyConfig();
      expect(result).toMatchObject({
        pointsFirstBooking: 75,
        tierGold: 700,
        tierPlatinum: 1500,
      });
    });
  });

  /* ---- saveLoyaltyConfig ---- */

  describe("saveLoyaltyConfig", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveLoyaltyConfig } = await import("./settings-actions");
      await expect(saveLoyaltyConfig({} as any)).rejects.toThrow("Not authenticated");
    });

    it("fires trackEvent with loyalty_config_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { saveLoyaltyConfig } = await import("./settings-actions");
      await saveLoyaltyConfig({
        pointsProfileComplete: 25,
        pointsBirthdayAdded: 50,
        pointsReferral: 100,
        pointsFirstBooking: 75,
        pointsRebook: 50,
        pointsReview: 30,
        tierSilver: 300,
        tierGold: 700,
        tierPlatinum: 1500,
        birthdayDiscountPercent: 5,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "loyalty_config_updated");
    });
  });

  /* ---- getNotificationPrefs ---- */

  describe("getNotificationPrefs", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getNotificationPrefs } = await import("./settings-actions");
      await expect(getNotificationPrefs()).rejects.toThrow("Not authenticated");
    });

    it("returns default notification prefs when no row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getNotificationPrefs } = await import("./settings-actions");
      const result = await getNotificationPrefs();
      expect(result.items).toHaveLength(7);
    });
  });

  /* ---- saveNotificationPrefs ---- */

  describe("saveNotificationPrefs", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveNotificationPrefs } = await import("./settings-actions");
      await expect(saveNotificationPrefs({ items: [] })).rejects.toThrow("Not authenticated");
    });

    it("does not fire trackEvent (no PostHog call)", async () => {
      vi.resetModules();
      setupMocks();
      const { saveNotificationPrefs } = await import("./settings-actions");
      await saveNotificationPrefs({ items: [] });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveNotificationPrefs } = await import("./settings-actions");
      await saveNotificationPrefs({ items: [] });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getBookingRules ---- */

  describe("getBookingRules", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getBookingRules } = await import("./settings-actions");
      await expect(getBookingRules()).rejects.toThrow("Not authenticated");
    });

    it("returns default booking rules when no row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getBookingRules } = await import("./settings-actions");
      const result = await getBookingRules();
      expect(result).toMatchObject({
        minNoticeHours: 24,
        maxAdvanceDays: 60,
        allowOnlineBooking: true,
      });
    });
  });

  /* ---- saveBookingRules ---- */

  describe("saveBookingRules", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveBookingRules } = await import("./settings-actions");
      await expect(saveBookingRules({} as any)).rejects.toThrow("Not authenticated");
    });

    it("fires trackEvent with booking_rules_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { saveBookingRules } = await import("./settings-actions");
      await saveBookingRules({
        minNoticeHours: 24,
        maxAdvanceDays: 60,
        bufferMinutes: 15,
        maxDailyBookings: 8,
        cancelWindowHours: 48,
        depositPct: 25,
        depositRequired: true,
        allowOnlineBooking: true,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "booking_rules_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveBookingRules } = await import("./settings-actions");
      await saveBookingRules({
        minNoticeHours: 24,
        maxAdvanceDays: 60,
        bufferMinutes: 15,
        maxDailyBookings: 8,
        cancelWindowHours: 48,
        depositPct: 25,
        depositRequired: true,
        allowOnlineBooking: true,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getReminders ---- */

  describe("getReminders", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getReminders } = await import("./settings-actions");
      await expect(getReminders()).rejects.toThrow("Not authenticated");
    });

    it("returns default reminders when no row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getReminders } = await import("./settings-actions");
      const result = await getReminders();
      expect(result.items).toHaveLength(6);
      expect(result.items[0]).toMatchObject({ label: "Booking confirmation" });
    });
  });

  /* ---- saveReminders ---- */

  describe("saveReminders", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveReminders } = await import("./settings-actions");
      await expect(saveReminders({ items: [] })).rejects.toThrow("Not authenticated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveReminders } = await import("./settings-actions");
      await saveReminders({ items: [] });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- getFinancialConfig ---- */

  describe("getFinancialConfig", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getFinancialConfig } = await import("./settings-actions");
      await expect(getFinancialConfig()).rejects.toThrow("Not authenticated");
    });

    it("returns default financial config when no row exists", async () => {
      vi.resetModules();
      setupMocks();
      const { getFinancialConfig } = await import("./settings-actions");
      const result = await getFinancialConfig();
      expect(result).toMatchObject({ revenueGoalMonthly: 12000, estimatedTaxRate: 25 });
    });
  });

  /* ---- saveFinancialConfig ---- */

  describe("saveFinancialConfig", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveFinancialConfig } = await import("./settings-actions");
      await expect(
        saveFinancialConfig({ revenueGoalMonthly: 0, estimatedTaxRate: 0 }),
      ).rejects.toThrow("Not authenticated");
    });

    it("revalidates multiple paths", async () => {
      vi.resetModules();
      setupMocks();
      const { saveFinancialConfig } = await import("./settings-actions");
      await saveFinancialConfig({ revenueGoalMonthly: 10000, estimatedTaxRate: 20 });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/analytics");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- getSquareConnectionStatus ---- */

  describe("getSquareConnectionStatus", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getSquareConnectionStatus } = await import("./settings-actions");
      await expect(getSquareConnectionStatus()).rejects.toThrow("Not authenticated");
    });

    it("returns connected: false when Square is not configured", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(false);
      setupMocks();
      const { getSquareConnectionStatus } = await import("./settings-actions");
      const result = await getSquareConnectionStatus();
      expect(result.connected).toBe(false);
      expect(result.locationId).toBe("");
    });

    it("returns connected: true when Square is configured", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(true);
      setupMocks();
      process.env.SQUARE_LOCATION_ID = "LOC_ABCDEF";
      const { getSquareConnectionStatus } = await import("./settings-actions");
      const result = await getSquareConnectionStatus();
      expect(result.connected).toBe(true);
      expect(result.locationId).toContain("ABCDEF");
    });
  });
});
