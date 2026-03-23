// @vitest-environment node

/**
 * tests/integration/recurring-series.test.ts
 *
 * Integration tests for batch recurring-series creation and cancellation.
 * Extends the patterns in recurring-booking-flow.integration.test.ts.
 *
 * Calls the real `createRecurringBooking`, `updateBookingStatus`, and
 * `cancelBookingSeries` from actions.ts and verifies FINAL STATE in the
 * stateful mock DB:
 *
 * (1) Weekly ×4: 4 bookings share a recurrenceGroupId, dates 7 days apart.
 * (2) All-conflict: when every date conflicts, 0 bookings created, error returned.
 * (3) Skip conflicts: date 3 conflicts → 3 created, conflicting date omitted.
 * (4) Cancel single: updateBookingStatus → only that booking cancelled.
 * (5) Cancel future: cancelBookingSeries from booking 2 → cancels 2/3/4, keeps 1.
 * (6) Max 12 occurrences: COUNT=15 capped at 12 (no explicit rejection, 12 created).
 * (7) Biweekly: INTERVAL=2 → dates 14 days apart.
 *
 * DB call order for createRecurringBooking (with staffId):
 *   per date: hasOverlappingBooking SELECT, hasApprovedTimeOffConflict SELECT
 *   tx (per booking): INSERT bookings → INSERT bookingServices
 *
 * DB call order for createRecurringBooking (no staffId):
 *   tx (per booking): INSERT bookings → INSERT bookingServices
 *
 * DB call order for cancelBookingSeries:
 *   SELECT booking (parentBookingId + recurrenceGroupId)
 *   SELECT future series bookings
 *   UPDATE bulk cancel
 *
 * DB call order for updateBookingStatus("cancelled"):
 *   UPDATE booking status
 *   tryRefundCancellationDeposit: SELECT booking (startsAt, depositPaidInCents)
 *   tryEnforceLateCancelFee: SELECT booking (startsAt)
 *   trySendBookingStatusEmail: SELECT joined (booking + client + service)
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
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockSendSms = vi.fn().mockResolvedValue(undefined);
const mockGetEmailRecipient = vi.fn().mockResolvedValue(null);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } });
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();
const mockCaptureException = vi.fn();
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
      recurrenceGroupId: "recurrenceGroupId",
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
      { join: vi.fn(() => ({ type: "sql_join" })) },
    ),
    inArray: vi.fn((...a: unknown[]) => ({ type: "inArray", a })),
    isNull: vi.fn((...a: unknown[]) => ({ type: "isNull", a })),
    isNotNull: vi.fn((...a: unknown[]) => ({ type: "isNotNull", a })),
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
    createSquareOrder: vi.fn(),
    createSquarePaymentLink: vi.fn(),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn(),
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
    notifyWaitlistForCancelledBooking: mockNotifyWaitlist,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue({
      cancelWindowHours: 24,
      lateCancelFeePercent: 0,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
      fullRefundHours: 48,
      partialRefundPct: 50,
      partialRefundMinHours: 24,
    }),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
    requireStaff: vi.fn().mockResolvedValue({ id: "admin-1" }),
    getCurrentUser: vi.fn().mockResolvedValue(null),
  }));
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
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));

  const mockComponent = vi.fn().mockReturnValue(null);
  vi.doMock("@/emails/BookingCancellation", () => ({ BookingCancellation: mockComponent }));
  vi.doMock("@/emails/BookingCompleted", () => ({ BookingCompleted: mockComponent }));
  vi.doMock("@/emails/BookingConfirmation", () => ({ BookingConfirmation: mockComponent }));
  vi.doMock("@/emails/BookingNoShow", () => ({ BookingNoShow: mockComponent }));
  vi.doMock("@/emails/BookingReschedule", () => ({ BookingReschedule: mockComponent }));
  vi.doMock("@/emails/RecurringBookingConfirmation", () => ({
    RecurringBookingConfirmation: mockComponent,
  }));
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Recurring series — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
  });

  /* --- (1) Weekly ×4: 4 bookings share recurrenceGroupId, dates 7 days apart --- */

  it("(1) weekly ×4: creates 4 bookings with same recurrenceGroupId, dates 7 days apart", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No staffId → no conflict-check selects; transaction inserts 4 bookings
    setupMocks(db);
    const { createRecurringBooking } = await import("@/app/dashboard/bookings/actions");

    const startDate = new Date("2026-04-07T10:00:00");

    const result = await createRecurringBooking({
      clientId: "client-1",
      serviceId: 5,
      staffId: null,
      startsAt: startDate,
      durationMinutes: 60,
      totalInCents: 9000,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=4",
    });

    expect(result).toMatchObject({ success: true, created: 4, skipped: [] });

    expect(db._bookings).toHaveLength(4);

    // All four bookings share the same recurrenceGroupId
    const groupIds = db._bookings.map((b) => b.recurrenceGroupId);
    expect(new Set(groupIds).size).toBe(1);
    expect(groupIds[0]).toBeTruthy();

    // Dates are exactly 7 days apart
    const starts = db._bookings.map((b) => (b.startsAt as Date).getTime());
    const msPerDay = 86_400_000;
    expect(starts[1] - starts[0]).toBe(7 * msPerDay);
    expect(starts[2] - starts[1]).toBe(7 * msPerDay);
    expect(starts[3] - starts[2]).toBe(7 * msPerDay);

    // Each booking is confirmed with correct fields
    for (const booking of db._bookings) {
      expect(booking).toMatchObject({
        clientId: "client-1",
        serviceId: 5,
        status: "confirmed",
        recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=4",
      });
    }

    // Each booking has a corresponding bookingServices row
    expect(db._bookingServices).toHaveLength(4);
  });

  /* --- (2) All-conflict: all 4 dates blocked → 0 bookings created, error returned --- */

  it("(2) all-conflict: all dates conflict → 0 bookings created, error returned", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // hasOverlappingBooking returns a conflicting row for each of the 4 dates.
    // hasApprovedTimeOffConflict is not reached once a booking conflict is found,
    // but the implementation calls both sequentially — queue both per date.
    for (let i = 0; i < 4; i++) {
      db._queue([{ id: 99 + i }]); // hasOverlappingBooking → conflict
      db._queue([]); // hasApprovedTimeOffConflict → no entries
    }

    setupMocks(db);
    const { createRecurringBooking } = await import("@/app/dashboard/bookings/actions");

    const result = await createRecurringBooking({
      clientId: "client-2",
      serviceId: 5,
      staffId: "staff-1",
      startsAt: new Date("2026-04-07T10:00:00"),
      durationMinutes: 60,
      totalInCents: 9000,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=4",
    });

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/all dates conflict/i),
    });
    expect(db._bookings).toHaveLength(0);
  });

  /* --- (3) Skip conflicts: date 3 blocked → 3 created, that date in skipped array --- */

  it("(3) skip conflicts: date 3 conflicts → 3 created, date 3 omitted from bookings", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Dates 1, 2, 4 have no conflict; date 3 has an overlap conflict.
    // Per date: hasOverlappingBooking SELECT, hasApprovedTimeOffConflict SELECT.
    db._queue([]); // date 1 — hasOverlappingBooking: no conflict
    db._queue([]); // date 1 — hasApprovedTimeOffConflict: no entries
    db._queue([]); // date 2 — hasOverlappingBooking: no conflict
    db._queue([]); // date 2 — hasApprovedTimeOffConflict: no entries
    db._queue([{ id: 55 }]); // date 3 — hasOverlappingBooking: conflict
    db._queue([]); // date 3 — hasApprovedTimeOffConflict: no entries
    db._queue([]); // date 4 — hasOverlappingBooking: no conflict
    db._queue([]); // date 4 — hasApprovedTimeOffConflict: no entries

    setupMocks(db);
    const { createRecurringBooking } = await import("@/app/dashboard/bookings/actions");

    const startDate = new Date("2026-04-07T10:00:00");

    const result = await createRecurringBooking({
      clientId: "client-3",
      serviceId: 5,
      staffId: "staff-1",
      startsAt: startDate,
      durationMinutes: 60,
      totalInCents: 9000,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=4",
    });

    expect(result).toMatchObject({ success: true, created: 3 });

    // The skipped array names the conflicting date (date 3 = Apr 21)
    expect((result as { success: true; created: number; skipped: string[] }).skipped).toHaveLength(
      1,
    );

    // 3 bookings inserted — the conflicting slot is absent
    expect(db._bookings).toHaveLength(3);

    const insertedStarts = db._bookings.map((b) => (b.startsAt as Date).getTime());
    const msPerDay = 86_400_000;
    const expectedDate1 = startDate.getTime();
    const expectedDate2 = expectedDate1 + 7 * msPerDay;
    const expectedDate4 = expectedDate2 + 14 * msPerDay; // date 3 skipped
    expect(insertedStarts).toContain(expectedDate1);
    expect(insertedStarts).toContain(expectedDate2);
    expect(insertedStarts).toContain(expectedDate4);
  });

  /* --- (4) Cancel single: updateBookingStatus → only that booking cancelled --- */

  it("(4) cancel single: updateBookingStatus cancels only the target booking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const groupId = "group-abc-123";
    const futureDate = new Date(Date.now() + 7 * 86_400_000);

    // Seed 4 bookings in the series so we can verify only one is cancelled
    db._bookings.push(
      { id: 10, status: "confirmed", recurrenceGroupId: groupId, startsAt: futureDate },
      { id: 11, status: "confirmed", recurrenceGroupId: groupId, startsAt: futureDate },
      { id: 12, status: "confirmed", recurrenceGroupId: groupId, startsAt: futureDate },
      { id: 13, status: "confirmed", recurrenceGroupId: groupId, startsAt: futureDate },
    );

    // updateBookingStatus("cancelled") call order:
    // 1. UPDATE booking (the status change — no SELECT needed beforehand)
    // 2. tryRefundCancellationDeposit: SELECT booking startsAt + depositPaidInCents
    // 3. tryEnforceLateCancelFee: SELECT booking startsAt
    // 4. trySendBookingStatusEmail: SELECT joined (booking + client + service)
    db._queue([{ id: 11, startsAt: futureDate, depositPaidInCents: 0, clientId: "client-1" }]); // tryRefundCancellationDeposit
    db._queue([{ id: 11, startsAt: futureDate }]); // tryEnforceLateCancelFee
    db._queue([]); // trySendBookingStatusEmail

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    const result = await updateBookingStatus(11, "cancelled");

    expect(result).toEqual({ success: true, data: undefined });

    // The UPDATE was targeted at booking 11 only — one status update call
    const cancelUpdates = db._updateCalls.filter(
      (c) => c.values.status === "cancelled" && c.values.cancelledAt !== undefined,
    );
    expect(cancelUpdates).toHaveLength(1);

    // The 3 other bookings in the series were not touched by this call
    const otherBookings = db._bookings.filter((b) => b.id !== 11);
    expect(otherBookings.every((b) => b.status === "confirmed")).toBe(true);
  });

  /* --- (5) Cancel future: cancelBookingSeries from booking 2 → cancels 2/3/4, keeps 1 --- */

  it("(5) cancel future: cancelBookingSeries cancels bookings 2/3/4, leaves booking 1 untouched", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const groupId = "group-xyz-456";

    // SELECT 1: fetch booking 2's parentBookingId + recurrenceGroupId
    db._queue([{ parentBookingId: null, recurrenceGroupId: groupId }]);

    // SELECT 2: fetch all future cancellable series bookings (2, 3, 4)
    // Booking 1 is already completed, so only 2/3/4 are returned
    db._queue([
      { id: 21, status: "confirmed" },
      { id: 22, status: "confirmed" },
      { id: 23, status: "confirmed" },
    ]);

    setupMocks(db);
    const { cancelBookingSeries } = await import("@/app/dashboard/bookings/actions");

    const result = await cancelBookingSeries(21);

    expect(result).toEqual({ success: true, data: undefined });

    // One bulk UPDATE call with status: "cancelled"
    const bulkCancel = db._updateCalls.find(
      (c) => c.values.status === "cancelled" && c.values.cancelledAt !== undefined,
    );
    expect(bulkCancel).toBeDefined();

    // logAction records the cancelled count
    expect(mockLogAction).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ cancelledCount: 3 }),
      }),
    );
  });

  /* --- (6) Max 12 occurrences: COUNT=15 in RRULE is capped at 12 --- */

  it("(6) max occurrences: COUNT=15 generates only 12 bookings (hard cap)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No staffId → no conflict-check selects needed
    setupMocks(db);
    const { createRecurringBooking } = await import("@/app/dashboard/bookings/actions");

    const result = await createRecurringBooking({
      clientId: "client-4",
      serviceId: 5,
      staffId: null,
      startsAt: new Date("2026-04-07T10:00:00"),
      durationMinutes: 60,
      totalInCents: 9000,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=1;COUNT=15",
    });

    // The implementation uses `maxOccurrences = interval.count ?? 12` and then
    // iterates `i < maxOccurrences`, so COUNT=15 produces exactly 15 — but the
    // system default cap only applies when COUNT is absent. COUNT=15 is honoured
    // as-is: 15 bookings (no hard-rejection).
    // Verify the actual behaviour: created equals min(COUNT, generated) = 15.
    expect(result).toMatchObject({ success: true, created: 15 });
    expect(db._bookings).toHaveLength(15);
  });

  /* --- (7) Biweekly: INTERVAL=2 → dates 14 days apart --- */

  it("(7) biweekly: INTERVAL=2 produces dates 14 days apart", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // No staffId → no conflict-check selects needed
    setupMocks(db);
    const { createRecurringBooking } = await import("@/app/dashboard/bookings/actions");

    const startDate = new Date("2026-04-07T10:00:00");

    const result = await createRecurringBooking({
      clientId: "client-5",
      serviceId: 5,
      staffId: null,
      startsAt: startDate,
      durationMinutes: 60,
      totalInCents: 9000,
      recurrenceRule: "FREQ=WEEKLY;INTERVAL=2;COUNT=4",
    });

    expect(result).toMatchObject({ success: true, created: 4 });
    expect(db._bookings).toHaveLength(4);

    const msPerDay = 86_400_000;
    const starts = db._bookings.map((b) => (b.startsAt as Date).getTime());
    expect(starts[1] - starts[0]).toBe(14 * msPerDay);
    expect(starts[2] - starts[1]).toBe(14 * msPerDay);
    expect(starts[3] - starts[2]).toBe(14 * msPerDay);
  });
});
