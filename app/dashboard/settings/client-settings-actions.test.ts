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
const mockSyncCampaignsSubscriber = vi.fn();
const mockUnsubscribeFromCampaigns = vi.fn();
const mockRevalidatePath = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

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
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      onboardingData: "onboardingData",
      notifySms: "notifySms",
      notifyEmail: "notifyEmail",
      notifyMarketing: "notifyMarketing",
      isVip: "isVip",
      source: "source",
      tags: "tags",
      isActive: "isActive",
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
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: {
        getUser: mockGetUser,
        signOut: mockSignOut,
      },
    })),
  }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/zoho-campaigns", () => ({
    syncCampaignsSubscriber: mockSyncCampaignsSubscriber,
    unsubscribeFromCampaigns: mockUnsubscribeFromCampaigns,
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("client-settings-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  /* ---- getClientSettings ---- */

  describe("getClientSettings", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { getClientSettings } = await import("./client-settings-actions");
      await expect(getClientSettings()).rejects.toThrow("Not authenticated");
    });

    it("returns empty profile when no rows exist", async () => {
      vi.resetModules();
      // Promise.all pulls two selects; both return []
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientSettings } = await import("./client-settings-actions");
      const result = await getClientSettings();
      expect(result.profile.firstName).toBe("");
      expect(result.profile.email).toBe("");
      expect(result.preferences).toBeNull();
    });

    it("maps profile row and preferences correctly", async () => {
      vi.resetModules();
      const profileRow = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@test.com",
        phone: "555-0001",
        onboardingData: { allergies: "Latex" },
        notifySms: true,
        notifyEmail: true,
        notifyMarketing: false,
      };
      const prefRow = {
        profileId: "user-1",
        preferredLashStyle: "natural",
        preferredCurlType: "C",
        preferredLengths: "10-12mm",
        preferredDiameter: "0.10",
        naturalLashNotes: "Strong",
        retentionProfile: "4 weeks",
        allergies: null,
        skinType: "normal",
        adhesiveSensitivity: false,
        healthNotes: null,
        birthday: "1990-05-15",
        preferredContactMethod: "email",
        preferredServiceTypes: "classic",
        generalNotes: null,
        preferredRebookIntervalDays: 21,
      };
      setupMocks({
        select: vi
          .fn()
          .mockReturnValueOnce(makeChain([profileRow]))
          .mockReturnValue(makeChain([prefRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientSettings } = await import("./client-settings-actions");
      const result = await getClientSettings();
      expect(result.profile.firstName).toBe("Jane");
      expect(result.profile.allergies).toBe("Latex");
      expect(result.preferences).not.toBeNull();
      expect(result.preferences?.preferredLashStyle).toBe("natural");
    });

    it("parses structured allergies object from onboardingData", async () => {
      vi.resetModules();
      const profileRow = {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@test.com",
        phone: "555",
        onboardingData: {
          allergies: {
            adhesive: true,
            latex: false,
            nickel: true,
            fragrances: false,
            none: false,
            notes: "Mild reaction",
          },
        },
        notifySms: true,
        notifyEmail: true,
        notifyMarketing: false,
      };
      setupMocks({
        select: vi
          .fn()
          .mockReturnValueOnce(makeChain([profileRow]))
          .mockReturnValue(makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { getClientSettings } = await import("./client-settings-actions");
      const result = await getClientSettings();
      expect(result.profile.allergies).toContain("Adhesive");
      expect(result.profile.allergies).toContain("Nickel");
      expect(result.profile.allergies).toContain("Mild reaction");
    });

    it("defaults notifications to true/false when row is missing", async () => {
      vi.resetModules();
      setupMocks();
      const { getClientSettings } = await import("./client-settings-actions");
      const result = await getClientSettings();
      expect(result.notifications.notifySms).toBe(true);
      expect(result.notifications.notifyEmail).toBe(true);
      expect(result.notifications.notifyMarketing).toBe(false);
    });
  });

  /* ---- saveClientProfile ---- */

  describe("saveClientProfile", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveClientProfile } = await import("./client-settings-actions");
      await expect(
        saveClientProfile({ firstName: "Jane", lastName: "Doe", phone: "555", allergies: "" }),
      ).rejects.toThrow("Not authenticated");
    });

    it("updates profiles table with correct data", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: {} }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientProfile } = await import("./client-settings-actions");
      await saveClientProfile({
        firstName: "Jane",
        lastName: "Doe",
        phone: "555-0001",
        allergies: "Latex",
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: "Jane", lastName: "Doe" }),
      );
    });

    it("parses allergy flags from comma-separated string", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: {} }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientProfile } = await import("./client-settings-actions");
      await saveClientProfile({
        firstName: "Jane",
        lastName: "Doe",
        phone: "555",
        allergies: "adhesive, latex",
      });
      const callArg = mockUpdateSet.mock.calls[0][0];
      const allergiesObj = callArg.onboardingData.allergies;
      expect(allergiesObj.adhesive).toBe(true);
      expect(allergiesObj.latex).toBe(true);
      expect(allergiesObj.nickel).toBe(false);
    });

    it("fires trackEvent with client_profile_updated", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: {} }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientProfile } = await import("./client-settings-actions");
      await saveClientProfile({ firstName: "Jane", lastName: "Doe", phone: "555", allergies: "" });
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "client_profile_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([{ onboardingData: {} }])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientProfile } = await import("./client-settings-actions");
      await saveClientProfile({ firstName: "Jane", lastName: "Doe", phone: "555", allergies: "" });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- saveClientNotifications ---- */

  describe("saveClientNotifications", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveClientNotifications } = await import("./client-settings-actions");
      await expect(
        saveClientNotifications({ notifySms: true, notifyEmail: true, notifyMarketing: false }),
      ).rejects.toThrow("Not authenticated");
    });

    it("updates profile notification flags", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientNotifications } = await import("./client-settings-actions");
      await saveClientNotifications({
        notifySms: false,
        notifyEmail: true,
        notifyMarketing: false,
      });
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ notifySms: false, notifyEmail: true, notifyMarketing: false }),
      );
    });

    it("calls syncCampaignsSubscriber when notifyMarketing is true", async () => {
      vi.resetModules();
      const profileRow = {
        email: "jane@test.com",
        firstName: "Jane",
        lastName: "Doe",
        isVip: false,
        source: null,
        tags: null,
        onboardingData: {},
      };
      setupMocks({
        select: vi.fn(() => makeChain([profileRow])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientNotifications } = await import("./client-settings-actions");
      await saveClientNotifications({ notifySms: true, notifyEmail: true, notifyMarketing: true });
      expect(mockSyncCampaignsSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: "user-1", email: "jane@test.com" }),
      );
    });

    it("calls unsubscribeFromCampaigns when notifyMarketing is false", async () => {
      vi.resetModules();
      setupMocks();
      const { saveClientNotifications } = await import("./client-settings-actions");
      await saveClientNotifications({ notifySms: true, notifyEmail: true, notifyMarketing: false });
      expect(mockUnsubscribeFromCampaigns).toHaveBeenCalledWith("user-1");
    });

    it("fires trackEvent with client_notifications_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { saveClientNotifications } = await import("./client-settings-actions");
      await saveClientNotifications({ notifySms: true, notifyEmail: true, notifyMarketing: false });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "client_notifications_updated",
        expect.objectContaining({ notifySms: true, notifyEmail: true, notifyMarketing: false }),
      );
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveClientNotifications } = await import("./client-settings-actions");
      await saveClientNotifications({ notifySms: true, notifyEmail: true, notifyMarketing: false });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- saveClientPreferences ---- */

  describe("saveClientPreferences", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveClientPreferences } = await import("./client-settings-actions");
      await expect(saveClientPreferences({} as any)).rejects.toThrow("Not authenticated");
    });

    it("upserts client preferences with conflict update", async () => {
      vi.resetModules();
      const mockOnConflict = vi.fn().mockResolvedValue(undefined);
      const mockInsertValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { saveClientPreferences } = await import("./client-settings-actions");
      await saveClientPreferences({
        preferredLashStyle: "natural",
        preferredCurlType: "C",
        preferredLengths: "10-12mm",
        preferredDiameter: "0.10",
        naturalLashNotes: null,
        retentionProfile: null,
        allergies: null,
        skinType: null,
        adhesiveSensitivity: false,
        healthNotes: null,
        birthday: null,
        preferredContactMethod: null,
        preferredServiceTypes: null,
        generalNotes: null,
        preferredRebookIntervalDays: null,
      });
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ profileId: "user-1", preferredLashStyle: "natural" }),
      );
      expect(mockOnConflict).toHaveBeenCalled();
    });

    it("fires trackEvent with client_preferences_updated", async () => {
      vi.resetModules();
      setupMocks();
      const { saveClientPreferences } = await import("./client-settings-actions");
      await saveClientPreferences({
        preferredLashStyle: null,
        preferredCurlType: null,
        preferredLengths: null,
        preferredDiameter: null,
        naturalLashNotes: null,
        retentionProfile: null,
        allergies: null,
        skinType: null,
        adhesiveSensitivity: false,
        healthNotes: null,
        birthday: null,
        preferredContactMethod: null,
        preferredServiceTypes: null,
        generalNotes: null,
        preferredRebookIntervalDays: null,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "client_preferences_updated");
    });

    it("revalidates /dashboard/settings", async () => {
      vi.resetModules();
      setupMocks();
      const { saveClientPreferences } = await import("./client-settings-actions");
      await saveClientPreferences({
        preferredLashStyle: null,
        preferredCurlType: null,
        preferredLengths: null,
        preferredDiameter: null,
        naturalLashNotes: null,
        retentionProfile: null,
        allergies: null,
        skinType: null,
        adhesiveSensitivity: false,
        healthNotes: null,
        birthday: null,
        preferredContactMethod: null,
        preferredServiceTypes: null,
        generalNotes: null,
        preferredRebookIntervalDays: null,
      });
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/settings");
    });
  });

  /* ---- deleteClientAccount ---- */

  describe("deleteClientAccount", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { deleteClientAccount } = await import("./client-settings-actions");
      await expect(deleteClientAccount()).rejects.toThrow("Not authenticated");
    });

    it("deactivates profile (soft delete)", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
      });
      const { deleteClientAccount } = await import("./client-settings-actions");
      await deleteClientAccount();
      expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
    });

    it("calls supabase signOut after deactivating profile", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteClientAccount } = await import("./client-settings-actions");
      await deleteClientAccount();
      expect(mockSignOut).toHaveBeenCalled();
    });

    it("fires trackEvent with account_deleted", async () => {
      vi.resetModules();
      setupMocks();
      const { deleteClientAccount } = await import("./client-settings-actions");
      await deleteClientAccount();
      expect(mockTrackEvent).toHaveBeenCalledWith("user-1", "account_deleted");
    });
  });
});
