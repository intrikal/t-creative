// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Integration tests for the promo code create → validate → apply flow.
 *
 * Calls real functions from:
 *   - promo-gift-actions.ts: createPromotion, validatePromoCode, applyPromoCode
 *
 * Verifies FINAL STATE:
 *   - validatePromoCode returns correct discount details
 *   - applyPromoCode writes discountInCents on the booking
 *   - applyPromoCode increments redemptionCount
 *   - Third use of maxUses:2 promo fails
 *   - Expired promo returns "expired" on validate
 *   - Category-restricted promo rejects wrong category
 */

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

function createStatefulDb() {
  const promotionsTable: MockRow[] = [];
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
    _promotions: promotionsTable,
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

    insert: vi.fn((table: any) => ({
      values: vi.fn((values: MockRow) => {
        const id = nextId++;
        const row = { ...values, id };
        if ("code" in values && "discountType" in values) {
          promotionsTable.push(row);
        }
        const returning = vi.fn().mockResolvedValue([{ id }]);
        return { returning };
      }),
    })),

    update: vi.fn((table: any) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn(() => {
          // Apply discount updates to bookings
          if ("discountInCents" in values || "promotionId" in values) {
            const last = bookingsTable[bookingsTable.length - 1];
            if (last) Object.assign(last, values);
          }
          // Apply redemptionCount increments to promotions
          if ("redemptionCount" in values) {
            const promo = promotionsTable[promotionsTable.length - 1];
            if (promo) {
              // sql increment — just bump by 1 in the mock
              promo.redemptionCount = (Number(promo.redemptionCount) || 0) + 1;
            }
          }
          return Promise.resolve();
        }),
      })),
    })),

    // applyPromoCode uses db.transaction
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

const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockAdminGetUser = vi.fn().mockResolvedValue({ id: "admin-1" });
const mockRevalidatePath = vi.fn();

/* ------------------------------------------------------------------ */
/*  Promo factories                                                    */
/* ------------------------------------------------------------------ */

function makePromoRow(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: 1,
    code: "SAVE20",
    discountType: "percent",
    discountValue: 20,
    maxUses: null,
    redemptionCount: 0,
    isActive: true,
    appliesTo: null,
    endsAt: null,
    startsAt: null,
    description: null,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Setup helper                                                       */
/* ------------------------------------------------------------------ */

function setupMocks(db: ReturnType<typeof createStatefulDb>) {
  vi.doMock("@/db", () => ({ db }));
  vi.doMock("@/db/schema", () => ({
    promotions: {
      id: "id",
      code: "code",
      discountType: "discountType",
      discountValue: "discountValue",
      description: "description",
      appliesTo: "appliesTo",
      maxUses: "maxUses",
      redemptionCount: "redemptionCount",
      isActive: "isActive",
      startsAt: "startsAt",
      endsAt: "endsAt",
      createdAt: "createdAt",
    },
    bookings: {
      id: "id",
      totalInCents: "totalInCents",
      promotionId: "promotionId",
      discountInCents: "discountInCents",
    },
    giftCards: {
      id: "id",
      code: "code",
      balanceInCents: "balanceInCents",
      status: "status",
      purchasedByClientId: "purchasedByClientId",
      originalAmountInCents: "originalAmountInCents",
      purchasedAt: "purchasedAt",
    },
    giftCardTransactions: { id: "id", giftCardId: "giftCardId", type: "type" },
    services: { id: "id", name: "name", category: "category" },
    profiles: { id: "id", firstName: "firstName", email: "email" },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    asc: vi.fn((...a: unknown[]) => ({ type: "asc", a })),
    sql: Object.assign(vi.fn((...a: unknown[]) => ({ type: "sql", a })), {
      join: vi.fn(() => ({ type: "sql_join" })),
    }),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_t: any, name: string) => ({ _alias: name })),
  }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockAdminGetUser }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: vi.fn().mockResolvedValue(true),
    getEmailRecipient: vi.fn().mockResolvedValue(null),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("Promo code flow — integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminGetUser.mockResolvedValue({ id: "admin-1" });
    mockLogAction.mockResolvedValue(undefined);
  });

  /* --- Validate --- */

  it("validatePromoCode returns valid + discount details for an active promo", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([makePromoRow()]);

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("SAVE20");

    expect(result.valid).toBe(true);
    expect(result.discountType).toBe("percent");
    expect(result.discountValue).toBe(20);
  });

  it("validatePromoCode returns invalid when promo code not found", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([]); // not found

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("BADCODE");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/not found/i);
  });

  it("validatePromoCode returns expired when endsAt is in the past", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    db._queue([makePromoRow({ endsAt: pastDate })]);

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("SAVE20");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/expired/i);
  });

  it("validatePromoCode returns max uses reached when redemptionCount >= maxUses", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([makePromoRow({ maxUses: 2, redemptionCount: 2 })]);

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("SAVE20");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/max uses/i);
  });

  it("validatePromoCode rejects wrong category when promo has appliesTo restriction", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([makePromoRow({ appliesTo: "lash" })]);

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("SAVE20", "jewelry");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/lash/i);
  });

  it("validatePromoCode accepts matching category restriction", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([makePromoRow({ appliesTo: "lash" })]);

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("SAVE20", "lash");
    expect(result.valid).toBe(true);
  });

  /* --- Apply --- */

  it("applyPromoCode writes discountInCents on the booking (percent type)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    // Seed booking
    const booking = { id: 10, totalInCents: 10000 };
    db._bookings.push(booking);

    // transaction: promo select, then booking select
    db._queue([makePromoRow({ code: "SAVE20", discountType: "percent", discountValue: 20 })]);
    db._queue([booking]);

    setupMocks(db);
    const { applyPromoCode } = await import("./promo-gift-actions");

    await applyPromoCode(10, "SAVE20");

    // 20% of $100 = $20 discount
    expect(db._bookings[0].discountInCents).toBe(2000);
    expect(db._bookings[0].promotionId).toBe(1);
  });

  it("applyPromoCode increments redemptionCount after successful apply", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const promo = makePromoRow({ redemptionCount: 0 });
    db._promotions.push(promo);
    const booking = { id: 10, totalInCents: 10000 };
    db._bookings.push(booking);

    db._queue([promo]);
    db._queue([booking]);

    setupMocks(db);
    const { applyPromoCode } = await import("./promo-gift-actions");

    await applyPromoCode(10, "SAVE20");

    expect(db._promotions[0].redemptionCount).toBe(1);
  });

  it("applyPromoCode throws when max uses already reached", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    db._queue([makePromoRow({ maxUses: 2, redemptionCount: 2 })]);

    setupMocks(db);
    const { applyPromoCode } = await import("./promo-gift-actions");

    await expect(applyPromoCode(10, "SAVE20")).rejects.toThrow("Promo code has reached max uses");
  });

  it("applyPromoCode applies fixed discount capped at booking total", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const booking = { id: 10, totalInCents: 3000 }; // $30 booking
    db._bookings.push(booking);

    // Fixed $50 discount on a $30 booking → capped at $30
    db._queue([makePromoRow({ discountType: "fixed", discountValue: 5000 })]);
    db._queue([booking]);

    setupMocks(db);
    const { applyPromoCode } = await import("./promo-gift-actions");

    await applyPromoCode(10, "SAVE20");

    // Capped at booking total
    expect(db._bookings[0].discountInCents).toBe(3000);
  });

  it("applyPromoCode applies bogo discount (50% of total)", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const booking = { id: 10, totalInCents: 8000 }; // $80
    db._bookings.push(booking);

    db._queue([makePromoRow({ discountType: "bogo", discountValue: 1 })]);
    db._queue([booking]);

    setupMocks(db);
    const { applyPromoCode } = await import("./promo-gift-actions");

    await applyPromoCode(10, "SAVE20");

    // bogo = 50% off → $40
    expect(db._bookings[0].discountInCents).toBe(4000);
  });

  /* --- Expiry test --- */

  it("validatePromoCode returns not yet active when startsAt is in the future", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    db._queue([makePromoRow({ startsAt: futureDate })]);

    setupMocks(db);
    const { validatePromoCode } = await import("./promo-gift-actions");

    const result = await validatePromoCode("SAVE20");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/not yet active/i);
  });

  it("createPromotion → validatePromoCode round-trip: newly created promo is valid", async () => {
    vi.resetModules();
    const db = createStatefulDb();

    setupMocks(db);
    const { createPromotion, validatePromoCode } = await import("./promo-gift-actions");

    await createPromotion({ code: "NEWCODE", discountType: "percent", discountValue: 10 });

    // Promo inserted
    expect(db._promotions).toHaveLength(1);
    expect(db._promotions[0].code).toBe("NEWCODE");

    // Queue the inserted promo for the validate lookup
    // isActive defaults to true in the DB but the insert doesn't include it;
    // add it explicitly so validatePromoCode's !promo.isActive check passes
    const insertedPromo = { ...db._promotions[0], isActive: true };
    db._queue([insertedPromo]);
    const result = await validatePromoCode("NEWCODE");

    expect(result.valid).toBe(true);
    expect(result.discountValue).toBe(10);
  });
});
