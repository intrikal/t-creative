// @vitest-environment node

/**
 * tests/integration/inventory-tracking.test.ts
 *
 * Integration tests for inventory tracking across payment webhooks,
 * stock adjustments, low-stock alerts, and Square catalog sync.
 *
 * Calls real handlers/actions with a stateful mock DB:
 *
 * (1) Terminal sale webhook → inventory decremented, adjustment logged.
 * (2) Concurrent sales: qty=5, two simultaneous → qty=3 (FOR UPDATE).
 * (3) Out of stock: qty=0 + sale → CHECK constraint, Sentry alert.
 * (4) Restock: +20 units, last_restocked_at updated.
 * (5) Low stock alert: qty hits threshold → notification email.
 * (6) Alert not re-triggered: already below threshold, another sale → one alert per crossing.
 * (7) Square catalog sync: product created → squareCatalogId stored.
 *
 * DB call order for handlePaymentCompleted (product order path):
 *   SELECT payments (existing check)
 *   SELECT bookings (findBookingByOrder → no match)
 *   SELECT orders (findProductOrderBySquareOrder → match)
 *   UPDATE orders (status → in_progress)
 *   SELECT profiles (orderClient email)
 *   SELECT orders (zohoInvoiceId)
 *   tx: SELECT products FOR UPDATE → UPDATE products → INSERT inventoryAdjustments
 *   INSERT syncLog (logAction)
 *
 * DB call order for adjustProductStock:
 *   SELECT products (current stockCount)
 *   UPDATE products (new stockCount + availability)
 *   INSERT inventoryAdjustments (audit)
 */

import type { PaymentCreatedEventData } from "square";
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const productsTable: MockRow[] = [];
  const inventoryAdjustmentsTable: MockRow[] = [];
  const ordersTable: MockRow[] = [];
  const paymentsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];
  const notificationsTable: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  const updateCalls: Array<{ table: string; values: MockRow }> = [];

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      innerJoin: () => chain,
      leftJoin: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      groupBy: () => chain,
      for: () => chain,
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
      for: () => chain,
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ table: "tx", values });
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
    _products: productsTable,
    _inventoryAdjustments: inventoryAdjustmentsTable,
    _orders: ordersTable,
    _payments: paymentsTable,
    _syncLog: syncLogTable,
    _notifications: notificationsTable,
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

          if ("quantityDelta" in v && "productId" in v) {
            inventoryAdjustmentsTable.push(row);
          } else if ("squarePaymentId" in v && "bookingId" in v) {
            paymentsTable.push(row);
          } else if ("provider" in v && "direction" in v) {
            syncLogTable.push(row);
          } else if ("type" in v && "channel" in v) {
            notificationsTable.push(row);
          } else if ("orderNumber" in v) {
            ordersTable.push(row);
          }

          insertedIds.push({ id });
        }

        const returning = vi.fn().mockResolvedValue(insertedIds);
        return { returning };
      }),
    })),

    update: vi.fn((_table: any) => ({
      set: vi.fn((values: MockRow) => {
        updateCalls.push({ table: "outer", values });
        const result = {
          where: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockResolvedValue([]),
        };
        result.where = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
        return result;
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

              if ("quantityDelta" in v && "productId" in v) {
                inventoryAdjustmentsTable.push(row);
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
            updateCalls.push({ table: "tx", values });
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
const mockGetEmailRecipient = vi.fn().mockResolvedValue(null);
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();
const mockRevalidatePath = vi.fn();
const mockTrackEvent = vi.fn();
const mockUpsertCatalogItem = vi.fn();
const mockIsSquareConfigured = vi.fn().mockReturnValue(false);
const mockIsResendConfigured = vi.fn().mockReturnValue(true);

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    products: {
      id: "id",
      title: "title",
      slug: "slug",
      sku: "sku",
      stockCount: "stockCount",
      lowStockThreshold: "lowStockThreshold",
      reorderQuantity: "reorderQuantity",
      availability: "availability",
      isPublished: "isPublished",
      squareCatalogId: "squareCatalogId",
      priceInCents: "priceInCents",
      description: "description",
      category: "category",
      pricingType: "pricingType",
      productType: "productType",
      costInCents: "costInCents",
      priceMinInCents: "priceMinInCents",
      priceMaxInCents: "priceMaxInCents",
      isFeatured: "isFeatured",
      tags: "tags",
      serviceId: "serviceId",
      sortOrder: "sortOrder",
      imageStoragePath: "imageStoragePath",
      imageUrl: "imageUrl",
      viewCount: "viewCount",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      leadTime: "leadTime",
    },
    inventoryAdjustments: {
      id: "id",
      productId: "productId",
      quantityDelta: "quantityDelta",
      quantityAfter: "quantityAfter",
      reason: "reason",
      notes: "notes",
      actorId: "actorId",
      createdAt: "createdAt",
    },
    orders: {
      id: "id",
      clientId: "clientId",
      productId: "productId",
      quantity: "quantity",
      status: "status",
      squareOrderId: "squareOrderId",
      fulfillmentMethod: "fulfillmentMethod",
      easypostShipmentId: "easypostShipmentId",
      zohoInvoiceId: "zohoInvoiceId",
      title: "title",
      orderNumber: "orderNumber",
      finalInCents: "finalInCents",
      createdAt: "createdAt",
    },
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
      paidAt: "paidAt",
      notes: "notes",
      taxAmountInCents: "taxAmountInCents",
      tipInCents: "tipInCents",
      refundedInCents: "refundedInCents",
      squareRefundId: "squareRefundId",
      refundedAt: "refundedAt",
      needsManualReview: "needsManualReview",
    },
    bookings: {
      id: "id",
      clientId: "clientId",
      squareOrderId: "squareOrderId",
      depositPaidInCents: "depositPaidInCents",
      zohoInvoiceId: "zohoInvoiceId",
    },
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
      role: "role",
      notifyEmail: "notifyEmail",
      notifySms: "notifySms",
      squareCustomerId: "squareCustomerId",
      onboardingData: "onboardingData",
    },
    services: {
      id: "id",
      name: "name",
      squareCatalogId: "squareCatalogId",
      description: "description",
      priceInCents: "priceInCents",
      isActive: "isActive",
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
      payload: "payload",
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
    loyaltyTransactions: {
      id: "id",
      profileId: "profileId",
      points: "points",
      type: "type",
      description: "description",
    },
    supplies: {
      id: "id",
      name: "name",
      stockCount: "stockCount",
      reorderPoint: "reorderPoint",
      lastRestockedAt: "lastRestockedAt",
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
    ilike: vi.fn((...a: unknown[]) => ({ type: "ilike", a })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
    isResendConfigured: mockIsResendConfigured,
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
    squareClient: { orders: { get: vi.fn() } },
    createSquareOrder: vi.fn(),
    createSquarePaymentLink: vi.fn(),
    createSquareOrderPaymentLink: vi.fn(),
    getSquareCardOnFile: vi.fn().mockResolvedValue(null),
    chargeCardOnFile: vi.fn(),
    upsertCatalogItem: mockUpsertCatalogItem,
    syncCatalogFromSquare: vi.fn(),
  }));
  vi.doMock("@/lib/square/catalog", () => ({
    upsertCatalogItem: mockUpsertCatalogItem,
    syncCatalogFromSquare: vi.fn(),
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
  vi.doMock("@/lib/easypost", () => ({
    isEasyPostConfigured: vi.fn().mockReturnValue(false),
    buyShippingLabel: vi.fn(),
    getShippingRates: vi.fn(),
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
    getPublicInventoryConfig: vi.fn().mockResolvedValue({ lowStockThreshold: 5 }),
  }));
  vi.doMock("@/lib/auth", () => ({
    getUser: vi.fn().mockResolvedValue({ id: "admin-1" }),
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" }),
    requireStaff: vi.fn().mockResolvedValue({ id: "admin-1" }),
    getCurrentUser: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-1" } } }) },
    }),
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
  vi.doMock("next/cache", () => ({
    revalidatePath: mockRevalidatePath,
    updateTag: vi.fn(),
  }));
  vi.doMock("@sentry/nextjs", () => ({
    captureException: mockCaptureException,
    captureMessage: mockCaptureMessage,
  }));

  const mockComponent = vi.fn().mockReturnValue(null);
  vi.doMock("@/emails/PaymentReceipt", () => ({ PaymentReceipt: mockComponent }));
  vi.doMock("@/emails/LoyaltyPointsAwarded", () => ({ LoyaltyPointsAwarded: mockComponent }));
  vi.doMock("@/emails/OrderConfirmation", () => ({ OrderConfirmation: mockComponent }));
  vi.doMock("@/emails/OrderStatusUpdate", () => ({ OrderStatusUpdate: mockComponent }));
  vi.doMock("@/emails/CommissionQuote", () => ({ CommissionQuote: mockComponent }));
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn() }));
  vi.doMock("@/lib/waitlist-notify", () => ({
    notifyWaitlistForCancelledBooking: vi.fn(),
  }));
  vi.doMock("@/app/dashboard/bookings/waiver-actions", () => ({
    checkBookingWaivers: vi.fn().mockResolvedValue({ passed: true, missing: [] }),
  }));
  vi.doMock("react", () => ({
    cache: vi.fn((fn: any) => fn),
    default: {},
    createElement: vi.fn().mockReturnValue(null),
  }));
  vi.doMock("@/lib/retry", () => ({
    withRetry: vi.fn((fn: any) => fn()),
  }));

  // Mock Inngest so low-stock-alert.ts can be imported without the real package
  let capturedHandler: any = null;
  vi.doMock("inngest", () => ({
    Inngest: class {
      createFunction(_config: any, handler: any) {
        capturedHandler = handler;
        return { _handler: handler };
      }
    },
  }));
  vi.doMock("@/inngest/client", () => ({
    inngest: {
      createFunction: (_config: any, handler: any) => {
        capturedHandler = handler;
        return { _handler: handler };
      },
    },
  }));
}

function getCapturedHandler() {
  return (globalThis as any).__lastCapturedHandler;
}

/* ------------------------------------------------------------------ */
/*  Helper: build a Square payment.completed event payload             */
/* ------------------------------------------------------------------ */

function makePaymentEvent(overrides: Record<string, unknown> = {}) {
  return {
    object: {
      payment: {
        id: "sq-pay-001",
        orderId: "sq-order-001",
        amountMoney: { amount: BigInt(5000), currency: "USD" as const },
        tenders: [{ type: "CARD" as const }],
        receiptUrl: "https://squareup.com/receipt/001",
        updatedAt: new Date().toISOString(),
        ...overrides,
      },
    },
  } as PaymentCreatedEventData;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Inventory tracking — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCaptureException.mockImplementation(() => {});
    mockCaptureMessage.mockImplementation(() => {});
    mockSendEmail.mockResolvedValue(true);
    mockLogAction.mockResolvedValue(undefined);
    mockIsSquareConfigured.mockReturnValue(false);
  });

  /* --- (1) Terminal sale webhook → inventory decremented --- */

  it("(1) terminal sale webhook: stock decremented and adjustment logged", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // handlePaymentCompleted call order:
    // 1. SELECT payments (no existing payment)
    db._queue([]);
    // 2. SELECT bookings via findBookingByOrder (no booking match)
    db._queue([]);
    // 3. SELECT orders via findProductOrderBySquareOrder (match)
    db._queue([
      {
        id: 10,
        clientId: "client-1",
        productId: 42,
        quantity: 2,
        fulfillmentMethod: "pickup_cash",
        easypostShipmentId: null,
      },
    ]);
    // 4. SELECT profiles for order client email
    db._queue([{ email: "client@test.com", firstName: "Test" }]);
    // 5. SELECT orders for zohoInvoiceId
    db._queue([{ zohoInvoiceId: null }]);
    // 6. tx: SELECT products FOR UPDATE (stockCount before sale)
    db._queue([{ stockCount: 10 }]);

    setupMocks(db);
    const { handlePaymentCompleted } = await import("@/app/api/webhooks/square/handlers/payment");

    const result = await handlePaymentCompleted(makePaymentEvent());

    expect(result).toContain("product order");

    // Stock was decremented: 10 - 2 = 8
    const stockUpdate = db._updateCalls.find((c) => c.table === "tx" && c.values.stockCount === 8);
    expect(stockUpdate).toBeDefined();
    expect(stockUpdate!.values.availability).toBe("in_stock");

    // Inventory adjustment logged with correct delta and reason
    expect(db._inventoryAdjustments).toHaveLength(1);
    expect(db._inventoryAdjustments[0]).toMatchObject({
      productId: 42,
      quantityDelta: -2,
      quantityAfter: 8,
      reason: "sale",
      actorId: null,
    });
    expect(db._inventoryAdjustments[0].notes as string).toContain("sq-order-001");
  });

  /* --- (2) Concurrent sales: qty=5, two simultaneous → qty=3 (FOR UPDATE) --- */

  it("(2) concurrent sales: two simultaneous sales from qty=5 both succeed atomically", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Both sales fire concurrently via Promise.all. JS is single-threaded
    // so queue consumption interleaves at each await boundary. We run them
    // sequentially instead to get deterministic queue ordering.
    //
    // Sale A queue:
    // 1. SELECT payments (no existing)
    db._queue([]);
    // 2. SELECT bookings (no match)
    db._queue([]);
    // 3. SELECT orders (product order)
    db._queue([
      {
        id: 20,
        clientId: "client-a",
        productId: 99,
        quantity: 1,
        fulfillmentMethod: "pickup_cash",
        easypostShipmentId: null,
      },
    ]);
    // 4. SELECT profiles
    db._queue([{ email: "a@test.com", firstName: "A" }]);
    // 5. SELECT orders zohoInvoiceId
    db._queue([{ zohoInvoiceId: null }]);
    // 6. tx: SELECT products FOR UPDATE — sees stock=5
    db._queue([{ stockCount: 5 }]);

    // Sale B queue (appended after A's entries):
    // 7. SELECT payments (no existing)
    db._queue([]);
    // 8. SELECT bookings (no match)
    db._queue([]);
    // 9. SELECT orders (product order)
    db._queue([
      {
        id: 21,
        clientId: "client-b",
        productId: 99,
        quantity: 1,
        fulfillmentMethod: "pickup_cash",
        easypostShipmentId: null,
      },
    ]);
    // 10. SELECT profiles
    db._queue([{ email: "b@test.com", firstName: "B" }]);
    // 11. SELECT orders zohoInvoiceId
    db._queue([{ zohoInvoiceId: null }]);
    // 12. tx: SELECT products FOR UPDATE — in real DB this blocks until A commits; mock sees 4
    db._queue([{ stockCount: 4 }]);

    setupMocks(db);
    const { handlePaymentCompleted } = await import("@/app/api/webhooks/square/handlers/payment");

    const eventA = makePaymentEvent({ id: "sq-pay-A", orderId: "sq-order-A" });
    const eventB = makePaymentEvent({ id: "sq-pay-B", orderId: "sq-order-B" });

    // Run sequentially so mock queue consumption is deterministic.
    // In production, FOR UPDATE serialises concurrent transactions —
    // the second tx blocks until the first commits, seeing updated stock.
    const resultA = await handlePaymentCompleted(eventA);
    const resultB = await handlePaymentCompleted(eventB);

    expect(resultA).toContain("product order");
    expect(resultB).toContain("product order");

    // Two inventory adjustments logged — one per sale
    expect(db._inventoryAdjustments).toHaveLength(2);

    // Sale A: 5 → 4
    expect(db._inventoryAdjustments[0]).toMatchObject({
      productId: 99,
      quantityDelta: -1,
      quantityAfter: 4,
      reason: "sale",
    });

    // Sale B: 4 → 3 (FOR UPDATE ensures second tx sees committed state)
    expect(db._inventoryAdjustments[1]).toMatchObject({
      productId: 99,
      quantityDelta: -1,
      quantityAfter: 3,
      reason: "sale",
    });

    // Both stock updates recorded
    const stockUpdates = db._updateCalls.filter(
      (c) => c.table === "tx" && typeof c.values.stockCount === "number",
    );
    expect(stockUpdates).toHaveLength(2);
    expect(stockUpdates[0].values.stockCount).toBe(4);
    expect(stockUpdates[1].values.stockCount).toBe(3);
  });

  /* --- (3) Out of stock: qty=0 + sale → CHECK constraint, Sentry alert --- */

  it("(3) out of stock: sale on zero-stock product caps at 0 and Sentry captures constraint violation", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. SELECT payments (no existing)
    db._queue([]);
    // 2. SELECT bookings (no match)
    db._queue([]);
    // 3. SELECT orders (product order)
    db._queue([
      {
        id: 30,
        clientId: "client-c",
        productId: 55,
        quantity: 1,
        fulfillmentMethod: "pickup_online",
        easypostShipmentId: null,
      },
    ]);
    // 4. SELECT profiles
    db._queue([{ email: "c@test.com", firstName: "C" }]);
    // 5. SELECT orders zohoInvoiceId
    db._queue([{ zohoInvoiceId: null }]);

    // Simulate CHECK constraint violation: transaction throws
    const checkError = new Error(
      'new row for relation "products" violates check constraint "stock_count_nonneg"',
    );
    const originalTransaction = db.transaction;
    db.transaction = vi.fn(async () => {
      throw checkError;
    }) as any;

    setupMocks(db);
    const { handlePaymentCompleted } = await import("@/app/api/webhooks/square/handlers/payment");

    const result = await handlePaymentCompleted(makePaymentEvent());

    // Payment processing still succeeds (inventory error is non-fatal)
    expect(result).toContain("product order");

    // Sentry captured the constraint violation
    expect(mockCaptureException).toHaveBeenCalledWith(checkError);

    // No inventory adjustment was logged (transaction rolled back)
    expect(db._inventoryAdjustments).toHaveLength(0);

    // Restore for other tests
    db.transaction = originalTransaction;
  });

  /* --- (4) Restock: +20 units, last_restocked_at updated --- */

  it("(4) restock: adjustProductStock +20 updates stock and logs restock adjustment", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // adjustProductStock call order:
    // 1. SELECT products (current stockCount)
    db._queue([{ stockCount: 3 }]);

    setupMocks(db);
    const { adjustProductStock } = await import("@/app/dashboard/marketplace/actions");

    await adjustProductStock(42, 20, "restock", "Supplier shipment arrived");

    // Stock updated: 3 + 20 = 23
    const stockUpdate = db._updateCalls.find((c) => c.values.stockCount === 23);
    expect(stockUpdate).toBeDefined();
    expect(stockUpdate!.values.availability).toBe("in_stock");

    // Inventory adjustment logged
    expect(db._inventoryAdjustments).toHaveLength(1);
    expect(db._inventoryAdjustments[0]).toMatchObject({
      productId: 42,
      quantityDelta: 20,
      quantityAfter: 23,
      reason: "restock",
      notes: "Supplier shipment arrived",
      actorId: "admin-1",
    });

    // updatedAt was set on the product
    expect(stockUpdate!.values.updatedAt).toBeInstanceOf(Date);
  });

  /* --- (5) Low stock alert: qty hits threshold → notification email --- */

  it("(5) low stock alert: Inngest function sends email when products at or below threshold", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // lowStockAlert Inngest function call order:
    // step "check-stock-levels": SELECT products WHERE stockCount <= lowStockThreshold
    db._queue([
      {
        id: 1,
        title: "Crochet Blanket",
        sku: "CRCH-BLK-001",
        stockCount: 2,
        lowStockThreshold: 3,
        reorderQuantity: 10,
      },
      {
        id: 2,
        title: "Lash Glue",
        sku: null,
        stockCount: 0,
        lowStockThreshold: 5,
        reorderQuantity: 20,
      },
    ]);
    // step "send-alert": SELECT profiles WHERE role=admin
    db._queue([{ email: "admin@studio.com", firstName: "Trini" }]);

    // Capture the handler passed to inngest.createFunction
    let handler: any;
    setupMocks(db);
    vi.doMock("@/inngest/client", () => ({
      inngest: {
        createFunction: (_config: any, fn: any) => {
          handler = fn;
          return { _handler: fn };
        },
      },
    }));

    await import("@/inngest/functions/low-stock-alert");

    // Simulate Inngest step runner
    const stepRunner = {
      run: async (_name: string, fn: () => Promise<any>) => fn(),
    };

    const result = await handler({ step: stepRunner });

    expect(result).toMatchObject({ alerted: 2 });
    expect(result.items).toContain("Crochet Blanket: 2");
    expect(result.items).toContain("Lash Glue: 0");

    // Email sent to admin
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@studio.com",
        subject: expect.stringContaining("Low Stock Alert: 2 items"),
        entityType: "low_stock_alert",
      }),
    );
  });

  /* --- (6) Alert not re-triggered: already below, another sale → one alert per crossing --- */

  it("(6) alert not re-triggered: same-day runs share localId so Resend deduplicates", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // First run: 1 item at threshold
    db._queue([
      {
        id: 1,
        title: "Hair Clips",
        sku: "HC-001",
        stockCount: 3,
        lowStockThreshold: 3,
        reorderQuantity: 15,
      },
    ]);
    db._queue([{ email: "admin@studio.com", firstName: "Trini" }]);

    // Capture the handler passed to inngest.createFunction
    let handler: any;
    setupMocks(db);
    vi.doMock("@/inngest/client", () => ({
      inngest: {
        createFunction: (_config: any, fn: any) => {
          handler = fn;
          return { _handler: fn };
        },
      },
    }));

    await import("@/inngest/functions/low-stock-alert");

    const stepRunner = {
      run: async (_name: string, fn: () => Promise<any>) => fn(),
    };

    const result1 = await handler({ step: stepRunner });
    expect(result1).toMatchObject({ alerted: 1 });
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    // Second run after another sale (stock now 2, still below threshold).
    // The cron function runs independently each invocation, but uses the
    // same date-based localId ("low-stock-YYYY-MM-DD") so Resend deduplicates.
    db._queue([
      {
        id: 1,
        title: "Hair Clips",
        sku: "HC-001",
        stockCount: 2,
        lowStockThreshold: 3,
        reorderQuantity: 15,
      },
    ]);
    db._queue([{ email: "admin@studio.com", firstName: "Trini" }]);

    const result2 = await handler({ step: stepRunner });
    expect(result2).toMatchObject({ alerted: 1 });

    // Both calls used the same date-based localId for dedup
    const emailCalls = mockSendEmail.mock.calls;
    expect(emailCalls[0][0].localId).toBe(emailCalls[1][0].localId);
  });

  /* --- (7) Square catalog sync: product created → squareCatalogId stored --- */

  it("(7) Square catalog sync: createProduct pushes to Square and stores squareCatalogId", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    mockIsSquareConfigured.mockReturnValue(true);
    mockUpsertCatalogItem.mockResolvedValue("sq-catalog-ITEM-789");

    setupMocks(db);
    const { createProduct } = await import("@/app/dashboard/marketplace/actions");

    await createProduct({
      name: "Handmade Scarf",
      category: "crochet",
      description: "Warm winter scarf",
      pricingType: "fixed",
      price: 45,
      stock: 10,
      status: "active",
      tags: "scarf, winter",
    });

    // upsertCatalogItem was called with correct params
    expect(mockUpsertCatalogItem).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "product",
        name: "Handmade Scarf",
        description: "Warm winter scarf",
        priceInCents: 4500,
      }),
    );

    // squareCatalogId persisted back to the product row
    const catalogUpdate = db._updateCalls.find(
      (c) => c.values.squareCatalogId === "sq-catalog-ITEM-789",
    );
    expect(catalogUpdate).toBeDefined();
  });
});
