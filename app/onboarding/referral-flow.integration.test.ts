import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the saveOnboardingData client path — specifically the
 * referral bonus and loyalty transaction logic.
 *
 * Each test calls the real saveOnboardingData function (role="client") against a
 * stateful mock DB and verifies final state: which rows ended up in _profiles and
 * _loyalty, not which mocks were called.
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const _profiles: MockRow[] = [];
  const _loyalty: MockRow[] = [];

  let nextId = 1;

  // Per-test ordered queue of arrays returned by select() calls.
  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db: any = {
    _profiles,
    _loyalty,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((_table: any) => ({
      values: vi.fn((values: MockRow | MockRow[]) => {
        // insert().values() receives either a single object or an array (pointsRows batch)
        const rows = Array.isArray(values) ? values : [values];
        for (const row of rows) {
          const id = `row-${nextId++}`;
          const stored = { ...row, id };
          if ("points" in row) {
            _loyalty.push(stored);
          } else if ("firstName" in row || "email" in row) {
            // profile upsert — onConflictDoUpdate is chained after values()
            _profiles.push(stored);
          }
        }
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue(rows.map((_, i) => ({ id: `row-${nextId - rows.length + i}` }))),
        };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),

    // The client path wraps everything in db.transaction — pass tx = db so the
    // same stateful instance handles all nested calls.
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      await fn(db);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared external mocks (declared once, reset each test)             */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockDeleteCookie = vi.fn();
const mockGetCookie = vi.fn().mockReturnValue(undefined);

/* ------------------------------------------------------------------ */
/*  Per-test setup helper                                              */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));

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
      birthday: "birthday",
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
  }));

  vi.doMock("@/db/schema/assistants", () => ({
    assistantProfiles: {
      id: "id",
      profileId: "profileId",
    },
  }));

  vi.doMock("@/db/schema/services", () => ({
    services: { id: "id", name: "name" },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    or: vi.fn((...args: unknown[]) => ({ type: "or", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: Object.assign(vi.fn((...args: unknown[]) => ({ type: "sql", args })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    count: vi.fn((...args: unknown[]) => ({ type: "count", args })),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: { getUser: mockGetUser },
    })),
  }));

  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: vi.fn() }));
  vi.doMock("@/lib/zoho", () => ({
    upsertZohoContact: vi.fn(),
    createZohoContact: vi.fn(),
    updateZohoContact: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-campaigns", () => ({
    syncCampaignsSubscriber: vi.fn(),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

  vi.doMock("next/headers", () => ({
    cookies: vi.fn(async () => ({
      get: mockGetCookie,
      delete: mockDeleteCookie,
    })),
  }));

  // Email templates — return null (React element not needed for tests)
  vi.doMock("@/emails/WelcomeEmail", () => ({ WelcomeEmail: vi.fn().mockReturnValue(null) }));
  vi.doMock("@/emails/LoyaltyPointsAwarded", () => ({
    LoyaltyPointsAwarded: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("@/emails/ReferralBonus", () => ({ ReferralBonus: vi.fn().mockReturnValue(null) }));
}

/* ------------------------------------------------------------------ */
/*  Minimal valid client input factory                                 */
/* ------------------------------------------------------------------ */

function makeClientInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "",
    source: "instagram" as const,
    notifications: { sms: false, email: false, marketing: false },
    interests: ["lash"] as const,
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

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("saveOnboardingData (client) — referral & loyalty integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    mockGetCookie.mockReturnValue(undefined);
    mockSendEmail.mockResolvedValue(true);
  });

  /* ---------------------------------------------------------------- */
  it("inserts loyalty transaction for profile completion", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No referralCode in input → referrer lookup SELECT is skipped entirely.
    // Only one select fires: inside the transaction to check alreadyAwarded → empty.
    db._queue([]);

    setupMocks(db);
    const { saveOnboardingData } = await import("./actions");

    await saveOnboardingData(makeClientInput(), "client");

    expect(db._loyalty.length).toBeGreaterThanOrEqual(1);
    expect(db._loyalty.some((row: MockRow) => row.type === "profile_complete")).toBe(true);
  });

  /* ---------------------------------------------------------------- */
  it("awards referral bonus when valid referralCode provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Call 1: referrer lookup by code → referrer found
    db._queue([{ id: "referrer-1", firstName: "Alice" }]);
    // Call 2 (inside tx): existing loyalty_tx check → not yet awarded
    db._queue([]);
    // Call 3 (post-tx, email block): re-fetch referrer profile for email
    db._queue([{ id: "referrer-1", email: "alice@example.com", firstName: "Alice", notifyEmail: true }]);

    setupMocks(db);
    const { saveOnboardingData } = await import("./actions");

    await saveOnboardingData(
      makeClientInput({ referral: { referrerCode: "ALICE-123456", skipped: false } }),
      "client",
    );

    // Referrer should have received a referral_referrer transaction
    const referrerTx = db._loyalty.find(
      (row: MockRow) => row.type === "referral_referrer" && row.profileId === "referrer-1",
    );
    expect(referrerTx).toBeDefined();
    expect(referrerTx).toMatchObject({
      profileId: "referrer-1",
      points: 100,
      type: "referral_referrer",
    });

    // New client should also have a referral_referee transaction
    const refereeTx = db._loyalty.find(
      (row: MockRow) => row.type === "referral_referee" && row.profileId === "client-1",
    );
    expect(refereeTx).toBeDefined();
    expect(refereeTx).toMatchObject({
      profileId: "client-1",
      points: 100,
      type: "referral_referee",
    });
  });

  /* ---------------------------------------------------------------- */
  it("does not double-award if profile_complete already exists", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No referralCode in input → the referrer lookup SELECT is skipped entirely.
    // Only one select fires: inside the transaction to check for alreadyAwarded.
    db._queue([{ id: "tx-1", type: "profile_complete" }]);

    setupMocks(db);
    const { saveOnboardingData } = await import("./actions");

    await saveOnboardingData(makeClientInput(), "client");

    // Transaction callback returns early after finding alreadyAwarded — no new inserts
    expect(db._loyalty).toHaveLength(0);
  });

  /* ---------------------------------------------------------------- */
  it("awards birthday bonus when birthday is provided", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No referralCode in input → referrer lookup SELECT is skipped entirely.
    // Only one select fires: inside the transaction to check alreadyAwarded → empty.
    db._queue([]);

    setupMocks(db);
    const { saveOnboardingData } = await import("./actions");

    await saveOnboardingData(
      makeClientInput({ birthday: "05/15" }),
      "client",
    );

    expect(db._loyalty.some((row: MockRow) => row.type === "birthday_added")).toBe(true);
    const birthdayTx = db._loyalty.find((row: MockRow) => row.type === "birthday_added");
    expect(birthdayTx).toMatchObject({
      profileId: "client-1",
      points: 50,
      type: "birthday_added",
      description: "Added birthday",
    });
  });
});
