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
    offset: () => chain,
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
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockDeleteCookie = vi.fn();
const mockGetCookie = vi.fn().mockReturnValue(undefined);
const mockSeedNotificationPreferences = vi.fn().mockResolvedValue(undefined);
const mockUpsertZohoContact = vi.fn();
const mockSyncCampaignsSubscriber = vi.fn();
const mockLinkSquareCustomer = vi.fn().mockResolvedValue(undefined);
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({
  businessName: "T Creative",
});

/* ------------------------------------------------------------------ */
/*  Per-test mock setup helper                                         */
/* ------------------------------------------------------------------ */

// setupMocks registers vi.doMock() replacements for all external deps.
// Pass a custom `db` to override the default no-op mock.
function setupMocks(db: Record<string, unknown> | null = null) {
  const mockTransaction = vi.fn(async (fn: (tx: any) => Promise<void>) => {
    await fn(defaultDb);
  });

  const defaultDb: any = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: "new-id" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    transaction: mockTransaction,
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
      role: "role",
      notifySms: "notifySms",
      notifyEmail: "notifyEmail",
      notifyMarketing: "notifyMarketing",
      onboardingData: "onboardingData",
      referralCode: "referralCode",
      referredBy: "referredBy",
      tags: "tags",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    loyaltyTransactions: {
      id: "id",
      profileId: "profileId",
      points: "points",
      type: "type",
      description: "description",
      referenceId: "referenceId",
      createdAt: "createdAt",
    },
    referralCodes: {
      id: "id",
      profileId: "profileId",
      code: "code",
      createdAt: "createdAt",
    },
    referrals: {
      id: "id",
      referrerId: "referrerId",
      referredId: "referredId",
      status: "status",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }));

  vi.doMock("@/db/schema/assistants", () => ({
    assistantProfiles: {
      id: "id",
      profileId: "profileId",
      title: "title",
      specialties: "specialties",
      bio: "bio",
    },
  }));

  vi.doMock("@/db/schema/services", () => ({
    services: { id: "id", name: "name", category: "category" },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => {
        const obj = { type: "sql", args, as: vi.fn(() => obj) };
        return obj;
      }),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
    isNull: vi.fn((...args: unknown[]) => ({ type: "isNull", args })),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
  }));

  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));

  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));

  vi.doMock("@/lib/notification-preferences", () => ({
    seedNotificationPreferences: mockSeedNotificationPreferences,
  }));

  vi.doMock("@/lib/zoho", () => ({ upsertZohoContact: mockUpsertZohoContact }));

  vi.doMock("@/lib/zoho-campaigns", () => ({
    syncCampaignsSubscriber: mockSyncCampaignsSubscriber,
  }));

  vi.doMock("@/lib/square", () => ({ linkSquareCustomer: mockLinkSquareCustomer }));

  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));

  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({
      get: mockGetCookie,
      delete: mockDeleteCookie,
    })),
  }));

  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));

  vi.doMock("@/emails/WelcomeEmail", () => ({ WelcomeEmail: vi.fn().mockReturnValue(null) }));
  vi.doMock("@/emails/LoyaltyPointsAwarded", () => ({
    LoyaltyPointsAwarded: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("@/emails/ReferralBonus", () => ({ ReferralBonus: vi.fn().mockReturnValue(null) }));
}

/* ------------------------------------------------------------------ */
/*  Input factories                                                    */
/* ------------------------------------------------------------------ */

// Minimal valid client onboarding input. Overrides allow selective field
// changes per test without repeating the full object each time.
function makeClientInput(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "",
    source: "instagram" as const,
    notifications: { sms: true, email: true, marketing: false },
    interests: ["lash"] as ("lash" | "jewelry" | "crochet" | "consulting")[],
    allergies: {
      adhesive: false,
      latex: false,
      nickel: false,
      fragrances: false,
      none: true,
      notes: "",
    },
    availability: {
      weekdays: true,
      weekends: false,
      mornings: true,
      afternoons: false,
      evenings: false,
    },
    referral: { referrerCode: "", skipped: true },
    waiverAgreed: true,
    cancellationAgreed: true,
    photoConsent: "no" as const,
    birthday: "",
    ...overrides,
  };
}

// Minimal valid assistant onboarding input.
function makeAssistantInput(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Alex",
    preferredTitle: "Lash Artist",
    skills: ["lash"] as ("lash" | "jewelry" | "crochet" | "consulting")[],
    experienceLevel: "mid" as const,
    bio: "Passionate about lash art.",
    availableDefaultStart: "09:00",
    availableDefaultEnd: "17:00",
    availableDates: "[]",
    availableDateOverrides: "{}",
    availableLunchBreak: false,
    availableLunchStart: "12:00",
    availableLunchDuration: "30",
    emergencyContactName: "Sam Smith",
    emergencyContactPhone: "555-0100",
    emergencyContactRelation: "Spouse",
    certifications: [] as (
      | "tcreative_lash"
      | "tcreative_jewelry"
      | "external_lash"
      | "external_jewelry"
    )[],
    workStyle: "client_facing" as const,
    email: "alex@example.com",
    phone: "",
    instagramHandle: "@alexlash",
    notifications: { sms: true, email: true, marketing: false },
    offersTraining: false,
    trainingFormats: [] as ("one_on_one" | "group" | "online" | "in_person")[],
    portfolioInstagram: "",
    tiktokHandle: "",
    portfolioWebsite: "",
    policyClientPhotos: true,
    policyConfidentiality: true,
    policyConduct: true,
    policyCompensation: true,
    ...overrides,
  };
}

// Minimal valid admin onboarding input.
function makeAdminInput(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Taylor",
    lastName: "Owner",
    email: "taylor@tcreative.com",
    phone: "555-9000",
    notifySms: true,
    notifyEmail: true,
    studioName: "T Creative Studio",
    bio: "Studio owner bio",
    locationType: "home_studio" as const,
    locationArea: "Chicago, IL",
    bookingNotice: "24",
    socials: {
      instagram: "@tcreative",
      instagram2: "",
      instagram3: "",
      instagram4: "",
      tiktok: "",
      facebook: "",
      youtube: "",
      pinterest: "",
      linkedin: "",
      google: "",
      website: "",
    },
    services: {
      lash: { enabled: true, price: "150.00", duration: "90", deposit: "50.00" },
      jewelry: { enabled: false, price: "", duration: "", deposit: "" },
      crochet: { enabled: false, price: "", duration: "", deposit: "" },
      consulting: { enabled: false, price: "", duration: "", deposit: "" },
    },
    waitlist: { lash: true, jewelry: false, crochet: false, consulting: "off" as const },
    intake: {
      lash: {
        prep: "Come with clean lashes",
        adhesiveAllergy: true,
        contactLenses: true,
        previousLashes: true,
        desiredLook: true,
      },
      jewelry: { prep: "", metalAllergy: false, designPreference: false },
      crochet: { prep: "", hairType: false, desiredStyle: false, scalpSensitivity: false },
      consulting: { prep: "", serviceInterest: false, previousExperience: false, goal: false },
    },
    workingHours: {
      defaultStartTime: "09:00",
      defaultEndTime: "17:00",
      appointmentGap: "15",
      lunchBreak: false,
      lunchStart: "12:00",
      lunchDuration: "30",
      selectedDates: "[]",
      dayOverrides: "{}",
    },
    bookingConfirmation: "instant" as const,
    cancellationFee: "50.00",
    cancellationWindow: "24",
    noShowFee: "25.00",
    rewards: {
      enabled: false,
      pointsPerDollar: "10",
      pointsToRedeem: "100",
      firstBookingBonus: "",
      birthdayBonus: "",
      referralBonus: "",
      refereeBonus: "",
      reviewBonus: "",
      rebookBonus: "",
      milestoneBonus: "",
      milestone10thBonus: "",
      socialShareBonus: "",
      productPurchaseBonus: "",
      profileCompleteBonus: "",
      anniversaryBonus: "",
      newServiceBonus: "",
      classAttendanceBonus: "",
      packagePurchaseBonus: "",
      programCompleteBonus: "",
      certificationBonus: "",
      tier1Name: "Member",
      tier1Threshold: "0",
      tier1Multiplier: "1",
      tier2Name: "Regular",
      tier2Threshold: "500",
      tier2Multiplier: "1.25",
      tier3Name: "VIP",
      tier3Threshold: "2000",
      tier3Multiplier: "1.5",
      tier4Name: "Elite",
      tier4Threshold: "5000",
      tier4Multiplier: "2",
      pointsExpiry: "",
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("saveOnboardingData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: {} } } });
    mockGetCookie.mockReturnValue(undefined);
  });

  /* ---- Auth gate ---- */

  describe("authentication", () => {
    it("throws when user is not authenticated", async () => {
      vi.resetModules();
      mockGetUser.mockResolvedValue({ data: { user: null } });
      setupMocks();
      const { saveOnboardingData } = await import("./actions");
      await expect(saveOnboardingData(makeClientInput(), "client")).rejects.toThrow(
        "Not authenticated",
      );
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Client onboarding                                               */
  /* ---------------------------------------------------------------- */

  describe("client onboarding", () => {
    it("upserts profile with all fields (full flow)", async () => {
      vi.resetModules();

      // Capture what values() is called with inside the transaction
      const mockValuesCapture = vi.fn((_values: Record<string, unknown>) => ({
        returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }));
      const mockInsert = vi.fn(() => ({ values: mockValuesCapture }));
      const mockSelect = vi
        .fn()
        // First call: no alreadyAwarded loyalty transaction
        .mockReturnValueOnce(makeChain([]));
      const txDb: any = {
        select: mockSelect,
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        ...txDb,
        select: vi.fn(() => makeChain([])), // referrer lookup returns nothing
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeClientInput({
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          phone: "555-1234",
          source: "instagram",
          notifications: { sms: true, email: true, marketing: true },
          interests: ["lash", "jewelry"],
          birthday: "05/15",
          photoConsent: "yes",
          waiverAgreed: true,
          cancellationAgreed: true,
        }),
        "client",
      );

      // Profile upsert is the first insert call inside the transaction
      const profileInsertCall = mockValuesCapture.mock.calls.find((args) => {
        const v = args[0];
        return v && "firstName" in v;
      });
      expect(profileInsertCall).toBeDefined();
      const insertedProfile = profileInsertCall![0] as Record<string, unknown>;
      expect(insertedProfile).toMatchObject({
        id: "user-1",
        role: "client",
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        phone: "555-1234",
        notifySms: true,
        notifyEmail: true,
        notifyMarketing: true,
      });

      // onboardingData JSONB is included
      expect(insertedProfile.onboardingData).toMatchObject({
        interests: ["lash", "jewelry"],
        birthday: "05/15",
        photoConsent: "yes",
        waiverAgreed: true,
        cancellationAgreed: true,
      });

      // referralCode generated from firstName + last 6 hex chars of user ID (dashes stripped)
      // Mock user ID "user-1" → stripped "user1" → last 6 uppercase → "USER1"
      expect(insertedProfile.referralCode).toMatch(/^JANE-[A-Z0-9]+$/);
    });

    it("tags are set based on selected interests", async () => {
      vi.resetModules();
      const mockValuesCapture = vi.fn((_values: Record<string, unknown>) => ({
        returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
        onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }));
      const mockInsert = vi.fn(() => ({ values: mockValuesCapture }));
      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(makeClientInput({ interests: ["lash", "crochet"] }), "client");

      const profileInsert = mockValuesCapture.mock.calls.find((args) => args[0]?.firstName);
      expect(profileInsert![0].tags).toBe("Lashes, Crochet");
    });

    it("fires onboarding_completed and client_signup_completed PostHog events", async () => {
      vi.resetModules();
      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(makeClientInput({ source: "word_of_mouth" }), "client");

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "client_signup_completed",
        expect.objectContaining({ source: "word_of_mouth" }),
      );
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "onboarding_completed",
        expect.objectContaining({ role: "client" }),
      );
    });

    it("sends welcome email when email notifications enabled", async () => {
      vi.resetModules();
      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeClientInput({ notifications: { sms: false, email: true, marketing: false } }),
        "client",
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: "welcome_email" }),
      );
    });

    it("does not send welcome email when email notifications disabled", async () => {
      vi.resetModules();
      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeClientInput({ notifications: { sms: false, email: false, marketing: false } }),
        "client",
      );

      expect(mockSendEmail).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Referral code                                                    */
  /* ---------------------------------------------------------------- */

  describe("referral code handling", () => {
    it("creates a referral record when a valid referral code is applied", async () => {
      vi.resetModules();

      // Track all insert calls to detect the referrals row
      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "row-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });
      const mockInsert = vi.fn(() => ({ values: mockValuesCapture }));

      const txDb: any = {
        // alreadyAwarded check → not yet awarded
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };

      let outerSelectCall = 0;
      const mockDb: any = {
        // First outer select: referrer lookup by code → found
        select: vi.fn(() => {
          outerSelectCall++;
          if (outerSelectCall === 1) return makeChain([{ id: "referrer-1" }]);
          // Second outer select (post-tx email): referrer profile for email
          return makeChain([
            {
              id: "referrer-1",
              email: "alice@example.com",
              firstName: "Alice",
              notifyEmail: false,
            },
          ]);
        }),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeClientInput({ referral: { referrerCode: "ALICE-123456", skipped: false } }),
        "client",
      );

      // A referrals row should have been inserted inside the transaction
      const referralInsert = insertedValues.find(
        (v: any) => v && "referrerId" in v && "referredId" in v,
      );
      expect(referralInsert).toBeDefined();
      expect(referralInsert).toMatchObject({
        referrerId: "referrer-1",
        referredId: "user-1",
        status: "pending",
      });
    });

    it("fires referral_code_used PostHog event when referrer is found", async () => {
      vi.resetModules();

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };

      let outerSelectCall = 0;
      const mockDb: any = {
        select: vi.fn(() => {
          outerSelectCall++;
          if (outerSelectCall === 1) return makeChain([{ id: "referrer-1" }]);
          return makeChain([]);
        }),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeClientInput({ referral: { referrerCode: "ALICE-123456", skipped: false } }),
        "client",
      );

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "referral_code_used",
        expect.objectContaining({ referrerId: "referrer-1" }),
      );
    });

    it("onboarding succeeds with soft failure when referral code is invalid (not found)", async () => {
      vi.resetModules();

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };

      const mockDb: any = {
        // Referrer lookup returns empty — code not found
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      // Should resolve without throwing even though code is not found
      await expect(
        saveOnboardingData(
          makeClientInput({ referral: { referrerCode: "BOGUS-999999", skipped: false } }),
          "client",
        ),
      ).resolves.toBeUndefined();

      // No referral_code_used event should fire (referrer was not found)
      expect(mockTrackEvent).not.toHaveBeenCalledWith(
        "user-1",
        "referral_code_used",
        expect.anything(),
      );
    });

    it("reads referral code from cookie when form field is blank", async () => {
      vi.resetModules();

      // Simulate a referral cookie set from a referral link visit
      mockGetCookie.mockReturnValue({ value: "COOKIE-ABCDEF" });

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };

      let outerSelectCall = 0;
      const mockDb: any = {
        select: vi.fn(() => {
          outerSelectCall++;
          if (outerSelectCall === 1) return makeChain([{ id: "referrer-cookie-1" }]);
          return makeChain([]);
        }),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeClientInput({ referral: { referrerCode: "", skipped: true } }),
        "client",
      );

      // Cookie-based referral code triggers the referral_code_used event
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "referral_code_used",
        expect.objectContaining({ referrerId: "referrer-cookie-1" }),
      );

      // Cookie should be cleared after use
      expect(mockDeleteCookie).toHaveBeenCalledWith("referral_ref");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Duplicate email                                                  */
  /* ---------------------------------------------------------------- */

  describe("duplicate email", () => {
    it("propagates database error when email already exists", async () => {
      vi.resetModules();

      const dbError = new Error("duplicate key value violates unique constraint");

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            // Simulate DB unique constraint violation on email
            onConflictDoUpdate: vi.fn().mockRejectedValue(dbError),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };

      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await expect(
        saveOnboardingData(makeClientInput({ email: "taken@example.com" }), "client"),
      ).rejects.toThrow("duplicate key value");
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Admin onboarding                                                 */
  /* ---------------------------------------------------------------- */

  describe("admin onboarding", () => {
    it("upserts profile with admin role and inserts enabled services", async () => {
      vi.resetModules();

      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });
      const mockInsert = vi.fn(() => ({ values: mockValuesCapture }));

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: mockInsert,
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };

      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAdminInput({
          services: {
            lash: { enabled: true, price: "150.00", duration: "90", deposit: "50.00" },
            jewelry: { enabled: true, price: "75.00", duration: "45", deposit: "0" },
            crochet: { enabled: false, price: "", duration: "", deposit: "" },
            consulting: { enabled: false, price: "", duration: "", deposit: "" },
          },
        }),
        "admin",
      );

      // Profile upsert has admin role
      const profileInsert = insertedValues.find((v: any) => v?.role === "admin");
      expect(profileInsert).toBeDefined();
      expect(profileInsert).toMatchObject({
        id: "user-1",
        role: "admin",
        firstName: "Taylor",
        lastName: "Owner",
        email: "taylor@tcreative.com",
      });

      // Both enabled services are inserted
      const serviceInserts = insertedValues.filter(
        (v: any) => Array.isArray(v) && v.length > 0 && "category" in v[0],
      );
      // Services are inserted as an array via .values(serviceInserts)
      const serviceArray = insertedValues.find(
        (v: any) => Array.isArray(v) && v.some((s: any) => s.category),
      ) as any[] | undefined;
      expect(serviceArray).toBeDefined();
      expect(serviceArray).toHaveLength(2);
      expect(serviceArray!.find((s: any) => s.category === "lash")).toMatchObject({
        category: "lash",
        priceInCents: 15000,
        depositInCents: 5000,
        durationMinutes: 90,
        isActive: true,
      });
      expect(serviceArray!.find((s: any) => s.category === "jewelry")).toMatchObject({
        category: "jewelry",
        priceInCents: 7500,
        durationMinutes: 45,
        isActive: true,
      });
    });

    it("uses different steps from client (no referral, no loyalty)", async () => {
      vi.resetModules();

      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValuesCapture })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(makeAdminInput(), "admin");

      // Admin path fires onboarding_completed with role=admin
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "onboarding_completed",
        expect.objectContaining({ role: "admin" }),
      );

      // Admin path does not fire client_signup_completed
      expect(mockTrackEvent).not.toHaveBeenCalledWith(
        "user-1",
        "client_signup_completed",
        expect.anything(),
      );

      // No loyalty transactions inserted (admin path has no loyalty points)
      const loyaltyInsert = insertedValues.find(
        (v: any) => Array.isArray(v) && v.some((r: any) => "points" in r),
      );
      expect(loyaltyInsert).toBeUndefined();

      // No referrals record (admin path has no referral logic)
      const referralInsert = insertedValues.find((v: any) => v && "referrerId" in v);
      expect(referralInsert).toBeUndefined();
    });

    it("fires onboarding_completed with servicesConfigured count", async () => {
      vi.resetModules();

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAdminInput({
          services: {
            lash: { enabled: true, price: "150.00", duration: "90", deposit: "" },
            jewelry: { enabled: true, price: "75.00", duration: "45", deposit: "" },
            crochet: { enabled: true, price: "100.00", duration: "120", deposit: "" },
            consulting: { enabled: false, price: "", duration: "", deposit: "" },
          },
        }),
        "admin",
      );

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "onboarding_completed",
        expect.objectContaining({ role: "admin", servicesConfigured: 3 }),
      );
    });

    it("stores onboardingData with studio config fields", async () => {
      vi.resetModules();

      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });

      const txDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValuesCapture })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
      };
      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(txDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAdminInput({
          studioName: "T Creative Studio",
          locationType: "salon_suite",
          locationArea: "Chicago, IL",
          bookingNotice: "48",
          bookingConfirmation: "manual",
        }),
        "admin",
      );

      const profileInsert = insertedValues.find((v: any) => v?.role === "admin") as any;
      expect(profileInsert?.onboardingData).toMatchObject({
        studioName: "T Creative Studio",
        location: { type: "salon_suite", area: "Chicago, IL" },
        bookingNoticeHours: 48,
        policies: { bookingConfirmation: "manual" },
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Assistant onboarding                                             */
  /* ---------------------------------------------------------------- */

  describe("assistant onboarding", () => {
    it("upserts profile and assistant_profiles with role, skills, and bio", async () => {
      vi.resetModules();

      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });

      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValuesCapture })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        // Assistant path does NOT use db.transaction — direct inserts
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(mockDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAssistantInput({
          firstName: "Alex",
          email: "alex@example.com",
          skills: ["lash", "jewelry"],
          experienceLevel: "senior",
          preferredTitle: "Master Lash Artist",
          bio: "10 years of experience",
          workStyle: "both",
        }),
        "assistant",
      );

      // profiles row: role = assistant
      const profileInsert = insertedValues.find((v: any) => v?.role === "assistant") as any;
      expect(profileInsert).toBeDefined();
      expect(profileInsert).toMatchObject({
        id: "user-1",
        role: "assistant",
        firstName: "Alex",
        email: "alex@example.com",
      });

      // assistant_profiles row: title + specialties (comma-joined skills) + bio
      const assistantInsert = insertedValues.find(
        (v: any) => v?.profileId === "user-1" && "specialties" in v,
      ) as any;
      expect(assistantInsert).toBeDefined();
      expect(assistantInsert).toMatchObject({
        profileId: "user-1",
        title: "Master Lash Artist",
        specialties: "lash, jewelry",
        bio: "10 years of experience",
      });
    });

    it("stores experienceLevel and workStyle in onboardingData JSONB", async () => {
      vi.resetModules();

      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });

      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValuesCapture })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(mockDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAssistantInput({
          experienceLevel: "junior",
          workStyle: "back_of_house",
          certifications: ["tcreative_lash", "external_jewelry"],
          offersTraining: true,
          trainingFormats: ["one_on_one", "online"],
        }),
        "assistant",
      );

      const profileInsert = insertedValues.find((v: any) => v?.role === "assistant") as any;
      expect(profileInsert?.onboardingData).toMatchObject({
        experienceLevel: "junior",
        workStyle: "back_of_house",
        certifications: ["tcreative_lash", "external_jewelry"],
        offersTraining: true,
        trainingFormats: ["one_on_one", "online"],
      });
    });

    it("stores commission-relevant fields (skills as specialties) correctly", async () => {
      vi.resetModules();

      const insertedValues: unknown[] = [];
      const mockValuesCapture = vi.fn((v: unknown) => {
        insertedValues.push(v);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      });

      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValuesCapture })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(mockDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAssistantInput({ skills: ["lash", "crochet", "consulting"] }),
        "assistant",
      );

      // Skills are joined as comma-separated string in specialties column
      const assistantInsert = insertedValues.find(
        (v: any) => v?.profileId === "user-1" && "specialties" in v,
      ) as any;
      expect(assistantInsert?.specialties).toBe("lash, crochet, consulting");
    });

    it("fires onboarding_completed with role=assistant and skills", async () => {
      vi.resetModules();

      const mockDb: any = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: "user-1" }]),
            onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn(mockDb)),
      };

      setupMocks(mockDb);
      const { saveOnboardingData } = await import("./actions");

      await saveOnboardingData(
        makeAssistantInput({ skills: ["lash", "jewelry"], experienceLevel: "mid" }),
        "assistant",
      );

      expect(mockTrackEvent).toHaveBeenCalledWith(
        "user-1",
        "onboarding_completed",
        expect.objectContaining({
          role: "assistant",
          skills: ["lash", "jewelry"],
          experienceLevel: "mid",
        }),
      );
    });
  });
});
