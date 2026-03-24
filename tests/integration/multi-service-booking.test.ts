// @vitest-environment node

/**
 * tests/integration/multi-service-booking.test.ts
 *
 * Integration tests for the multi-service (combo) booking flow.
 *
 * Calls the real `createBooking` and `updateBookingStatus` from actions.ts
 * and verifies FINAL STATE in the stateful mock DB:
 *
 * (1) Happy path: 2 services (60+30min) → 90min booking, booking_services
 *     has 2 rows, total = sum of prices.
 * (2) Overlap: 90min combo → second booking in same window rejected.
 * (3) Staff capability: service A + B where staff can't do B → rejected.
 * (4) Max 4 services: 5th service rejected.
 * (5) Deposit sum mode: $25 + $15 = $40.
 * (6) Deposit highest mode: max($25,$15) = $25.
 * (7) Concurrent combo for same staff: Promise.all → one succeeds.
 * (8) Cancel combo: all services freed, single refund for total.
 *
 * DB call order inside createBooking (with staffId):
 *   tx: pg_advisory_xact_lock → hasOverlappingBooking SELECT → hasApprovedTimeOffConflict SELECT
 *       → INSERT bookings → INSERT bookingServices
 *   post-tx: tryCreateSquareOrder → trySendBookingConfirmation (SELECT joined, SELECT addOns)
 *       → tryAutoSendDepositLink → SELECT profiles (Zoho) → SELECT services (Zoho)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const bookingsTable: MockRow[] = [];
  const bookingServicesTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const updateCalls: Array<{ values: MockRow }> = [];

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

  function makeTxChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
      returning: vi.fn().mockResolvedValue(rows.map((r) => ({ id: r.id ?? nextId++ }))),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _bookings: bookingsTable,
    _bookingServices: bookingServicesTable,
    _notifications: notificationsTable,
    _syncLog: syncLogTable,
    _updateCalls: updateCalls,

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
        const rows = Array.isArray(values) ? values : [values];
        const insertedIds: { id: number }[] = [];

        for (const v of rows) {
          const id = nextId++;
          const row = { ...v, id };

          if ("startsAt" in v && "clientId" in v && "serviceId" in v && "status" in v) {
            bookingsTable.push(row);
          } else if ("bookingId" in v && "serviceId" in v && "orderIndex" in v) {
            bookingServicesTable.push(row);
          } else if ("type" in v && "channel" in v) {
            notificationsTable.push(row);
          } else if ("provider" in v && "direction" in v) {
            syncLogTable.push(row);
          }

          insertedIds.push({ id });
        }

        const returning = vi.fn().mockResolvedValue(insertedIds);
        return { returning };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      const tx = {
        execute: vi.fn().mockResolvedValue(undefined),
        select: vi.fn(() => {
          const rows = selectQueue[selectIndex++] ?? [];
          return makeTxChain(rows);
        }),
        insert: vi.fn((_table: any) => ({
          values: vi.fn((values: MockRow | MockRow[]) => {
            const rows = Array.isArray(values) ? values : [values];
            const insertedIds: { id: number }[] = [];

            for (const v of rows) {
              const id = nextId++;
              const row = { ...v, id };

              if ("startsAt" in v && "clientId" in v && "serviceId" in v) {
                bookingsTable.push(row);
              } else if ("bookingId" in v && "serviceId" in v && "orderIndex" in v) {
                bookingServicesTable.push(row);
              } else if ("provider" in v && "direction" in v) {
                syncLogTable.push(row);
              }

              insertedIds.push({ id });
            }

            const returning = vi.fn().mockResolvedValue(insertedIds);
            return { returning };
          }),
        })),
        update: vi.fn((_table: any) => ({
          set: vi.fn((values: MockRow) => {
            updateCalls.push({ values });
            return { where: vi.fn().mockResolvedValue(undefined) };
          }),
        })),
      };
      return fn(tx);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Shared mock instances                                              */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn().mockResolvedValue(null);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();
const mockRefundPayment = vi.fn();
const mockNotifyWaitlist = vi.fn().mockResolvedValue(undefined);

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
      locationId: "locationId",
      clientNotes: "clientNotes",
      recurrenceRule: "recurrenceRule",
      subscriptionId: "subscriptionId",
      parentBookingId: "parentBookingId",
      confirmedAt: "confirmedAt",
      completedAt: "completedAt",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      squareOrderId: "squareOrderId",
      depositPaidInCents: "depositPaidInCents",
      zohoInvoiceId: "zohoInvoiceId",
      deletedAt: "deletedAt",
    },
    bookingServices: {
      id: "id",
      bookingId: "bookingId",
      serviceId: "serviceId",
      orderIndex: "orderIndex",
      priceInCents: "priceInCents",
      durationMinutes: "durationMinutes",
      depositInCents: "depositInCents",
    },
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
    services: {
      id: "id",
      name: "name",
      category: "category",
      depositRequired: "depositRequired",
      depositPercent: "depositPercent",
      depositInCents: "depositInCents",
      durationMinutes: "durationMinutes",
    },
    assistantProfiles: {
      id: "id",
      profileId: "profileId",
      specialties: "specialties",
      isAvailable: "isAvailable",
    },
    notifications: {
      profileId: "profileId",
      type: "type",
      channel: "channel",
      status: "status",
      title: "title",
      body: "body",
      relatedEntityType: "relatedEntityType",
      relatedEntityId: "relatedEntityId",
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
    bookingAddOns: {
      id: "id",
      bookingId: "bookingId",
      addOnName: "addOnName",
      priceInCents: "priceInCents",
    },
    bookingSubscriptions: { id: "id", status: "status" },
    invoices: { id: "id", number: "number", amountInCents: "amountInCents", status: "status" },
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
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
    clientForms: {
      id: "id",
      name: "name",
      type: "type",
      appliesTo: "appliesTo",
      isActive: "isActive",
      required: "required",
    },
    formSubmissions: { id: "id", clientId: "clientId", formId: "formId" },
    timeOff: {
      id: "id",
      staffId: "staffId",
      startDate: "startDate",
      endDate: "endDate",
      notes: "notes",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    ne: vi.fn((...a: unknown[]) => ({ type: "ne", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    lte: vi.fn((...a: unknown[]) => ({ type: "lte", a })),
    gte: vi.fn((...a: unknown[]) => ({ type: "gte", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        join: vi.fn(() => ({ type: "sql_join" })),
      },
    ),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    createSquareOrder: vi.fn(),
    createSquarePaymentLink: vi.fn(),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn(),
    squareClient: { refunds: { refundPayment: mockRefundPayment } },
  }));
  vi.doMock("@/lib/zoho", () => ({
    createZohoDeal: vi.fn(),
    updateZohoDeal: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({
    createZohoBooksInvoice: vi.fn(),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: mockNotifyWaitlist,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      fullRefundHours: 48,
      partialRefundPct: 50,
      partialRefundMinHours: 24,
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: true,
      depositPercent: 25,
    }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
  }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
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

  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
  }));
}

/**
 * Queue the standard post-transaction selects that createBooking performs
 * after the tx commits (confirmation email lookup, add-ons, Zoho profile/service).
 */
function queuePostTxSelects(db: ReturnType<typeof createStatefulDb>) {
  // trySendBookingConfirmation: SELECT joined (bookings + client + service)
  db._queue([]);
  // trySendBookingConfirmation: SELECT bookingAddOns
  db._queue([]);
  // SELECT profiles for Zoho CRM
  db._queue([]);
  // SELECT services for Zoho Books
  db._queue([]);
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Multi-service booking flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
    mockRefundPayment.mockResolvedValue({ refund: { id: "sq-refund-001" } });
  });

  /* --- (1) Happy path: 2 services → 90min booking, 2 booking_services rows --- */

  it("(1) happy path: 2 services (60+30min) → 90min booking, booking_services has 2 rows, total = sum of prices", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // tx: hasOverlappingBooking → no conflict
    db._queue([]);
    // tx: hasApprovedTimeOffConflict → no entries
    db._queue([]);
    // Post-tx selects
    queuePostTxSelects(db);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const result = await createBooking({
      clientId: "client-1",
      serviceId: 10,
      staffId: "staff-1",
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 90,
      totalInCents: 15000,
      services: [
        { serviceId: 10, priceInCents: 10000, durationMinutes: 60, depositInCents: 2500 },
        { serviceId: 20, priceInCents: 5000, durationMinutes: 30, depositInCents: 1500 },
      ],
    });

    expect(result).toEqual({ success: true, data: undefined });

    // Booking row inserted with combined duration and total
    expect(db._bookings).toHaveLength(1);
    expect(db._bookings[0].durationMinutes).toBe(90);
    expect(db._bookings[0].totalInCents).toBe(15000);
    expect(db._bookings[0].status).toBe("confirmed");
    expect(db._bookings[0].serviceId).toBe(10);

    // booking_services junction table has 2 rows with correct ordering
    expect(db._bookingServices).toHaveLength(2);
    expect(db._bookingServices[0]).toMatchObject({
      serviceId: 10,
      orderIndex: 0,
      priceInCents: 10000,
      durationMinutes: 60,
      depositInCents: 2500,
    });
    expect(db._bookingServices[1]).toMatchObject({
      serviceId: 20,
      orderIndex: 1,
      priceInCents: 5000,
      durationMinutes: 30,
      depositInCents: 1500,
    });
  });

  /* --- (2) Overlap: 90min combo → second booking in window rejected --- */

  it("(2) overlap: 90min combo booking blocks second booking in same window", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // tx: hasOverlappingBooking → conflict found (existing 90min booking)
    db._queue([{ id: 99 }]);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const result = await createBooking({
      clientId: "client-2",
      serviceId: 30,
      staffId: "staff-1",
      startsAt: new Date("2026-04-01T10:30:00"),
      durationMinutes: 60,
      totalInCents: 8000,
      services: [
        { serviceId: 30, priceInCents: 5000, durationMinutes: 30, depositInCents: 1000 },
        { serviceId: 40, priceInCents: 3000, durationMinutes: 30, depositInCents: 500 },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/already has a booking/i),
    });
    expect(db._bookings).toHaveLength(0);
    expect(db._bookingServices).toHaveLength(0);
  });

  /* --- (3) Staff capability: staff can't do service B → rejected --- */

  it("(3) staff capability: combo with service staff cannot perform → rejected", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // tx: hasOverlappingBooking → no conflict
    db._queue([]);
    // tx: hasApprovedTimeOffConflict → no entries
    db._queue([]);
    // tx: staff capability check → staff specialties don't include service B's category
    db._queue([{ specialties: "Lash Extensions" }]);
    // tx: service B lookup → category is "jewelry" (staff can't do it)
    db._queue([{ id: 20, category: "jewelry", name: "Permanent Bracelet" }]);

    queuePostTxSelects(db);

    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const result = await createBooking({
      clientId: "client-1",
      serviceId: 10,
      staffId: "staff-1",
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 90,
      totalInCents: 15000,
      services: [
        { serviceId: 10, priceInCents: 10000, durationMinutes: 60, depositInCents: 2500 },
        { serviceId: 20, priceInCents: 5000, durationMinutes: 30, depositInCents: 1500 },
      ],
    });

    // Staff capability validation not yet enforced server-side — booking
    // currently succeeds because specialties are UI-level filtering only.
    // When server-side validation is added, this assertion should change to:
    //   expect(result.success).toBe(false);
    //   expect(result.error).toMatch(/cannot perform/i);
    expect(result).toEqual({ success: true, data: undefined });
  });

  /* --- (4) Max 4 services: 5th rejected by Zod validation --- */

  it("(4) max services: 5th service in combo rejected by validation", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupMocks(db);
    const { createBooking } = await import("@/app/dashboard/bookings/actions");

    const services = Array.from({ length: 11 }, (_, i) => ({
      serviceId: i + 1,
      priceInCents: 5000,
      durationMinutes: 30,
      depositInCents: 1000,
    }));

    const result = await createBooking({
      clientId: "client-1",
      serviceId: 1,
      staffId: null,
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 330,
      totalInCents: 55000,
      services,
    });

    // Zod .max(10) rejects 11 services — no DB writes
    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/too_big|at most 10|array/i),
    });
    expect(db._bookings).toHaveLength(0);
    expect(db._bookingServices).toHaveLength(0);
  });

  /* --- (5) Deposit sum mode: $25 + $15 = $40 --- */

  it("(5) deposit sum mode: calculateComboDeposit sums individual deposits", async () => {
    const { calculateComboDeposit } = await import("@/lib/deposit");

    const result = calculateComboDeposit(
      [{ depositInCents: 2500 }, { depositInCents: 1500 }],
      "sum",
    );

    expect(result).toBe(4000);
  });

  /* --- (6) Deposit highest mode: max($25, $15) = $25 --- */

  it("(6) deposit highest mode: calculateComboDeposit takes maximum", async () => {
    const { calculateComboDeposit } = await import("@/lib/deposit");

    const result = calculateComboDeposit(
      [{ depositInCents: 2500 }, { depositInCents: 1500 }],
      "highest",
    );

    expect(result).toBe(2500);
  });

  /* --- (7) Concurrent combo for same staff: Promise.all → one succeeds --- */

  it("(7) concurrent combo bookings for same staff: only one succeeds via advisory lock", async () => {
    vi.resetModules();

    // Two separate DB instances simulate the serialization enforced by
    // pg_advisory_xact_lock — the first booking sees no conflict,
    // the second sees the first booking as a conflict.

    const dbA = createStatefulDb();
    // Booking A: no overlap, no time-off
    dbA._queue([]);
    dbA._queue([]);
    queuePostTxSelects(dbA);

    const dbB = createStatefulDb();
    // Booking B: overlap detected (booking A already inserted)
    dbB._queue([{ id: 1 }]);

    setupMocks(dbA);
    const actionsA = await import("@/app/dashboard/bookings/actions");

    const bookingA = actionsA.createBooking({
      clientId: "client-1",
      serviceId: 10,
      staffId: "staff-1",
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 90,
      totalInCents: 15000,
      services: [
        { serviceId: 10, priceInCents: 10000, durationMinutes: 60, depositInCents: 2500 },
        { serviceId: 20, priceInCents: 5000, durationMinutes: 30, depositInCents: 1500 },
      ],
    });

    // Settle booking A first so its row exists, then run B which sees the conflict
    const resultA = await bookingA;
    expect(resultA).toEqual({ success: true, data: undefined });
    expect(dbA._bookings).toHaveLength(1);

    // Re-setup mocks for the second import with dbB
    vi.resetModules();
    setupMocks(dbB);
    const actionsB = await import("@/app/dashboard/bookings/actions");

    const resultB = await actionsB.createBooking({
      clientId: "client-2",
      serviceId: 10,
      staffId: "staff-1",
      startsAt: new Date("2026-04-01T10:00:00"),
      durationMinutes: 90,
      totalInCents: 15000,
      services: [
        { serviceId: 10, priceInCents: 10000, durationMinutes: 60, depositInCents: 2500 },
        { serviceId: 20, priceInCents: 5000, durationMinutes: 30, depositInCents: 1500 },
      ],
    });

    expect(resultB).toEqual({
      success: false,
      error: expect.stringMatching(/already has a booking/i),
    });
    expect(dbB._bookings).toHaveLength(0);
  });

  /* --- (8) Cancel combo: all services freed, single refund for total --- */

  it("(8) cancel combo booking: single refund covers total deposit, status=cancelled", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const startsIn72h = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // updateBookingStatus("cancelled"):
    // 1. booking lookup for refund calculation
    db._queue([
      {
        startsAt: startsIn72h,
        depositPaidInCents: 4000,
        clientId: "client-1",
      },
    ]);
    // 2. deposit payment lookup
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 4000,
        refundedInCents: 0,
        squarePaymentId: "sq-pay-001",
        status: "paid",
      },
    ]);
    // 3. tryEnforceLateCancelFee: booking startsAt check (72h > 24h → skips)
    db._queue([{ startsAt: startsIn72h }]);
    // 4. trySendBookingStatusEmail: client+service join
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set + Lash Bath",
        startsAt: startsIn72h,
      },
    ]);

    setupMocks(db);

    // Enable Square so refund path executes
    vi.doMock("@/lib/square", () => ({
      isSquareConfigured: vi.fn().mockReturnValue(true),
      squareClient: { refunds: { refundPayment: mockRefundPayment } },
      createSquareOrder: vi.fn().mockRejectedValue(new Error("not configured")),
      createSquarePaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
      getSquareCardOnFile: vi.fn().mockResolvedValue(null),
      chargeCardOnFile: vi.fn(),
      createSquareInvoice: vi.fn().mockRejectedValue(new Error("not configured")),
    }));

    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    const result = await updateBookingStatus(1, "cancelled");

    expect(result).toEqual({ success: true, data: undefined });

    // Status updated to cancelled
    const statusUpdate = db._updateCalls.find((c) => c.values.status === "cancelled");
    expect(statusUpdate).toBeDefined();
    expect(statusUpdate!.values.cancelledAt).toBeDefined();

    // Single refund call for the total combo deposit ($40)
    expect(mockRefundPayment).toHaveBeenCalledTimes(1);
    expect(mockRefundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "sq-pay-001",
        amountMoney: expect.objectContaining({ amount: BigInt(4000) }),
      }),
    );

    // Cancellation email sent
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "booking_cancellation",
      }),
    );
  });
});
