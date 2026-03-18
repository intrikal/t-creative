import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the no-show / late-cancel fee enforcement flow.
 *
 * Calls updateBookingStatus("no_show" | "cancelled") from actions.ts and
 * verifies the FINAL STATE in the stateful mock DB:
 *
 * Flow A — card on file:  payment record created, NoShowFeeCharged email sent
 * Flow B — no card:       invoice record created, NoShowFeeInvoice email sent
 * Flow C — 0% fee:        no payment, no invoice, no fee email
 * Flow D — late cancel:   same fee path as no-show when within window
 * Flow E — cancel outside window: no fee charged
 */

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
    _payments: paymentsTable,
    _invoices: invoicesTable,
    _bookings: bookingsTable,
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
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => Promise.resolve()),
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
const mockGetSquareCardOnFile = vi.fn();
const mockChargeCardOnFile = vi.fn();

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
    totalInCents: 20000, // $200
    startsAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hrs from now
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(
  db: ReturnType<typeof createStatefulDb>,
  policies = {
    cancelWindowHours: 24,
    lateCancelFeePercent: 50,
    noShowFeePercent: 100,
    depositRequired: false,
    depositPercent: 0,
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
    isSquareConfigured: vi.fn().mockReturnValue(true),
    createSquareOrder: vi.fn().mockRejectedValue(new Error("not configured")),
    createSquarePaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    getSquareCardOnFile: mockGetSquareCardOnFile,
    chargeCardOnFile: mockChargeCardOnFile,
  }));
  vi.doMock("@/lib/zoho", () => ({ createZohoDeal: vi.fn(), updateZohoDeal: vi.fn() }));
  vi.doMock("@/lib/zoho-books", () => ({ createZohoBooksInvoice: vi.fn() }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPolicies: vi.fn().mockResolvedValue(policies),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

  // Waiver check — bypass (no forms required)
  vi.doMock("./waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("No-show fee flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockGetSquareCardOnFile.mockResolvedValue(null);
    mockChargeCardOnFile.mockResolvedValue(null);
  });

  /* --- Flow A: card on file --- */

  it("Flow A: charges card on file and records payment for no-show (100%)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // updateBookingStatus: booking update (status)
    // tryEnforceNoShowFee → tryEnforceFee:
    //   1. feeClient + service join
    db._queue([makeBookingRow({ squareCustomerId: "sq-cust-1" })]);

    // trySendBookingStatusEmail (no_show):
    //   2. statusClient + service join
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: new Date(),
      },
    ]);

    mockGetSquareCardOnFile.mockResolvedValue("card-token-xyz");
    mockChargeCardOnFile.mockResolvedValue({
      paymentId: "sq-fee-pay-001",
      orderId: "sq-fee-order-001",
      receiptUrl: "https://squareup.com/receipt/fee",
    });

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(1, "no_show");

    // Payment record created with full 100% fee ($200)
    expect(db._payments).toHaveLength(1);
    expect(db._payments[0]).toMatchObject({
      bookingId: 1,
      clientId: "client-1",
      amountInCents: 20000,
      method: "square_card",
      status: "paid",
      squarePaymentId: "sq-fee-pay-001",
    });

    // NoShowFeeCharged email sent
    const feeEmailCalls = (mockSendEmail.mock.calls as any[]).filter(
      (args) => args[0]?.entityType === "no_show_fee_charged",
    );
    expect(feeEmailCalls).toHaveLength(1);
  });

  /* --- Flow B: no card on file → invoice --- */

  it("Flow B: creates invoice when no card on file", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // tryEnforceFee: booking+client+service
    db._queue([makeBookingRow({ squareCustomerId: null })]);
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
        startsAt: new Date(),
      },
    ]);

    setupMocks(db);
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(1, "no_show");

    // Invoice created
    expect(db._invoices).toHaveLength(1);
    expect(db._invoices[0]).toMatchObject({
      clientId: "client-1",
      number: "INV-002",
      amountInCents: 20000,
      status: "sent",
    });
    // notes references the booking
    expect(String(db._invoices[0].notes)).toContain("booking #1");

    // NoShowFeeInvoice email sent
    const invoiceEmailCalls = (mockSendEmail.mock.calls as any[]).filter(
      (args) => args[0]?.entityType === "no_show_fee_invoice",
    );
    expect(invoiceEmailCalls).toHaveLength(1);
  });

  /* --- Flow C: 0% fee → no charge --- */

  it("Flow C: no payment or invoice when noShowFeePercent is 0", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // trySendBookingStatusEmail: client+service
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: new Date(),
      },
    ]);

    setupMocks(db, {
      cancelWindowHours: 24,
      lateCancelFeePercent: 0,
      noShowFeePercent: 0,
      depositRequired: false,
      depositPercent: 0,
    });
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(1, "no_show");

    expect(db._payments).toHaveLength(0);
    expect(db._invoices).toHaveLength(0);
    // No fee emails of any kind
    const feeEmails = (mockSendEmail.mock.calls as any[]).filter(
      (args) =>
        args[0]?.entityType === "no_show_fee_charged" ||
        args[0]?.entityType === "no_show_fee_invoice",
    );
    expect(feeEmails).toHaveLength(0);
  });

  /* --- Flow D: late cancel within window → fee triggered --- */

  it("Flow D: late cancellation within window triggers fee and creates invoice", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // tryEnforceLateCancelFee: booking.startsAt check
    const startsIn12h = new Date(Date.now() + 12 * 60 * 60 * 1000);
    db._queue([{ startsAt: startsIn12h }]);

    // tryEnforceFee: booking+client+service
    db._queue([
      makeBookingRow({
        squareCustomerId: null,
        startsAt: startsIn12h,
        totalInCents: 10000, // $100 — 50% = $50
      }),
    ]);
    // last invoice
    db._queue([{ number: "INV-005" }]);

    // trySendBookingStatusEmail (cancelled): client+service
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

    // tryNotifyWaitlist is mocked via waitlist-notify

    setupMocks(db, {
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
    });
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(1, "cancelled");

    // Invoice created for 50% of $100 = $50
    expect(db._invoices).toHaveLength(1);
    expect(db._invoices[0]).toMatchObject({
      amountInCents: 5000,
      status: "sent",
    });
  });

  /* --- Flow E: cancel outside window → no fee --- */

  it("Flow E: cancellation outside window does NOT trigger late cancel fee", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // tryEnforceLateCancelFee: booking.startsAt — 3 days from now (outside 24h window)
    const startsIn3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    db._queue([{ startsAt: startsIn3Days }]);

    // trySendBookingStatusEmail (cancelled)
    db._queue([
      {
        clientId: "client-1",
        clientEmail: "alice@example.com",
        clientFirstName: "Alice",
        notifyEmail: true,
        serviceName: "Classic Lash Set",
        startsAt: startsIn3Days,
      },
    ]);

    setupMocks(db, {
      cancelWindowHours: 24,
      lateCancelFeePercent: 50,
      noShowFeePercent: 100,
      depositRequired: false,
      depositPercent: 0,
    });
    const { updateBookingStatus } = await import("./actions");

    await updateBookingStatus(1, "cancelled");

    expect(db._payments).toHaveLength(0);
    expect(db._invoices).toHaveLength(0);
  });
});
