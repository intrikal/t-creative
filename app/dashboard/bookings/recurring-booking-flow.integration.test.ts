import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the recurring booking generation flow.
 *
 * Triggers `generateNextRecurringBooking` indirectly via
 * `updateBookingStatus(id, "completed")` and verifies FINAL STATE in
 * the stateful mock DB:
 *
 * Flow A — subscription with sessions remaining: new booking created,
 *           sessionsUsed incremented
 * Flow B — subscription on last session: subscription marked completed,
 *           no new booking inserted
 * Flow C — RRULE (weekly): new booking created 7 days after original
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const subscriptionsTable: MockRow[] = [];
  const paymentsTable: MockRow[] = [];
  const invoicesTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];

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
    _payments: paymentsTable,
    _invoices: invoicesTable,
    _notifications: notificationsTable,
    _syncLog: syncLogTable,

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

        // Route inserts: bookings have startsAt; subscriptions have totalSessions
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
          // Route updates: subscription updates carry sessionsUsed
          if ("sessionsUsed" in values) {
            if (subscriptionsTable.length > 0) {
              Object.assign(subscriptionsTable[0], values);
            }
          } else if ("status" in values && "completedAt" in values) {
            // booking status update — no state tracking needed here
          }
          return Promise.resolve();
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),
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
    },
    services: { id: "id", name: "name", category: "category", depositInCents: "depositInCents" },
    profiles: {
      id: "id",
      firstName: "firstName",
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
      method: "method",
      status: "status",
      squarePaymentId: "squarePaymentId",
      squareOrderId: "squareOrderId",
      squareReceiptUrl: "squareReceiptUrl",
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
    syncLog: { provider: "provider", direction: "direction", status: "status" },
    bookingAddOns: { bookingId: "bookingId" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
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
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    squareClient: {},
  }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: vi.fn(), updateZohoDeal: vi.fn() }));
  vi.doMock("@/lib/zoho-crm", () => ({
    createZohoContact: vi.fn(),
    updateZohoContact: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({
    createZohoBooksInvoice: vi.fn(),
    recordZohoBooksPayment: vi.fn(),
  }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
    }),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
  vi.doMock("./waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Recurring booking generation flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
  });

  /* --- Flow A: subscription with sessions remaining → new booking created --- */

  it("Flow A: creates next booking when subscription has sessions remaining", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed subscription state so the update handler can mutate it
    db._subscriptions.push({
      id: 3,
      sessionsUsed: 1,
      totalSessions: 5,
      intervalDays: 14,
      status: "active",
    });

    // 1. trySendBookingStatusEmail("completed"): statusClient + services join
    db._queue([]);

    // 2. generateNextRecurringBooking: SELECT booking details
    db._queue([
      {
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
      },
    ]);

    // 3. generateNextRecurringBooking: SELECT subscription
    db._queue([
      {
        id: 3,
        sessionsUsed: 1,
        totalSessions: 5,
        intervalDays: 14,
        status: "active",
      },
    ]);

    // 4. generateNextRecurringBooking (subscription path): SELECT for recurring
    //    confirmation email (recurClient + services join) — non-fatal, return []
    db._queue([]);

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(5, "completed");

    // New booking inserted with correct linkage
    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0]).toMatchObject({
      clientId: "client-1",
      serviceId: 2,
      parentBookingId: 5,
      subscriptionId: 3,
      status: "confirmed",
    });

    // sessionsUsed incremented from 1 → 2
    expect(db._subscriptions[0].sessionsUsed).toBe(2);
    // status must remain active (not exhausted)
    expect(db._subscriptions[0].status).not.toBe("completed");
  });

  /* --- Flow B: last session used → subscription marked completed, no new booking --- */

  it("Flow B: marks subscription completed when last session is used", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed subscription state for update tracking
    db._subscriptions.push({
      id: 3,
      sessionsUsed: 4,
      totalSessions: 5,
      intervalDays: 14,
      status: "active",
    });

    // 1. trySendBookingStatusEmail("completed")
    db._queue([]);

    // 2. generateNextRecurringBooking: SELECT booking details
    db._queue([
      {
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
      },
    ]);

    // 3. generateNextRecurringBooking: SELECT subscription (sessionsUsed=4, totalSessions=5)
    //    newSessionsUsed = 5 >= 5 → exhausted path
    db._queue([
      {
        id: 3,
        sessionsUsed: 4,
        totalSessions: 5,
        intervalDays: 14,
        status: "active",
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(5, "completed");

    // No new booking should be created
    expect(db._bookings).toHaveLength(0);

    // Subscription should be marked completed and sessionsUsed set to 5
    expect(db._subscriptions[0].status).toBe("completed");
    expect(db._subscriptions[0].sessionsUsed).toBe(5);
  });

  /* --- Flow C: RRULE weekly path → new booking 7 days later --- */

  it("Flow C: creates next booking 7 days later via RRULE weekly recurrence", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const originalStart = new Date("2026-03-18T10:00:00");

    // 1. trySendBookingStatusEmail("completed")
    db._queue([]);

    // 2. generateNextRecurringBooking: SELECT booking details (RRULE, no subscriptionId)
    db._queue([
      {
        id: 5,
        clientId: "client-1",
        serviceId: 2,
        staffId: null,
        startsAt: originalStart,
        durationMinutes: 60,
        totalInCents: 8000,
        location: null,
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
        parentBookingId: null,
        subscriptionId: null,
      },
    ]);

    // 3. generateNextRecurringBooking (RRULE path): SELECT for recurring confirmation
    //    email (recurClient + services join) — non-fatal, return []
    db._queue([]);

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(5, "completed");

    // New booking inserted
    expect(db._bookings).toHaveLength(1);
    const newBooking = db._bookings[0];

    // Links back to original booking as series root
    expect(newBooking.parentBookingId).toBe(5);

    // Carries the same recurrence rule forward
    expect(newBooking.recurrenceRule).toBe("FREQ=WEEKLY;INTERVAL=1");

    // startsAt is exactly 7 days after the original
    const expectedStart = new Date(originalStart);
    expectedStart.setDate(expectedStart.getDate() + 7);
    expect((newBooking.startsAt as Date).getTime()).toBe(expectedStart.getTime());
  });
});
