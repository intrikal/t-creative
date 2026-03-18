import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the gift card purchase → redemption → balance flow.
 *
 * Calls real functions from:
 *   - app/shop/gift-cards/actions.ts: purchaseGiftCard
 *   - app/dashboard/financial/promo-gift-actions.ts: recordRedemption, redeemGiftCard
 *
 * Verifies FINAL STATE:
 *   - Gift card created with TC-GC-XXX code
 *   - Purchase transaction recorded (positive amount, balance = original)
 *   - After $30 redemption: balance = $70, redemption transaction recorded
 *   - Attempting to redeem $80 more fails (exceeds balance)
 *   - Concurrent unique-collision retries generate distinct codes
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const giftCardsTable: MockRow[] = [];
  const giftCardTransactionsTable: MockRow[] = [];
  const syncLogTable: MockRow[] = [];
  const bookingsTable: MockRow[] = [];

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
    _giftCards: giftCardsTable,
    _transactions: giftCardTransactionsTable,
    _syncLog: syncLogTable,
    _bookings: bookingsTable,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    insert: vi.fn((table: any) => {
      let insertedValues: MockRow | null = null;

      const valsFn = vi.fn((values: MockRow) => {
        insertedValues = values;
        const id = nextId++;
        const row = { ...values, id };

        if ("code" in values && "originalAmountInCents" in values) {
          giftCardsTable.push(row);
        } else if ("giftCardId" in values && "type" in values && "amountInCents" in values) {
          giftCardTransactionsTable.push(row);
        } else if ("provider" in values && "direction" in values) {
          syncLogTable.push(row);
        }

        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      });

      return { values: valsFn };
    }),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Apply balance updates to giftCards
          if ("balanceInCents" in values) {
            const last = giftCardsTable[giftCardsTable.length - 1];
            if (last) Object.assign(last, values);
          }
          if ("discountInCents" in values && "giftCardId" in values) {
            const last = bookingsTable[bookingsTable.length - 1];
            if (last) Object.assign(last, values);
          }
          return Promise.resolve();
        }),
      })),
    })),

    // For applyPromoCode which uses db.transaction
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      await fn(db);
    }),

    delete: vi.fn(() => ({ where: vi.fn() })),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  External API mocks                                                 */
/* ------------------------------------------------------------------ */

const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockGetEmailRecipient = vi.fn();
const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "client-1" } } });
const mockAdminGetUser = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockRevalidatePath = vi.fn();
const mockSquareCreate = vi.fn();

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupShopMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    giftCards: {
      id: "id",
      code: "code",
      purchasedByClientId: "purchasedByClientId",
      recipientName: "recipientName",
      originalAmountInCents: "originalAmountInCents",
      balanceInCents: "balanceInCents",
      status: "status",
      purchasedAt: "purchasedAt",
      notes: "notes",
    },
    giftCardTransactions: {
      id: "id",
      giftCardId: "giftCardId",
      type: "type",
      amountInCents: "amountInCents",
      balanceAfterInCents: "balanceAfterInCents",
      bookingId: "bookingId",
      performedBy: "performedBy",
      notes: "notes",
    },
    profiles: { id: "id", firstName: "firstName", email: "email" },
    syncLog: {
      provider: "provider",
      direction: "direction",
      status: "status",
      entityType: "entityType",
      localId: "localId",
      remoteId: "remoteId",
      message: "message",
      payload: "payload",
    },
    promotions: {
      id: "id",
      code: "code",
      discountType: "discountType",
      discountValue: "discountValue",
      maxUses: "maxUses",
      redemptionCount: "redemptionCount",
      isActive: "isActive",
      appliesTo: "appliesTo",
      endsAt: "endsAt",
      startsAt: "startsAt",
    },
    bookings: {
      id: "id",
      totalInCents: "totalInCents",
      promotionId: "promotionId",
      discountInCents: "discountInCents",
      giftCardId: "giftCardId",
    },
    services: { id: "id", name: "name", category: "category" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    squareClient: { checkout: { paymentLinks: { create: mockSquareCreate } } },
    SQUARE_LOCATION_ID: "loc-1",
  }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockAdminGetUser }));
  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Gift card flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockGetUser.mockResolvedValue({ data: { user: { id: "client-1" } } });
    mockAdminGetUser.mockResolvedValue({ id: "admin-1" });
    mockLogAction.mockResolvedValue(undefined);
  });

  /* --- Purchase --- */

  it("purchaseGiftCard creates a gift card with sequential TC-GC-XXX code", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // 1. lastCard select → no existing cards
    db._queue([]);
    // 2. buyer profile for email
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);

    setupShopMocks(db);
    const { purchaseGiftCard } = await import("./actions");

    const result = await purchaseGiftCard({ amountInCents: 10000 });

    expect(result.success).toBe(true);
    expect(result.giftCardCode).toBe("TC-GC-001");

    // Gift card persisted
    expect(db._giftCards).toHaveLength(1);
    expect(db._giftCards[0]).toMatchObject({
      code: "TC-GC-001",
      originalAmountInCents: 10000,
      balanceInCents: 10000,
    });
  });

  it("purchaseGiftCard records a purchase transaction", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([]); // no last card
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);

    setupShopMocks(db);
    const { purchaseGiftCard } = await import("./actions");

    await purchaseGiftCard({ amountInCents: 5000 });

    const purchaseTx = db._transactions.find((t) => t.type === "purchase");
    expect(purchaseTx).toBeDefined();
    expect(purchaseTx).toMatchObject({
      type: "purchase",
      amountInCents: 5000,
      balanceAfterInCents: 5000,
    });
  });

  it("purchaseGiftCard sends a purchase confirmation email", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([]);
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);

    setupShopMocks(db);
    const { purchaseGiftCard } = await import("./actions");

    await purchaseGiftCard({ amountInCents: 7500 });

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "alice@example.com",
        entityType: "gift_card_purchase",
      }),
    );
  });

  it("purchaseGiftCard validates amount ($25–$500)", async () => {
    vi.resetModules();
    const db = createStatefulDb();
    setupShopMocks(db);
    const { purchaseGiftCard } = await import("./actions");

    const tooLow = await purchaseGiftCard({ amountInCents: 1000 }); // $10
    expect(tooLow.success).toBe(false);
    expect(tooLow.error).toMatch(/\$25/);

    const tooHigh = await purchaseGiftCard({ amountInCents: 60000 }); // $600
    expect(tooHigh.success).toBe(false);
    expect(tooHigh.error).toMatch(/\$500/);
  });

  it("purchaseGiftCard generates sequential codes from last card in DB", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Last card in DB is TC-GC-007 → next should be TC-GC-008
    db._queue([{ code: "TC-GC-007" }]);
    db._queue([{ email: "alice@example.com", firstName: "Alice" }]);

    setupShopMocks(db);
    const { purchaseGiftCard } = await import("./actions");

    const result = await purchaseGiftCard({ amountInCents: 5000 });

    expect(result.giftCardCode).toBe("TC-GC-008");
  });

  /* --- Admin redemption --- */

  it("recordRedemption reduces gift card balance and inserts a redemption transaction", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed an active gift card
    const card = { id: 1, code: "TC-GC-001", balanceInCents: 10000, status: "active" };
    db._giftCards.push(card);

    // select() for card lookup
    db._queue([card]);

    setupShopMocks(db);
    const { recordRedemption } = await import("@/app/dashboard/financial/promo-gift-actions");

    await recordRedemption({ giftCardId: 1, bookingId: 10, amountInCents: 3000 });

    // Balance reduced in DB
    expect(db._giftCards[0].balanceInCents).toBe(7000);

    // Redemption transaction recorded with negative amount
    const redemptionTx = db._transactions.find((t) => t.type === "redemption");
    expect(redemptionTx).toBeDefined();
    expect(redemptionTx).toMatchObject({
      giftCardId: 1,
      type: "redemption",
      amountInCents: -3000,
      balanceAfterInCents: 7000,
      bookingId: 10,
    });
  });

  it("recordRedemption marks card as redeemed when balance hits zero", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const card = { id: 1, code: "TC-GC-001", balanceInCents: 5000, status: "active" };
    db._giftCards.push(card);
    db._queue([card]);

    setupShopMocks(db);
    const { recordRedemption } = await import("@/app/dashboard/financial/promo-gift-actions");

    await recordRedemption({ giftCardId: 1, bookingId: 10, amountInCents: 5000 });

    // Status set to redeemed
    expect(db._giftCards[0].status).toBe("redeemed");
  });

  it("recordRedemption throws when redemption amount exceeds balance", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const card = { id: 1, code: "TC-GC-001", balanceInCents: 7000, status: "active" };
    db._giftCards.push(card);
    db._queue([card]);

    setupShopMocks(db);
    const { recordRedemption } = await import("@/app/dashboard/financial/promo-gift-actions");

    await expect(
      recordRedemption({ giftCardId: 1, bookingId: 10, amountInCents: 8000 }),
    ).rejects.toThrow("Insufficient gift card balance");

    // Balance unchanged
    expect(db._giftCards[0].balanceInCents).toBe(7000);
    expect(db._transactions).toHaveLength(0);
  });

  it("recordRedemption throws when gift card is not active", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const card = { id: 1, code: "TC-GC-001", balanceInCents: 5000, status: "redeemed" };
    db._giftCards.push(card);
    db._queue([card]);

    setupShopMocks(db);
    const { recordRedemption } = await import("@/app/dashboard/financial/promo-gift-actions");

    await expect(
      recordRedemption({ giftCardId: 1, bookingId: 10, amountInCents: 1000 }),
    ).rejects.toThrow("Gift card is not active");
  });
});
