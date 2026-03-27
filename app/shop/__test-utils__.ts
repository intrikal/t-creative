/**
 * Shared test utilities for shop checkout tests.
 *
 * Exports:
 * - `createStatefulDb` — in-memory DB that tracks inserts/updates across tables
 * - `setupMocks` — registers all vi.doMock() calls for the shop actions module
 * - `mockSendEmail` — shared mock ref for email assertions
 * - `makeProduct` / `makeGuestInfo` — data factories
 */
import { vi } from "vitest";

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

export const mockSendEmail = vi.fn().mockResolvedValue(true);

/* ------------------------------------------------------------------ */
/*  Stateful mock DB                                                   */
/* ------------------------------------------------------------------ */

type MockRow = Record<string, unknown>;

export function createStatefulDb() {
  const _orders: MockRow[] = [];
  const _products: MockRow[] = [];
  const _giftCards: MockRow[] = [];
  const _giftCardTransactions: MockRow[] = [];
  const _profiles: MockRow[] = [];
  const _syncLog: MockRow[] = [];

  let nextId = 1;

  const selectQueue: Array<MockRow[]> = [];
  let selectIndex = 0;

  function makeChain(rows: MockRow[]) {
    const p = Promise.resolve(rows);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: Record<string, any> = {
      from: () => chain,
      where: () => chain,
      leftJoin: () => chain,
      innerJoin: () => chain,
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
    _orders,
    _products,
    _giftCards,
    _giftCardTransactions,
    _profiles,
    _syncLog,

    _queue: (rows: MockRow[]) => selectQueue.push(rows),
    _resetQueue: () => {
      selectQueue.length = 0;
      selectIndex = 0;
    },
    _seedProduct: (product: MockRow) => _products.push(product),
    _seedGiftCard: (gc: MockRow) => _giftCards.push(gc),
    _seedProfile: (profile: MockRow) => _profiles.push(profile),

    select: vi.fn(() => {
      const rows = selectQueue[selectIndex++] ?? [];
      return makeChain(rows);
    }),

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert: vi.fn((_table: unknown) => ({
      values: vi.fn((values: MockRow) => {
        const id = (values.id as number) ?? nextId++;
        const row = { ...values, id };

        if ("orderNumber" in values) {
          _orders.push(row);
          const p = Promise.resolve([{ id }]);
          return {
            returning: vi.fn().mockResolvedValue([{ id }]),
            then: p.then.bind(p),
            catch: p.catch.bind(p),
            finally: p.finally.bind(p),
          };
        }
        if ("giftCardId" in values && "type" in values) {
          _giftCardTransactions.push(row);
          return { returning: vi.fn().mockResolvedValue([{ id }]) };
        }
        if ("provider" in values && "direction" in values) {
          _syncLog.push(row);
          return { returning: vi.fn().mockResolvedValue([{ id }]) };
        }

        return { returning: vi.fn().mockResolvedValue([{ id }]) };
      }),
    })),

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update: vi.fn((_table: unknown) => ({
      set: vi.fn((values: MockRow) => ({
        where: vi.fn().mockImplementation(() => {
          if ("stockCount" in values) {
            const product = _products[_products.length - 1];
            if (product) Object.assign(product, values);
          } else if ("balanceInCents" in values && !("stockCount" in values)) {
            const gc = _giftCards[_giftCards.length - 1];
            if (gc) Object.assign(gc, values);
          } else if ("squareOrderId" in values) {
            const order = _orders[_orders.length - 1];
            if (order) Object.assign(order, values);
          } else if ("role" in values) {
            const profile = _profiles[_profiles.length - 1];
            if (profile) Object.assign(profile, values);
          }
          return Promise.resolve(undefined);
        }),
      })),
    })),

    delete: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => {
      await fn(db);
    }),
  };

  return db;
}

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

export function setupMocks(
  db: ReturnType<typeof createStatefulDb>,
  options?: { authenticated?: boolean },
) {
  const isAuth = options?.authenticated ?? true;
  vi.doMock("@/db", () => ({ db }));

  vi.doMock("@/db/schema", () => ({
    products: {
      id: "id",
      title: "title",
      priceInCents: "priceInCents",
      pricingType: "pricingType",
      availability: "availability",
      stockCount: "stockCount",
      isPublished: "isPublished",
      slug: "slug",
      description: "description",
      category: "category",
      priceMinInCents: "priceMinInCents",
      priceMaxInCents: "priceMaxInCents",
      imageUrl: "imageUrl",
      serviceId: "serviceId",
      tags: "tags",
      isFeatured: "isFeatured",
      sortOrder: "sortOrder",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    orders: {
      id: "id",
      orderNumber: "orderNumber",
      clientId: "clientId",
      guestEmail: "guestEmail",
      guestName: "guestName",
      guestPhone: "guestPhone",
      productId: "productId",
      status: "status",
      title: "title",
      quantity: "quantity",
      finalInCents: "finalInCents",
      fulfillmentMethod: "fulfillmentMethod",
      shippingAddress: "shippingAddress",
      easypostShipmentId: "easypostShipmentId",
      shippingCostInCents: "shippingCostInCents",
      squareOrderId: "squareOrderId",
      trackingNumber: "trackingNumber",
      trackingUrl: "trackingUrl",
      createdAt: "createdAt",
    },
    giftCards: {
      id: "id",
      code: "code",
      balanceInCents: "balanceInCents",
      originalAmountInCents: "originalAmountInCents",
      status: "status",
      expiresAt: "expiresAt",
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
    profiles: {
      id: "id",
      firstName: "firstName",
      email: "email",
    },
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
    wishlistItems: {
      id: "id",
      clientId: "clientId",
      productId: "productId",
    },
  }));

  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
    isNotNull: vi.fn((...args: unknown[]) => ({ type: "isNotNull", args })),
    ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
    inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
    sql: Object.assign(
      vi.fn((...args: unknown[]) => ({ type: "sql", args })),
      {
        join: vi.fn(() => ({ type: "sql_join" })),
      },
    ),
  }));

  vi.doMock("@/utils/supabase/server", () => ({
    createClient: vi.fn(async () => ({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: isAuth ? { id: "client-1", email: "client@example.com" } : null },
        }),
      },
    })),
  }));

  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: vi.fn().mockReturnValue(false),
    createSquarePaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    createSquareOrderPaymentLink: vi.fn().mockRejectedValue(new Error("not configured")),
    squareClient: {},
    SQUARE_LOCATION_ID: "",
  }));

  vi.doMock("@/lib/easypost", () => ({
    isEasyPostConfigured: vi.fn().mockReturnValue(false),
    fetchShippingRates: vi.fn(),
    getShippingRates: vi.fn(),
  }));

  vi.doMock("@/lib/zoho", () => ({
    createZohoDeal: vi.fn(),
    upsertZohoContact: vi.fn(),
  }));

  vi.doMock("@/lib/zoho-books", () => ({
    createZohoBooksInvoice: vi.fn(),
  }));

  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: vi.fn(),
  }));

  vi.doMock("@/lib/posthog", () => ({
    trackEvent: vi.fn(),
    identifyUser: vi.fn(),
  }));

  vi.doMock("@sentry/nextjs", () => ({
    captureException: vi.fn(),
  }));

  vi.doMock("next/cache", () => ({
    revalidatePath: vi.fn(),
  }));

  vi.doMock("@/emails/OrderConfirmation", () => ({
    OrderConfirmation: vi.fn().mockReturnValue(null),
  }));
}

/* ------------------------------------------------------------------ */
/*  Data factories                                                     */
/* ------------------------------------------------------------------ */

export function makeProduct(overrides?: Record<string, unknown>) {
  return {
    id: 1,
    title: "Test Product",
    priceInCents: 5000,
    pricingType: "fixed_price",
    availability: "in_stock",
    stockCount: 10,
    isPublished: true,
    ...overrides,
  };
}

export function makeGuestInfo(overrides?: Record<string, unknown>) {
  return {
    email: "guest@example.com",
    name: "Jane Guest",
    phone: "555-1234",
    ...overrides,
  };
}
