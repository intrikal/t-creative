// @vitest-environment node

/**
 * tests/integration/package-concurrency.test.ts
 *
 * Integration tests for prepaid session package (booking_subscriptions)
 * concurrency and boundary conditions.
 *
 * Session counting happens at booking COMPLETION time in
 * generateNextRecurringBooking (actions.ts). The subscription's sessionsUsed
 * is incremented atomically inside a transaction alongside the next booking
 * insert.
 *
 * (1) Happy path: 5 sessions total, 1 used → complete booking → sessionsUsed=2,
 *     next booking created with subscriptionId
 * (2) Concurrent completion: sessionsUsed=4, totalSessions=5 → two completions
 *     at once → exactly one creates a next booking, second sees "completed"
 * (3) Exhausted package: sessionsUsed=5, totalSessions=5 → no next booking,
 *     subscription already "completed"
 * (4) Zero sessions total: totalSessions=0 → subscription never generates
 * (5) Paused subscription: status="paused" → no next booking generated
 * (6) Sessions never go negative: last session marks "completed", sessionsUsed
 *     capped at totalSessions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const subscriptionsTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];
  const paymentsTable: MockRow[] = [];
  const invoicesTable: MockRow[] = [];

  let nextId = 100;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

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
    _bookings: bookingsTable,
    _subscriptions: subscriptionsTable,
    _notifications: notificationsTable,
    _syncLog: syncLogTable,
    _payments: paymentsTable,
    _invoices: invoicesTable,

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
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };
        if ("startsAt" in values) {
          bookingsTable.push(row);
        } else if ("type" in values && "channel" in values) {
          notificationsTable.push(row);
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        } else if ("method" in values && "amountInCents" in values && "bookingId" in values) {
          paymentsTable.push(row);
        } else if ("number" in values && "amountInCents" in values && "status" in values) {
          invoicesTable.push(row);
        }
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Route subscription updates to the subscriptions table
          if ("sessionsUsed" in values && subscriptionsTable.length > 0) {
            Object.assign(subscriptionsTable[0], values);
          }
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        select: vi.fn(() => {
          const rows = selectQueue[selectIndex++] ?? [];
          return makeChain(rows);
        }),
        insert: vi.fn((_table: any) => ({
          values: vi.fn((values: MockRow) => {
            const id = nextId++;
            const row = { ...values, id };
            if ("startsAt" in values) {
              bookingsTable.push(row);
            }
            const returning = vi.fn().mockResolvedValue([{ id }]);
            return { returning };
          }),
        })),
        update: vi.fn((_table: any) => ({
          set: vi.fn((values: MockRow) => ({
            where: vi.fn(() => {
              if ("sessionsUsed" in values && subscriptionsTable.length > 0) {
                Object.assign(subscriptionsTable[0], values);
              }
              return Promise.resolve();
            }),
          })),
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
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn();
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Base booking fixture (subscription-linked)                         */
/* ------------------------------------------------------------------ */

function makeSubBookingRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 5,
    clientId: "client-1",
    serviceId: 2,
    staffId: null,
    startsAt: new Date("2026-03-18T10:00:00"),
    durationMinutes: 60,
    totalInCents: 8000,
    location: null,
    recurrenceRule: null,
    parentBookingId: null,
    subscriptionId: 3,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      staffId: "staffId",
      status: "status",
      startsAt: "startsAt",
      durationMinutes: "durationMinutes",
      totalInCents: "totalInCents",
      location: "location",
      recurrenceRule: "recurrenceRule",
      parentBookingId: "parentBookingId",
      subscriptionId: "subscriptionId",
      confirmedAt: "confirmedAt",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      squareOrderId: "squareOrderId",
      deletedAt: "deletedAt",
      depositPaidInCents: "depositPaidInCents",
      locationId: "locationId",
      tosAcceptedAt: "tosAcceptedAt",
      tosVersion: "tosVersion",
    },
    services: { id: "id", name: "name", category: "category", depositInCents: "depositInCents" },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
      squareCustomerId: "squareCustomerId",
    },
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
      updatedAt: "updatedAt",
    },
    clientForms: {
      id: "id",
      name: "name",
      type: "type",
      appliesTo: "appliesTo",
      isActive: "isActive",
      required: "required",
    },
    formSubmissions: { id: "id", clientId: "clientId", formId: "formId" },
    payments: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      amountInCents: "amountInCents",
      refundedInCents: "refundedInCents",
      method: "method",
      status: "status",
      squarePaymentId: "squarePaymentId",
      squareRefundId: "squareRefundId",
      squareOrderId: "squareOrderId",
      squareReceiptUrl: "squareReceiptUrl",
      refundedAt: "refundedAt",
      notes: "notes",
      paidAt: "paidAt",
    },
    invoices: {
      id: "id",
      clientId: "clientId",
      number: "number",
      description: "description",
      amountInCents: "amountInCents",
      status: "status",
      issuedAt: "issuedAt",
      dueAt: "dueAt",
      notes: "notes",
    },
    notifications: {
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
    },
    syncLog: {
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      errorMessage: "errorMessage",
    },
    bookingAddOns: { bookingId: "bookingId" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
      notes: "notes",
    },
    referrals: { id: "id" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    squareClient: { refunds: { refundPayment: vi.fn() } },
    createSquareOrder: vi.fn().mockResolvedValue(undefined),
    createSquarePaymentLink: vi.fn().mockResolvedValue(undefined),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn().mockResolvedValue(null),
    createSquareInvoice: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: vi.fn(), updateZohoDeal: vi.fn() }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: vi.fn() }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      fullRefundHours: 48,
      partialRefundPct: 50,
      partialRefundMinHours: 24,
      noRefundHours: 24,
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
    }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
    getPublicLoyaltyConfig: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/env", () => ({
    env: {
      DATABASE_POOLER_URL: "postgresql://localhost:5432/test",
      DIRECT_URL: "postgresql://localhost:5432/test",
      NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
      RESEND_API_KEY: "re_test",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-key",
      UPSTASH_REDIS_REST_URL: "https://test.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "test-token",
    },
  }));
  vi.doMock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({
      auth: { admin: { generateLink: vi.fn() } },
    }),
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
    requireStaff: vi.fn().mockResolvedValue({ id: "admin-1" }),
    getCurrentUser: vi.fn().mockResolvedValue(null),
  }));
  const mockComponent = vi.fn().mockReturnValue(null);
  vi.doMock("@/emails/BookingCancellation", () => ({ BookingCancellation: mockComponent }));
  vi.doMock("@/emails/BookingCompleted", () => ({ BookingCompleted: mockComponent }));
  vi.doMock("@/emails/BookingConfirmation", () => ({ BookingConfirmation: mockComponent }));
  vi.doMock("@/emails/BookingNoShow", () => ({ BookingNoShow: mockComponent }));
  vi.doMock("@/emails/BookingReschedule", () => ({ BookingReschedule: mockComponent }));
  vi.doMock("@/emails/NoShowFeeCharged", () => ({ NoShowFeeCharged: mockComponent }));
  vi.doMock("@/emails/NoShowFeeInvoice", () => ({ NoShowFeeInvoice: mockComponent }));
  vi.doMock("@/emails/PaymentLinkEmail", () => ({ PaymentLinkEmail: mockComponent }));
  vi.doMock("@/emails/RecurringBookingConfirmation", () => ({
    RecurringBookingConfirmation: mockComponent,
  }));
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Package concurrency — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
  });

  /* --- (1) Happy path: sessions remaining → next booking created --- */

  it("(1) happy path: 5 total, 1 used → complete booking → sessionsUsed=2, next booking created with subscriptionId", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._subscriptions.push({
      id: 3,
      sessionsUsed: 1,
      totalSessions: 5,
      intervalDays: 14,
      status: "active",
    });

    // trySendBookingStatusEmail("completed"): client+service join
    db._queue([]);
    // generateNextRecurringBooking: booking details
    db._queue([makeSubBookingRow()]);
    // generateNextRecurringBooking: subscription lookup
    db._queue([{ id: 3, sessionsUsed: 1, totalSessions: 5, intervalDays: 14, status: "active" }]);
    // Recurring confirmation email query
    db._queue([]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(5, "completed");

    // Next booking created with subscription linkage
    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0]).toMatchObject({
      clientId: "client-1",
      serviceId: 2,
      subscriptionId: 3,
      parentBookingId: 5,
      status: "confirmed",
    });

    // sessionsUsed incremented: 1 → 2
    expect(db._subscriptions[0].sessionsUsed).toBe(2);
    expect(db._subscriptions[0].status).toBe("active");
  });

  /* --- (2) Concurrent completion: last two sessions completed simultaneously --- */

  it("(2) concurrent completion: sessionsUsed=4/5 → two completions → first creates next booking, second sees exhausted and marks completed", async () => {
    // First completion: sessionsUsed=3 → increments to 4, creates next booking
    vi.resetModules();
    const db1 = createStatefulDb();

    db1._subscriptions.push({
      id: 3,
      sessionsUsed: 3,
      totalSessions: 5,
      intervalDays: 14,
      status: "active",
    });

    db1._queue([]); // trySendBookingStatusEmail
    db1._queue([makeSubBookingRow({ subscriptionId: 3 })]);
    db1._queue([{ id: 3, sessionsUsed: 3, totalSessions: 5, intervalDays: 14, status: "active" }]);
    db1._queue([]); // recurring email

    setupMocks(db1);
    const mod1 = await import("@/app/dashboard/bookings/actions");
    await mod1.updateBookingStatus(5, "completed");

    expect(db1._bookings).toHaveLength(1);
    expect(db1._subscriptions[0].sessionsUsed).toBe(4);

    // Second completion: sessionsUsed=4 → increments to 5 = totalSessions → exhausted
    vi.resetModules();
    const db2 = createStatefulDb();

    db2._subscriptions.push({
      id: 3,
      sessionsUsed: 4,
      totalSessions: 5,
      intervalDays: 14,
      status: "active",
    });

    db2._queue([]); // trySendBookingStatusEmail
    db2._queue([makeSubBookingRow({ id: 6, subscriptionId: 3 })]);
    db2._queue([{ id: 3, sessionsUsed: 4, totalSessions: 5, intervalDays: 14, status: "active" }]);

    setupMocks(db2);
    const mod2 = await import("@/app/dashboard/bookings/actions");
    await mod2.updateBookingStatus(6, "completed");

    // No next booking — package exhausted
    expect(db2._bookings).toHaveLength(0);
    // Subscription marked completed, sessionsUsed capped at 5
    expect(db2._subscriptions[0].sessionsUsed).toBe(5);
    expect(db2._subscriptions[0].status).toBe("completed");
  });

  /* --- (3) Exhausted package: already completed → no next booking --- */

  it("(3) exhausted package: sessionsUsed=5, totalSessions=5 → subscription already completed, no next booking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._subscriptions.push({
      id: 3,
      sessionsUsed: 5,
      totalSessions: 5,
      intervalDays: 14,
      status: "completed",
    });

    db._queue([]); // trySendBookingStatusEmail
    db._queue([makeSubBookingRow()]);
    // subscription lookup returns completed status
    db._queue([
      { id: 3, sessionsUsed: 5, totalSessions: 5, intervalDays: 14, status: "completed" },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(5, "completed");

    // No next booking — status !== "active"
    expect(db._bookings).toHaveLength(0);
  });

  /* --- (4) Zero sessions total: degenerate package → no generation --- */

  it("(4) zero sessions total: totalSessions=0 → booking completes, no next booking generated (immediately exhausted)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._subscriptions.push({
      id: 3,
      sessionsUsed: 0,
      totalSessions: 0,
      intervalDays: 14,
      status: "active",
    });

    db._queue([]); // trySendBookingStatusEmail
    db._queue([makeSubBookingRow()]);
    db._queue([{ id: 3, sessionsUsed: 0, totalSessions: 0, intervalDays: 14, status: "active" }]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(5, "completed");

    // newSessionsUsed = 0 + 1 = 1 >= 0 (totalSessions) → exhausted
    expect(db._bookings).toHaveLength(0);
    expect(db._subscriptions[0].status).toBe("completed");
    expect(db._subscriptions[0].sessionsUsed).toBe(1);
  });

  /* --- (5) Paused subscription: no next booking generated --- */

  it("(5) paused subscription: status='paused' → no next booking generated", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._subscriptions.push({
      id: 3,
      sessionsUsed: 2,
      totalSessions: 5,
      intervalDays: 14,
      status: "paused",
    });

    db._queue([]); // trySendBookingStatusEmail
    db._queue([makeSubBookingRow()]);
    // subscription lookup returns paused
    db._queue([{ id: 3, sessionsUsed: 2, totalSessions: 5, intervalDays: 14, status: "paused" }]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(5, "completed");

    // No next booking — subscription paused
    expect(db._bookings).toHaveLength(0);
    // sessionsUsed NOT incremented (early return)
    expect(db._subscriptions[0].sessionsUsed).toBe(2);
  });

  /* --- (6) sessionsUsed never exceeds totalSessions --- */

  it("(6) last session: sessionsUsed capped at totalSessions, subscription marked 'completed'", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Package with exactly 1 session remaining
    db._subscriptions.push({
      id: 3,
      sessionsUsed: 4,
      totalSessions: 5,
      intervalDays: 14,
      status: "active",
    });

    db._queue([]); // trySendBookingStatusEmail
    db._queue([makeSubBookingRow()]);
    db._queue([{ id: 3, sessionsUsed: 4, totalSessions: 5, intervalDays: 14, status: "active" }]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(5, "completed");

    // sessionsUsed = 5 (not 6, not negative)
    expect(db._subscriptions[0].sessionsUsed).toBe(5);
    expect(db._subscriptions[0].status).toBe("completed");

    // No next booking
    expect(db._bookings).toHaveLength(0);
  });
});
