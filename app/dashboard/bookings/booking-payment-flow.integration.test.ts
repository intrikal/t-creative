// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the Square webhook → payment → loyalty flow.
 *
 * Calls the real POST handler from app/api/webhooks/square/route.ts and
 * verifies the FINAL STATE in the stateful mock DB:
 *   - Payment record created with correct amount
 *   - Loyalty transaction inserted (first_booking type)
 *   - Receipt email sent via Resend
 *   - Duplicate webhook (same event_id) does NOT create a second payment
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const paymentsTable: MockRow[] = [];
  const bookingsTable: MockRow[] = [];
  const loyaltyTransactionsTable: MockRow[] = [];
  const webhookEventsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];
  const ordersTable: MockRow[] = [];
  const profilesTable: MockRow[] = [];

  let nextId = 1;

  // Configurable per-test select responses
  const selectResponses: Array<MockRow[]> = [];
  let selectCallIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      returning: (fields?: any) => {
        // Return only { id } when returning is called
        return Promise.resolve(rows.map((r) => ({ id: r.id ?? nextId++ })));
      },
      then: p.then.bind(p),
      catch: p.catch.bind(p),
      finally: p.finally.bind(p),
    };
    return chain;
  }

  const db = {
    _payments: paymentsTable,
    _bookings: bookingsTable,
    _loyalty: loyaltyTransactionsTable,
    _webhookEvents: webhookEventsTable,
    _syncLog: syncLogTable,
    _profiles: profilesTable,

    // Queue responses for select() calls in order
    _queueSelectResponse: (rows: MockRow[]) => {
      selectResponses.push(rows);
    },
    _resetSelectQueue: () => {
      selectResponses.length = 0;
      selectCallIndex = 0;
    },

    select: vi.fn((_fields?: any) => {
      const rows = selectResponses[selectCallIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };

        // Identify table by shape
        if ("points" in values && "profileId" in values) {
          loyaltyTransactionsTable.push(row);
        } else if ("squarePaymentId" in values || ("bookingId" in values && "method" in values)) {
          paymentsTable.push(row);
        } else if ("externalEventId" in values || "eventType" in values) {
          webhookEventsTable.push(row);
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        }

        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning, onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) };
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Apply updates to webhookEvents (mark processed)
          if ("isProcessed" in values) {
            const last = webhookEventsTable[webhookEventsTable.length - 1];
            if (last) Object.assign(last, values);
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
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockCaptureException = vi.fn();

/* ------------------------------------------------------------------ */
/*  Webhook event factory                                              */
/* ------------------------------------------------------------------ */

function makePaymentCompletedEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: "evt-001",
    type: "payment.completed",
    data: {
      object: {
        payment: {
          id: "sq-pay-001",
          orderId: "sq-order-001",
          // Use numbers instead of BigInt — the route casts with Number() anyway
          amountMoney: { amount: 20000, currency: "USD" },
          tipMoney: { amount: 0 },
          tenders: [{ type: "CARD" }],
          receiptUrl: "https://squareup.com/receipt/sq-pay-001",
          ...overrides,
        },
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    payments: {
      id: "id",
      bookingId: "bookingId",
      clientId: "clientId",
      squarePaymentId: "squarePaymentId",
      squareOrderId: "squareOrderId",
      amountInCents: "amountInCents",
      method: "method",
      status: "status",
      notes: "notes",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      squareOrderId: "squareOrderId",
      depositPaidInCents: "depositPaidInCents",
      depositPaidAt: "depositPaidAt",
      zohoInvoiceId: "zohoInvoiceId",
    },
    orders: {
      id: "id",
      clientId: "clientId",
      squareOrderId: "squareOrderId",
      fulfillmentMethod: "fulfillmentMethod",
      easypostShipmentId: "easypostShipmentId",
      status: "status",
      zohoInvoiceId: "zohoInvoiceId",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      role: "role",
      notifyEmail: "notifyEmail",
      onboardingData: "onboardingData",
    },
    loyaltyTransactions: {
      id: "id",
      profileId: "profileId",
      points: "points",
      type: "type",
      description: "description",
    },
    webhookEvents: {
      id: "id",
      provider: "provider",
      externalEventId: "externalEventId",
      eventType: "eventType",
      payload: "payload",
      isProcessed: "isProcessed",
      attempts: "attempts",
      processedAt: "processedAt",
      errorMessage: "errorMessage",
    },
    syncLog: {
      id: "id",
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      remoteId: "remoteId",
      message: "message",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    or: vi.fn((...a: unknown[]) => ({ type: "or", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
  }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/square", () => ({
    SQUARE_WEBHOOK_SIGNATURE_KEY: "", // disable sig check
    squareClient: { orders: { get: vi.fn().mockRejectedValue(new Error("not configured")) } },
    isSquareConfigured: vi.fn().mockReturnValue(false),
  }));
  vi.doMock("@/lib/easypost", () => ({
    isEasyPostConfigured: vi.fn().mockReturnValue(false),
    buyShippingLabel: vi.fn(),
  }));
  vi.doMock("@/lib/zoho-books", () => ({ recordZohoBooksPayment: vi.fn() }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Booking payment flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
  });

  it("creates a payment record with correct amount when webhook matches a booking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Call order:
    // 1. POST: webhookEvents idempotency check → not seen before
    db._queueSelectResponse([]);
    // 2. handlePaymentCompleted: payments squarePaymentId check → not found
    db._queueSelectResponse([]);
    // 3. findBookingByOrder: bookings.squareOrderId lookup → booking found
    db._queueSelectResponse([{ id: 10, clientId: "client-1", squareOrderId: "sq-order-001" }]);
    // 4. awardFirstBookingPoints: loyaltyTx first_booking check → not awarded
    db._queueSelectResponse([]);
    // 5. awardFirstBookingPoints: adminProfile → rewards not configured
    db._queueSelectResponse([{ onboardingData: null }]);
    // 6. profiles for receipt email
    db._queueSelectResponse([{ email: "alice@example.com", firstName: "Alice" }]);
    // 7. bookings.zohoInvoiceId
    db._queueSelectResponse([{ zohoInvoiceId: null }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    const event = makePaymentCompletedEvent();
    const req = new Request("https://example.com/api/webhooks/square", {
      method: "POST",
      body: JSON.stringify(event),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Payment record created
    expect(db._payments).toHaveLength(1);
    expect(db._payments[0]).toMatchObject({
      bookingId: 10,
      clientId: "client-1",
      amountInCents: 20000,
      method: "square_card",
      status: "paid",
      squarePaymentId: "sq-pay-001",
    });
  });

  it("sends a receipt email to the client after payment", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queueSelectResponse([]); // 1. webhookEvents idempotency
    db._queueSelectResponse([]); // 2. payments squarePaymentId check
    db._queueSelectResponse([{ id: 10, clientId: "client-1", squareOrderId: "sq-order-001" }]); // 3. booking
    db._queueSelectResponse([]); // 4. loyalty check
    db._queueSelectResponse([{ onboardingData: null }]); // 5. admin profile
    db._queueSelectResponse([{ email: "alice@example.com", firstName: "Alice" }]); // 6. receipt email profile
    db._queueSelectResponse([{ zohoInvoiceId: null }]); // 7. zoho

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    await POST(
      new Request("https://example.com/api/webhooks/square", {
        method: "POST",
        body: JSON.stringify(makePaymentCompletedEvent()),
      }),
    );

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "payment_receipt",
      }),
    );
  });

  it("awards first_booking loyalty points when rewards are configured", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Call order:
    // 1. POST: webhookEvents idempotency check
    db._queueSelectResponse([]);
    // 2. handlePaymentCompleted: payments squarePaymentId check
    db._queueSelectResponse([]);
    // 3. findBookingByOrder: bookings.squareOrderId lookup
    db._queueSelectResponse([{ id: 10, clientId: "client-1", squareOrderId: "sq-order-001" }]);
    // 4-7. awardFirstBookingPoints (called before receipt email):
    //   4. loyaltyTx first_booking check
    db._queueSelectResponse([]);
    //   5. adminProfile onboardingData
    db._queueSelectResponse([
      { onboardingData: { rewards: { enabled: true, bonuses: { firstBooking: 75 } } } },
    ]);
    //   6. client profile for loyalty email
    db._queueSelectResponse([{ firstName: "Alice", email: "alice@example.com", notifyEmail: true }]);
    //   7. balance row for loyalty email
    db._queueSelectResponse([{ total: "75" }]);
    // 8. profiles for receipt email (after loyalty points)
    db._queueSelectResponse([{ email: "alice@example.com", firstName: "Alice" }]);
    // 9. bookings.zohoInvoiceId
    db._queueSelectResponse([{ zohoInvoiceId: null }]);

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    await POST(
      new Request("https://example.com/api/webhooks/square", {
        method: "POST",
        body: JSON.stringify(makePaymentCompletedEvent()),
      }),
    );

    // Loyalty transaction inserted
    expect(db._loyalty).toHaveLength(1);
    expect(db._loyalty[0]).toMatchObject({
      profileId: "client-1",
      points: 75,
      type: "first_booking",
      description: "First booking",
    });
  });

  it("does NOT award loyalty points twice (idempotent per client)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queueSelectResponse([]); // 1. webhookEvents idempotency
    db._queueSelectResponse([]); // 2. payments squarePaymentId check
    db._queueSelectResponse([{ id: 10, clientId: "client-1", squareOrderId: "sq-order-001" }]); // 3. booking
    // 4. loyaltyTx check → already awarded (exits awardFirstBookingPoints early)
    db._queueSelectResponse([{ id: "tx-existing", type: "first_booking" }]);
    db._queueSelectResponse([{ email: "alice@example.com", firstName: "Alice" }]); // 5. receipt email
    db._queueSelectResponse([{ zohoInvoiceId: null }]); // 6. zoho

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    await POST(
      new Request("https://example.com/api/webhooks/square", {
        method: "POST",
        body: JSON.stringify(makePaymentCompletedEvent()),
      }),
    );

    expect(db._loyalty).toHaveLength(0);
  });

  it("duplicate webhook (same event_id) does NOT create a second payment", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // First call: event not processed yet → inserts payment
    db._queueSelectResponse([]); // 1. webhookEvents idempotency → not seen
    db._queueSelectResponse([]); // 2. payments squarePaymentId → not found
    db._queueSelectResponse([{ id: 10, clientId: "client-1", squareOrderId: "sq-order-001" }]); // 3. booking
    db._queueSelectResponse([]); // 4. loyalty check
    db._queueSelectResponse([{ onboardingData: null }]); // 5. admin profile
    db._queueSelectResponse([{ email: "alice@example.com", firstName: "Alice" }]); // 6. receipt email
    db._queueSelectResponse([{ zohoInvoiceId: null }]); // 7. zoho

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    const event = makePaymentCompletedEvent();
    const makeReq = () =>
      new Request("https://example.com/api/webhooks/square", {
        method: "POST",
        body: JSON.stringify(event),
      });

    await POST(makeReq());
    expect(db._payments).toHaveLength(1);

    // Second call: event already processed (isProcessed: true)
    db._queueSelectResponse([{ id: 99, isProcessed: true }]);

    const res2 = await POST(makeReq());
    expect(res2.status).toBe(200);

    // Still only one payment — no duplicate
    expect(db._payments).toHaveLength(1);
  });

  it("logs unmatched payment to sync_log for manual linking", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queueSelectResponse([]); // no existing webhook event
    db._queueSelectResponse([]); // no existing payment
    db._queueSelectResponse([]); // no booking match
    db._queueSelectResponse([]); // no product order match

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    await POST(
      new Request("https://example.com/api/webhooks/square", {
        method: "POST",
        body: JSON.stringify(makePaymentCompletedEvent({ orderId: "sq-unmatched-999" })),
      }),
    );

    expect(db._payments).toHaveLength(0);
    // A skipped sync_log entry is written
    const skipped = db._syncLog.find((r) => r.status === "skipped");
    expect(skipped).toBeDefined();
    expect(String(skipped!.message)).toMatch(/manual linking/i);
  });

  it("returns 200 even when payment processing throws (always ACK Square)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Queue: idempotency check → not found, then second call throws
    let callCount = 0;
    db.select.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Idempotency check: event not seen before
        const rows: MockRow[] = [];
        const p = Promise.resolve(rows);
        const chain: any = {
          from: () => chain,
          where: () => chain,
          then: p.then.bind(p),
          catch: p.catch.bind(p),
          finally: p.finally.bind(p),
        };
        return chain;
      }
      // Second call (payments squarePaymentId check) → throw inside the try block
      throw new Error("DB connection lost");
    });

    setupMocks(db);
    const { POST } = await import("@/app/api/webhooks/square/route");

    const res = await POST(
      new Request("https://example.com/api/webhooks/square", {
        method: "POST",
        body: JSON.stringify(makePaymentCompletedEvent()),
      }),
    );

    // Always 200 to Square regardless of internal errors
    expect(res.status).toBe(200);
    expect(mockCaptureException).toHaveBeenCalled();
  });
});
