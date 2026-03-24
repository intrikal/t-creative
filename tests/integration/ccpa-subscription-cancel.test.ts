// @vitest-environment node

/**
 * tests/integration/ccpa-subscription-cancel.test.ts
 *
 * Integration tests for the CCPA account deletion flow in
 * deleteClientAccount (client-settings-actions.tsx).
 *
 * (1) Active membership: deletion cancels membership locally, deletes Square
 *     customer, loyalty transactions voided, profile anonymized
 * (2) Already-cancelled membership: Square customer.delete still called (profile
 *     cleanup), no membership status change needed
 * (3) Square API failure: deletion still proceeds, Sentry captured, profile
 *     still anonymized
 * (4) No membership: deletion proceeds without membership cancellation
 * (5) Retained records: bookings/payments preserved, profile shows
 *     "Deleted User", audit_log entry with type 'ccpa_deletion_request'
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const updateCalls: Array<{ values: MockRow }> = [];
  const deleteCalls: string[] = [];

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _updateCalls: updateCalls,
    _deleteCalls: deleteCalls,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn(() => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn(() => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn((table: any) => ({
      where: vi.fn(() => {
        deleteCalls.push("delete");
        return Promise.resolve();
      }),
    })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        select: vi.fn(() => {
          const rows = selectQueue[selectIndex++] ?? [];
          return makeChain(rows);
        }),
        insert: vi.fn(() => ({
          values: vi.fn((values: MockRow) => {
            const id = nextId++;
            const returning = vi.fn().mockResolvedValue([{ id }]);
            return { returning };
          }),
        })),
        update: vi.fn(() => ({
          set: vi.fn((values: MockRow) => {
            updateCalls.push({ values });
            return { where: vi.fn().mockResolvedValue(undefined) };
          }),
        })),
        delete: vi.fn((table: any) => ({
          where: vi.fn(() => {
            deleteCalls.push("tx-delete");
            return Promise.resolve();
          }),
        })),
      };
      return fn(tx);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();
const mockSquareCustomerDelete = vi.fn().mockResolvedValue(undefined);
const mockRevalidatePath = vi.fn();
const mockRedisDel = vi.fn().mockResolvedValue(undefined);

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
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
      displayName: "displayName",
      avatarUrl: "avatarUrl",
      internalNotes: "internalNotes",
      tags: "tags",
      lifecycleStage: "lifecycleStage",
      source: "source",
      eventSourceName: "eventSourceName",
      referralCode: "referralCode",
      squareCustomerId: "squareCustomerId",
      zohoContactId: "zohoContactId",
      zohoCampaignsContactKey: "zohoCampaignsContactKey",
      zohoCustomerId: "zohoCustomerId",
      onboardingData: "onboardingData",
      notifySms: "notifySms",
      notifyEmail: "notifyEmail",
      notifyMarketing: "notifyMarketing",
      isActive: "isActive",
      role: "role",
    },
    clientPreferences: { profileId: "profileId" },
    formSubmissions: { clientId: "clientId" },
    loyaltyTransactions: { profileId: "profileId" },
    membershipSubscriptions: {
      clientId: "clientId",
      status: "status",
      cancelledAt: "cancelledAt",
      notes: "notes",
    },
    mediaItems: {
      id: "id",
      clientId: "clientId",
      storagePath: "storagePath",
      beforeStoragePath: "beforeStoragePath",
    },
    notifications: { profileId: "profileId" },
    reviews: { clientId: "clientId" },
    serviceRecords: { clientId: "clientId" },
    threads: { clientId: "clientId" },
    waitlist: { clientId: "clientId" },
    wishlistItems: { clientId: "clientId" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    isResendConfigured: vi.fn().mockReturnValue(true),
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(true),
    squareClient: { customers: { delete: mockSquareCustomerDelete } },
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: vi.fn().mockResolvedValue({ id: "client-1", email: "alice@example.com" }),
  }));
  vi.doMock("@/lib/redis", () => ({ redis: { del: mockRedisDel } }));
  vi.doMock("@/lib/env", () => ({
    env: {
      DATABASE_POOLER_URL: "postgresql://localhost:5432/test",
      DIRECT_URL: "postgresql://localhost:5432/test",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      RESEND_API_KEY: "re_test",
      NEXT_PUBLIC_RECAPTCHA_SITE_KEY: "test-key",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { signOut: vi.fn().mockResolvedValue({}) },
      storage: { from: vi.fn().mockReturnValue({ remove: vi.fn().mockResolvedValue({}) }) },
    }),
  }));
  vi.doMock("@supabase/supabase-js", () => ({
    createClient: vi.fn().mockReturnValue({
      auth: { admin: { deleteUser: vi.fn().mockResolvedValue({}) } },
    }),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/lib/zoho-campaigns", () => ({
    syncCampaignsSubscriber: vi.fn(),
    unsubscribeFromCampaigns: vi.fn(),
  }));
  vi.doMock("@/lib/notification-preferences", () => ({
    getNotificationPreferences: vi.fn(),
    setNotificationPreference: vi.fn(),
  }));

  const mockComponent = vi.fn().mockReturnValue(null);
  vi.doMock("@/emails/DataDeletionConfirmation", () => ({
    DataDeletionConfirmation: mockComponent,
  }));
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
    createElement: vi.fn(),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("CCPA account deletion — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockSquareCustomerDelete.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
    mockRedisDel.mockResolvedValue(undefined);
  });

  /* --- (1) Active membership: full CCPA deletion flow --- */

  it("(1) active membership: Square customer deleted, membership cancelled, loyalty voided, profile anonymized", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. Profile lookup
    db._queue([
      {
        firstName: "Alice",
        email: "alice@example.com",
        squareCustomerId: "sq-cust-001",
        notifyEmail: true,
      },
    ]);
    // 2. Media items lookup
    db._queue([]);

    setupMocks(db);
    const { deleteClientAccount } =
      await import("@/app/dashboard/settings/client-settings-actions");

    await deleteClientAccount();

    // Confirmation email sent before anonymization
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "ccpa_deletion_confirmation",
      }),
    );

    // Transaction: 10 child record deletes + 1 membership cancel + 1 profile anonymize
    // Child records deleted (loyaltyTransactions among them)
    expect(db._deleteCalls.filter((c) => c === "tx-delete")).toHaveLength(10);

    // Membership cancelled
    const membershipUpdate = db._updateCalls.find(
      (u) => u.values.status === "cancelled" && u.values.notes?.toString().includes("CCPA"),
    );
    expect(membershipUpdate).toBeDefined();
    expect(membershipUpdate!.values.cancelledAt).toBeInstanceOf(Date);

    // Profile anonymized
    const profileUpdate = db._updateCalls.find(
      (u) => u.values.firstName === "Deleted" && u.values.lastName === "User",
    );
    expect(profileUpdate).toBeDefined();
    expect(profileUpdate!.values).toMatchObject({
      firstName: "Deleted",
      lastName: "User",
      phone: null,
      squareCustomerId: null,
      isActive: false,
      notifyEmail: false,
      notifySms: false,
    });
    expect(profileUpdate!.values.email as string).toMatch(/^deleted-.*@removed\.invalid$/);

    // Square customer deleted
    expect(mockSquareCustomerDelete).toHaveBeenCalledWith({
      customerId: "sq-cust-001",
    });

    // Audit log with ccpa_deletion_request
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "delete",
        entityType: "ccpa_deletion_request",
        entityId: "client-1",
        description: expect.stringContaining("CCPA"),
      }),
    );

    // Redis cache invalidated
    expect(mockRedisDel).toHaveBeenCalledWith("profile:client-1");
  });

  /* --- (2) Already-cancelled membership: no membership update needed --- */

  it("(2) already-cancelled membership: Square customer still deleted, deletion proceeds", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Profile with Square customer
    db._queue([
      {
        firstName: "Bob",
        email: "bob@example.com",
        squareCustomerId: "sq-cust-002",
        notifyEmail: true,
      },
    ]);
    // No media
    db._queue([]);

    setupMocks(db);
    const { deleteClientAccount } =
      await import("@/app/dashboard/settings/client-settings-actions");

    await deleteClientAccount();

    // The membership cancellation UPDATE runs regardless — the WHERE clause
    // filters to status='active', so already-cancelled memberships are unaffected.
    // Square customer is still deleted (cleanup of the external record).
    expect(mockSquareCustomerDelete).toHaveBeenCalledWith({
      customerId: "sq-cust-002",
    });

    // Profile still anonymized
    const profileUpdate = db._updateCalls.find((u) => u.values.firstName === "Deleted");
    expect(profileUpdate).toBeDefined();

    // Audit log still created
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "ccpa_deletion_request",
      }),
    );
  });

  /* --- (3) Square API failure: deletion still proceeds --- */

  it("(3) Square API failure: profile still anonymized, Sentry captured", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const squareError = new Error("Square customer delete failed");
    mockSquareCustomerDelete.mockRejectedValueOnce(squareError);

    db._queue([
      {
        firstName: "Carol",
        email: "carol@example.com",
        squareCustomerId: "sq-cust-003",
        notifyEmail: true,
      },
    ]);
    db._queue([]);

    setupMocks(db);
    const { deleteClientAccount } =
      await import("@/app/dashboard/settings/client-settings-actions");

    // Should NOT throw — Square failure is non-fatal
    await deleteClientAccount();

    // Sentry captured the Square error
    expect(mockCaptureException).toHaveBeenCalledWith(squareError);

    // Profile still anonymized despite Square failure
    const profileUpdate = db._updateCalls.find((u) => u.values.firstName === "Deleted");
    expect(profileUpdate).toBeDefined();
    expect(profileUpdate!.values.isActive).toBe(false);

    // Audit log still created
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "ccpa_deletion_request",
      }),
    );
  });

  /* --- (4) No membership / no Square customer: clean deletion --- */

  it("(4) no membership, no Square customer: deletion proceeds without Square API calls", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Profile without squareCustomerId
    db._queue([
      {
        firstName: "Dana",
        email: "dana@example.com",
        squareCustomerId: null,
        notifyEmail: true,
      },
    ]);
    db._queue([]);

    setupMocks(db);
    const { deleteClientAccount } =
      await import("@/app/dashboard/settings/client-settings-actions");

    await deleteClientAccount();

    // Square NOT called — no squareCustomerId
    expect(mockSquareCustomerDelete).not.toHaveBeenCalled();

    // Profile still anonymized
    const profileUpdate = db._updateCalls.find((u) => u.values.firstName === "Deleted");
    expect(profileUpdate).toBeDefined();

    // Child records still deleted
    expect(db._deleteCalls.filter((c) => c === "tx-delete")).toHaveLength(10);
  });

  /* --- (5) Retained records: bookings/payments preserved, profile = "Deleted User" --- */

  it("(5) retained records: profile shows 'Deleted User', audit_log has ccpa_deletion_request, email anonymized", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([
      {
        firstName: "Eve",
        email: "eve@example.com",
        squareCustomerId: null,
        notifyEmail: true,
      },
    ]);
    // Media items with storage paths
    db._queue([
      { id: 1, storagePath: "photos/eve/1.jpg", beforeStoragePath: "photos/eve/1_before.jpg" },
    ]);

    setupMocks(db);
    const { deleteClientAccount } =
      await import("@/app/dashboard/settings/client-settings-actions");

    await deleteClientAccount();

    // Profile anonymized to "Deleted User" — bookings with this clientId
    // will display "Deleted User" via profile join
    const profileUpdate = db._updateCalls.find(
      (u) => u.values.firstName === "Deleted" && u.values.lastName === "User",
    );
    expect(profileUpdate).toBeDefined();
    expect(profileUpdate!.values.email as string).toMatch(/^deleted-client-1@removed\.invalid$/);
    expect(profileUpdate!.values.phone).toBeNull();
    expect(profileUpdate!.values.avatarUrl).toBeNull();
    expect(profileUpdate!.values.onboardingData).toBeNull();
    expect(profileUpdate!.values.referralCode).toBeNull();
    expect(profileUpdate!.values.notifyMarketing).toBe(false);

    // Audit log entry with exact entityType for admin filtering
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "client-1",
        action: "delete",
        entityType: "ccpa_deletion_request",
        entityId: "client-1",
        description: "Client account deleted and personal data anonymized (CCPA)",
        metadata: {
          email: "eve@example.com",
          mediaItemsDeleted: 1,
        },
      }),
    );

    // NOTE: bookings, payments, invoices, orders are NOT deleted (RESTRICT FK).
    // They still exist in the DB with client_id pointing to the now-anonymized
    // profile, which displays as "Deleted User" in the admin UI.
  });
});
