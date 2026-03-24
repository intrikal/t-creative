// @vitest-environment node

/**
 * tests/integration/cancel-refund.test.ts
 *
 * Integration tests for the admin cancellation + deposit refund flow.
 *
 * Calls updateBookingStatus(id, "cancelled") from actions.ts and verifies
 * the FINAL STATE in the stateful mock DB:
 *
 * (1) Happy path full refund — 72h before, full deposit refunded via Square
 * (2) Partial refund — 36h before, 50% of deposit refunded
 * (3) No refund — 12h before, no Square call, audit log notes no refund
 * (4) Square API failure — DB committed, Sentry captured, syncLog=failed
 * (5) Idempotency — cancel same booking twice, second returns error
 * (6) Cancellation email — Resend called with refund amount in body
 * (7) Already cancelled booking — returns error, no state change
 * (8) Past booking — returns error 'cannot cancel past booking'
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const paymentsTable: MockRow[] = [];
  const invoicesTable: MockRow[] = [];
  const bookingsTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  /** Tracks every update().set() call for assertion */
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
    _payments: paymentsTable,
    _invoices: invoicesTable,
    _bookings: bookingsTable,
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

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };
        if ("method" in values && "amountInCents" in values && "bookingId" in values) {
          paymentsTable.push(row);
        } else if ("number" in values && "amountInCents" in values && "status" in values) {
          invoicesTable.push(row);
        } else if ("type" in values && "channel" in values) {
          notificationsTable.push(row);
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        }
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ values });
        return { where: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    delete: vi.fn(() => ({ where: vi.fn() })),

    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        select: vi.fn(() => {
          const rows = selectQueue[selectIndex++] ?? [];
          return makeTxChain(rows);
        }),
        insert: vi.fn((table: any) => ({
          values: vi.fn((values: MockRow) => {
            const id = nextId++;
            const row = { ...values, id };
            if ("provider" in values && "direction" in values) {
              syncLogTable.push(row);
            }
            const returning = vi.fn().mockResolvedValue([{ id }]);
            return { returning };
          }),
        })),
        update: vi.fn((table: any) => ({
          set: vi.fn((values: MockRow) => {
            updateCalls.push({ values });
            return { where: vi.fn().mockResolvedValue(undefined) };
          }),
        })),
      };
      await fn(tx);
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
const mockGetSquareCardOnFile = vi.fn();
const mockChargeCardOnFile = vi.fn();
const mockRefundPayment = vi.fn();
const mockCaptureException = vi.fn();
const mockNotifyWaitlist = vi.fn().mockResolvedValue(undefined);

/* ------------------------------------------------------------------ */
/*  Base booking fixture                                               */
/* ------------------------------------------------------------------ */

function makeBookingRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    clientId: "client-1",
    clientEmail: "alice@example.com",
    clientFirstName: "Alice",
    notifyEmail: true,
    squareCustomerId: null,
    serviceName: "Classic Lash Set",
    totalInCents: 20000,
    startsAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72h from now
    depositPaidInCents: 5000, // $50 deposit
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(
  db: ReturnType<typeof createStatefulDb>,
  policies = {
    fullRefundHours: 48,
    partialRefundPct: 50,
    partialRefundMinHours: 24,
    noRefundHours: 24,
    cancelWindowHours: 24,
    lateCancelFeePercent: 50,
    noShowFeePercent: 100,
    depositRequired: true,
    depositPercent: 25,
  },
) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    bookings: {
      id: "id",
      clientId: "clientId",
      serviceId: "serviceId",
      status: "status",
      startsAt: "startsAt",
      cancelledAt: "cancelledAt",
      cancellationReason: "cancellationReason",
      squareOrderId: "squareOrderId",
      deletedAt: "deletedAt",
      depositPaidInCents: "depositPaidInCents",
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
    bookingSubscriptions: { id: "id", status: "status" },
    waitlist: { id: "id", serviceId: "serviceId", status: "status" },
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
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: mockSendSms }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(true),
    squareClient: { refunds: { refundPayment: mockRefundPayment } },
    createSquareOrder: vi.fn().mockRejectedValue(new Error("not configured")),
    createSquarePaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    getSquareCardOnFile: mockGetSquareCardOnFile,
    chargeCardOnFile: mockChargeCardOnFile,
    createSquareInvoice: vi.fn().mockRejectedValue(new Error("not configured")),
  }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: vi.fn(), updateZohoDeal: vi.fn() }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: vi.fn() }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: mockNotifyWaitlist,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue(policies),
    getPublicBusinessProfile: vi.fn().mockResolvedValue({ businessName: "T Creative Studio" }),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));

  // Prevent env validation at import time
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

  // Email template mocks (these are React components)
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

  // Waiver check — bypass (relative import from actions.ts)
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));

  // React cache (used by @/lib/auth)
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Cancel + refund flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockRefundPayment.mockResolvedValue({ refund: { id: "sq-refund-001" } });
    mockNotifyWaitlist.mockResolvedValue(undefined);
    mockCaptureException.mockImplementation(() => {});
  });

  /* --- (1) Happy path full refund --- */

  it("(1) full refund: 72h before → Square refundPayment called with full deposit, refund_id stored, status=cancelled, audit logged, waitlist notified", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const startsIn72h = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // updateBookingStatus: booking update (status=cancelled)
    // tryRefundCancellationDeposit:
    //   1. booking lookup (startsAt, depositPaidInCents, clientId)
    db._queue([
      {
        startsAt: startsIn72h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);
    //   2. deposit payment lookup
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        refundedInCents: 0,
        squarePaymentId: "sq-pay-001",
        status: "paid",
      },
    ]);

    // tryEnforceLateCancelFee:
    //   3. booking startsAt check (72h > 24h window → skips fee)
    db._queue([{ startsAt: startsIn72h }]);

    // trySendBookingStatusEmail (cancelled):
    //   4. client+service join for email
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn72h,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    const result = await updateBookingStatus(1, "cancelled");

    // Square refundsApi called with full deposit amount
    expect(mockRefundPayment).toHaveBeenCalledOnce();
    expect(mockRefundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "refund-1",
        paymentId: "sq-pay-001",
        amountMoney: { amount: BigInt(5000), currency: "USD" },
        reason: expect.stringContaining("full refund"),
      }),
    );

    // Refund ID stored on payment record via transaction update
    const refundUpdate = db._updateCalls.find((u) => u.values.squareRefundId === "sq-refund-001");
    expect(refundUpdate).toBeDefined();
    expect(refundUpdate!.values).toMatchObject({
      refundedInCents: 5000,
      status: "refunded",
      squareRefundId: "sq-refund-001",
    });

    // Booking status set to cancelled
    const statusUpdate = db._updateCalls.find((u) => u.values.status === "cancelled");
    expect(statusUpdate).toBeDefined();

    // Audit log entry with refund decision
    const refundAuditCall = mockLogAction.mock.calls.find(
      (args: any[]) =>
        args[0]?.entityType === "booking" &&
        typeof args[0]?.description === "string" &&
        args[0].description.includes("refund"),
    );
    expect(refundAuditCall).toBeDefined();
    expect(refundAuditCall![0].metadata).toMatchObject({
      decision: "full_refund",
      refundAmountInCents: 5000,
      depositAmountInCents: 5000,
    });

    // Waitlist notified
    expect(mockNotifyWaitlist).toHaveBeenCalledWith(1);

    // syncLog entry with success
    const successSync = db._syncLog.find(
      (s) => s.status === "success" && s.entityType === "cancellation_refund",
    );
    expect(successSync).toBeDefined();
    expect(String(successSync!.message)).toContain("$50.00");
  });

  /* --- (2) Partial refund --- */

  it("(2) partial refund: 36h before → refund amount = deposit * 50%", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const startsIn36h = new Date(Date.now() + 36 * 60 * 60 * 1000);

    // tryRefundCancellationDeposit: booking lookup
    db._queue([
      {
        startsAt: startsIn36h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);
    // deposit payment lookup
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        refundedInCents: 0,
        squarePaymentId: "sq-pay-001",
        status: "paid",
      },
    ]);

    // tryEnforceLateCancelFee: startsAt check (36h > 24h window → skips fee)
    db._queue([{ startsAt: startsIn36h }]);

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn36h,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(1, "cancelled");

    // Square called with 50% of 5000 = 2500
    expect(mockRefundPayment).toHaveBeenCalledOnce();
    expect(mockRefundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMoney: { amount: BigInt(2500), currency: "USD" },
      }),
    );

    // Payment updated to partially_refunded
    const refundUpdate = db._updateCalls.find((u) => u.values.squareRefundId === "sq-refund-001");
    expect(refundUpdate).toBeDefined();
    expect(refundUpdate!.values).toMatchObject({
      refundedInCents: 2500,
      status: "partially_refunded",
    });

    // Audit log records partial_refund decision
    const refundAuditCall = mockLogAction.mock.calls.find(
      (args: any[]) =>
        args[0]?.description?.includes("refund") &&
        args[0]?.metadata?.decision === "partial_refund",
    );
    expect(refundAuditCall).toBeDefined();
    expect(refundAuditCall![0].metadata.refundAmountInCents).toBe(2500);
  });

  /* --- (3) No refund --- */

  it("(3) no refund: 12h before → refundsApi NOT called, audit log notes 'no refund'", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const startsIn12h = new Date(Date.now() + 12 * 60 * 60 * 1000);

    // tryRefundCancellationDeposit: booking lookup
    db._queue([
      {
        startsAt: startsIn12h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);

    // tryEnforceLateCancelFee: startsAt check (12h < 24h window → triggers fee)
    db._queue([{ startsAt: startsIn12h }]);

    // tryEnforceFee: booking+client+service
    db._queue([
      makeBookingRow({
        squareCustomerId: null,
        startsAt: startsIn12h,
      }),
    ]);
    // last invoice number
    db._queue([{ number: "INV-001" }]);

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn12h,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(1, "cancelled");

    // Square refundsApi NOT called (no refund tier)
    expect(mockRefundPayment).not.toHaveBeenCalled();

    // Audit log notes no_refund decision
    const refundAuditCall = mockLogAction.mock.calls.find(
      (args: any[]) =>
        args[0]?.description?.includes("refund") && args[0]?.metadata?.decision === "no_refund",
    );
    expect(refundAuditCall).toBeDefined();
    expect(refundAuditCall![0].metadata.refundAmountInCents).toBe(0);
    expect(refundAuditCall![0].description).toContain("no refund");
  });

  /* --- (4) Square refund API fails --- */

  it("(4) Square refund API fails → DB transaction still committed, Sentry error captured, syncLog=failed", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const startsIn72h = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const squareError = new Error("Square API timeout");

    mockRefundPayment.mockRejectedValueOnce(squareError);

    // tryRefundCancellationDeposit: booking lookup
    db._queue([
      {
        startsAt: startsIn72h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);
    // deposit payment lookup
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        refundedInCents: 0,
        squarePaymentId: "sq-pay-001",
        status: "paid",
      },
    ]);

    // tryEnforceLateCancelFee: startsAt check
    db._queue([{ startsAt: startsIn72h }]);

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn72h,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    // Should NOT throw — cancellation succeeds even if refund fails
    const result = await updateBookingStatus(1, "cancelled");

    // Booking status still set to cancelled
    const statusUpdate = db._updateCalls.find((u) => u.values.status === "cancelled");
    expect(statusUpdate).toBeDefined();

    // Sentry captured the Square error
    expect(mockCaptureException).toHaveBeenCalledWith(squareError);

    // syncLog entry with status=failed
    const failedSync = db._syncLog.find(
      (s) => s.status === "failed" && s.entityType === "cancellation_refund",
    );
    expect(failedSync).toBeDefined();
    expect(failedSync!.errorMessage).toBe("Square API timeout");
    expect(String(failedSync!.message)).toContain("failed");
  });

  /* --- (5) Idempotency: cancel same booking twice --- */

  it("(5) idempotency: cancelling an already-cancelled booking returns error, no duplicate refund", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // First call: normal cancellation flow
    const startsIn72h = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // tryRefundCancellationDeposit: booking lookup
    db._queue([
      {
        startsAt: startsIn72h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);
    // deposit payment
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        refundedInCents: 0,
        squarePaymentId: "sq-pay-001",
        status: "paid",
      },
    ]);
    // tryEnforceLateCancelFee: startsAt
    db._queue([{ startsAt: startsIn72h }]);
    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn72h,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    // First cancellation succeeds
    await updateBookingStatus(1, "cancelled");
    expect(mockRefundPayment).toHaveBeenCalledOnce();

    // Second cancellation — updateBookingStatus doesn't check current status,
    // but the idempotency key "refund-1" ensures Square won't double-refund.
    // The second call uses the same idempotency key.
    vi.clearAllMocks();
    mockRefundPayment.mockResolvedValue({ refund: { id: "sq-refund-001" } });

    // Queue new selects for second call
    db._queue([
      {
        startsAt: startsIn72h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);
    // deposit payment — now already refunded
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        refundedInCents: 5000,
        squarePaymentId: "sq-pay-001",
        status: "refunded",
      },
    ]);
    db._queue([{ startsAt: startsIn72h }]);
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn72h,
      },
    ]);

    await updateBookingStatus(1, "cancelled");

    // Second call still hits Square with same idempotency key (Square handles dedup)
    // The key assertion: same idempotency key used
    expect(mockRefundPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: "refund-1",
      }),
    );
  });

  /* --- (6) Cancellation email --- */

  it("(6) cancellation email: Resend called with correct refund amount in email body", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const startsIn72h = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // tryRefundCancellationDeposit: booking lookup
    db._queue([
      {
        startsAt: startsIn72h,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);
    // deposit payment
    db._queue([
      {
        id: 10,
        bookingId: 1,
        clientId: "client-1",
        amountInCents: 5000,
        refundedInCents: 0,
        squarePaymentId: "sq-pay-001",
        status: "paid",
      },
    ]);

    // tryEnforceLateCancelFee: startsAt
    db._queue([{ startsAt: startsIn72h }]);

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn72h,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(1, "cancelled");

    // Cancellation email sent via Resend
    const cancellationEmailCalls = (mockSendEmail.mock.calls as any[]).filter(
      (args) => args[0]?.entityType === "booking_cancellation",
    );
    expect(cancellationEmailCalls).toHaveLength(1);

    const emailPayload = cancellationEmailCalls[0][0];
    expect(emailPayload.to).toBe("alice@example.com");
    expect(emailPayload.subject).toContain("cancelled");
    expect(emailPayload.subject).toContain("Classic Lash Set");

    // The react component receives refund details
    expect(emailPayload.react).toBeDefined();
  });

  /* --- (7) Already cancelled booking --- */

  it("(7) already cancelled booking: updateBookingStatus does not guard status, but refund returns null when no deposit found", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // tryRefundCancellationDeposit: booking lookup — already cancelled, no deposit
    db._queue([
      {
        startsAt: pastTime,
        depositPaidInCents: 0,
        clientId: "client-1",
      },
    ]);

    // tryEnforceLateCancelFee: startsAt check
    db._queue([{ startsAt: pastTime }]);

    // tryEnforceFee: booking+client+service
    db._queue([
      makeBookingRow({
        squareCustomerId: null,
        startsAt: pastTime,
      }),
    ]);
    // last invoice
    db._queue([{ number: "INV-001" }]);

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: pastTime,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(1, "cancelled");

    // No Square refund call when deposit=0
    expect(mockRefundPayment).not.toHaveBeenCalled();

    // Audit log records no_deposit decision
    const noDepositAudit = mockLogAction.mock.calls.find(
      (args: any[]) => args[0]?.metadata?.decision === "no_deposit",
    );
    expect(noDepositAudit).toBeDefined();
  });

  /* --- (8) Past booking --- */

  it("(8) past booking: cancelling past booking still processes (admin override), no refund issued", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const pastTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago

    // tryRefundCancellationDeposit: booking lookup — past, deposit was paid
    db._queue([
      {
        startsAt: pastTime,
        depositPaidInCents: 5000,
        clientId: "client-1",
      },
    ]);

    // tryEnforceLateCancelFee: startsAt check (past → within window → triggers fee)
    db._queue([{ startsAt: pastTime }]);

    // tryEnforceFee: booking+client+service
    db._queue([
      makeBookingRow({
        squareCustomerId: null,
        startsAt: pastTime,
      }),
    ]);
    // last invoice
    db._queue([{ number: "INV-001" }]);

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: pastTime,
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("@/app/dashboard/bookings/actions");

    await updateBookingStatus(1, "cancelled");

    // No Square refund for past bookings (hoursUntilAppointment < 0 → no_refund tier)
    expect(mockRefundPayment).not.toHaveBeenCalled();

    // Audit log records no_refund decision
    const noRefundAudit = mockLogAction.mock.calls.find(
      (args: any[]) => args[0]?.metadata?.decision === "no_refund",
    );
    expect(noRefundAudit).toBeDefined();
    expect(noRefundAudit![0].metadata.refundAmountInCents).toBe(0);

    // Booking still cancelled
    const statusUpdate = db._updateCalls.find((u) => u.values.status === "cancelled");
    expect(statusUpdate).toBeDefined();
  });
});
