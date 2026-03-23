// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for app/shop/gift-cards/actions.ts — purchaseGiftCard.
 *
 * Covers:
 *  - Purchase: card created with correct balance, sequential code generated
 *  - Custom amount: accepted when within $25–$500 range
 *  - Amount below minimum: rejected with validation error
 *  - Delivery email: sent to recipient when recipientName is provided
 *  - Square Gift Card: created via createSquareGiftCard when API is configured
 *
 * Mocks: @/db, @/db/schema, drizzle-orm, @/lib/auth, @/lib/square,
 *        @/lib/resend, @/lib/posthog, @/app/dashboard/settings/settings-actions,
 *        @/emails/GiftCardDelivery, @/emails/GiftCardPurchase, next/cache
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

// makeChain builds a thenable object that mimics Drizzle's chainable
// query API (from/where/orderBy/limit) and resolves to `rows`.
function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn().mockResolvedValue({ id: "client-1" });
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockTrackEvent = vi.fn();
const mockIsSquareConfigured = vi.fn().mockReturnValue(false);
const mockCreateSquareGiftCard = vi.fn();
const mockLinkGiftCardToCustomer = vi.fn().mockResolvedValue(undefined);
const mockSquarePaymentLinksCreate = vi.fn();
const mockGetPublicInventoryConfig = vi.fn().mockResolvedValue({
  giftCardCodePrefix: "TC-GC",
});
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({
  businessName: "T Creative Studio",
});

/* ------------------------------------------------------------------ */
/*  Per-test mock setup helper                                         */
/* ------------------------------------------------------------------ */

// setupMocks registers vi.doMock() for all external deps after vi.resetModules().
// Pass a custom `db` object to control what the DB returns per test.
function setupMocks(db: Record<string, unknown> | null = null) {
  const defaultDb = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => {
      const fakeTx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          })),
        })),
      };
      return fn(fakeTx);
    }),
  };

  vi.doMock("@/db", () => ({ db: db ?? defaultDb }));
  vi.doMock("@/db/schema", () => ({
    giftCards: {
      id: "id",
      code: "code",
      squareGiftCardId: "squareGiftCardId",
      purchasedByClientId: "purchasedByClientId",
      recipientName: "recipientName",
      originalAmountInCents: "originalAmountInCents",
      balanceInCents: "balanceInCents",
    },
    giftCardTransactions: {
      id: "id",
      giftCardId: "giftCardId",
      type: "type",
      amountInCents: "amountInCents",
      balanceAfterInCents: "balanceAfterInCents",
      performedBy: "performedBy",
    },
    profiles: {
      id: "id",
      email: "email",
      firstName: "firstName",
      squareCustomerId: "squareCustomerId",
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
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...a: unknown[]) => ({ type: "eq", a })),
    desc: vi.fn((...a: unknown[]) => ({ type: "desc", a })),
    and: vi.fn((...a: unknown[]) => ({ type: "and", a })),
    sql: Object.assign(
      vi.fn((...a: unknown[]) => ({ type: "sql", a })),
      {
        join: vi.fn(() => ({ type: "sql_join" })),
      },
    ),
  }));
  vi.doMock("@/lib/auth", () => ({ getUser: mockGetUser }));
  vi.doMock("@/lib/resend", () => ({ sendEmail: mockSendEmail }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
    squareClient: {
      checkout: { paymentLinks: { create: mockSquarePaymentLinksCreate } },
    },
    SQUARE_LOCATION_ID: "loc-1",
    createSquareGiftCard: mockCreateSquareGiftCard,
    linkGiftCardToCustomer: mockLinkGiftCardToCustomer,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicInventoryConfig: mockGetPublicInventoryConfig,
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
  }));
  vi.doMock("@/emails/GiftCardPurchase", () => ({
    GiftCardPurchase: vi.fn(() => null),
  }));
  vi.doMock("@/emails/GiftCardDelivery", () => ({
    GiftCardDelivery: vi.fn(() => null),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("purchaseGiftCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "client-1" });
    mockSendEmail.mockResolvedValue(true);
    mockIsSquareConfigured.mockReturnValue(false);
    mockGetPublicInventoryConfig.mockResolvedValue({ giftCardCodePrefix: "TC-GC" });
    mockGetPublicBusinessProfile.mockResolvedValue({ businessName: "T Creative Studio" });
  });

  /* ---- Purchase: card created with balance, code generated ---- */

  describe("purchase: card created with balance and code", () => {
    // The gift card must be persisted with the exact purchase amount as both
    // originalAmountInCents and balanceInCents — balance starts equal to purchase.
    it("inserts a gift card with the correct balance", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 42 }]),
      }));
      const fakeTx = {
        insert: vi.fn(() => ({ values: mockInsertValues })),
      };
      const db = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      // Queue: no existing cards → code "TC-GC-001"
      // Queue: buyer profile for email
      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "alice@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 5000 });

      expect(result.success).toBe(true);
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          originalAmountInCents: 5000,
          balanceInCents: 5000,
        }),
      );
    });

    // Sequential code generation: no existing cards → first code is TC-GC-001.
    it("generates code TC-GC-001 when no cards exist", async () => {
      vi.resetModules();
      let capturedCode: string | undefined;
      const mockInsertValues = vi.fn((vals: any) => {
        if (vals.code) capturedCode = vals.code;
        return { returning: vi.fn().mockResolvedValue([{ id: 1 }]) };
      });
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "alice@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 5000 });

      expect(result.success).toBe(true);
      expect(result.giftCardCode).toBe("TC-GC-001");
    });

    // Sequential code generation: last card is TC-GC-007 → next is TC-GC-008.
    it("generates the next sequential code based on the last card in the DB", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 8 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([{ code: "TC-GC-007" }]))
        .mockReturnValueOnce(makeChain([{ email: "alice@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 5000 });

      expect(result.success).toBe(true);
      expect(result.giftCardCode).toBe("TC-GC-008");
    });
  });

  /* ---- Custom amount: within min/max range ---- */

  describe("custom amount: within $25–$500 range", () => {
    // Any integer amount within the valid range must succeed.
    it("accepts a custom amount of $75 (7500 cents)", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "alice@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 7500 });

      expect(result.success).toBe(true);
      expect(result.giftCardCode).toBeDefined();
    });

    // $25 (2500 cents) is the exact minimum — must succeed.
    it("accepts the minimum amount of $25 (2500 cents)", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "alice@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 2500 });

      expect(result.success).toBe(true);
    });

    // $500 (50000 cents) is the exact maximum — must succeed.
    it("accepts the maximum amount of $500 (50000 cents)", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "alice@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 50000 });

      expect(result.success).toBe(true);
    });
  });

  /* ---- Amount below minimum: rejected ---- */

  describe("amount below minimum: rejected", () => {
    // $24.99 (2499 cents) is one cent below the $25 minimum — must fail.
    it("rejects an amount below $25", async () => {
      vi.resetModules();
      setupMocks();
      const { purchaseGiftCard } = await import("./actions");

      const result = await purchaseGiftCard({ amountInCents: 2499 });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/\$25/);
    });

    // $0 — clearly invalid, must fail cleanly.
    it("rejects zero cents", async () => {
      vi.resetModules();
      setupMocks();
      const { purchaseGiftCard } = await import("./actions");

      const result = await purchaseGiftCard({ amountInCents: 0 });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    // Amounts above $500 must also be rejected (upper bound validation).
    it("rejects an amount above $500", async () => {
      vi.resetModules();
      setupMocks();
      const { purchaseGiftCard } = await import("./actions");

      const result = await purchaseGiftCard({ amountInCents: 50001 });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/\$500/);
    });

    // Validation must fail before any DB writes — no gift card should be inserted.
    it("does not insert a gift card when amount is invalid", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      await purchaseGiftCard({ amountInCents: 1000 });

      expect(mockInsertValues).not.toHaveBeenCalled();
    });
  });

  /* ---- Delivery email sent to recipient ---- */

  describe("delivery email: sent to recipient when recipientName is provided", () => {
    // When a recipientName is given, a GiftCardDelivery email must be sent
    // in addition to the buyer's GiftCardPurchase confirmation.
    it("sends a delivery email when recipientName is provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      await purchaseGiftCard({ amountInCents: 5000, recipientName: "Bob" });

      const deliveryCall = mockSendEmail.mock.calls.find(
        (call) => call[0]?.entityType === "gift_card_delivery",
      );
      expect(deliveryCall).toBeDefined();
    });

    // The delivery email must be addressed to the buyer's email address
    // (the sender who purchased the gift card on behalf of the recipient).
    it("sends the delivery email to the buyer's email address", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      await purchaseGiftCard({ amountInCents: 5000, recipientName: "Bob" });

      const deliveryCall = mockSendEmail.mock.calls.find(
        (call) => call[0]?.entityType === "gift_card_delivery",
      );
      expect(deliveryCall![0].to).toBe("buyer@example.com");
    });

    // Without a recipientName, no delivery email should be sent — only the
    // purchase confirmation goes to the buyer.
    it("does not send a delivery email when no recipientName is provided", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      await purchaseGiftCard({ amountInCents: 5000 });

      const deliveryCall = mockSendEmail.mock.calls.find(
        (call) => call[0]?.entityType === "gift_card_delivery",
      );
      expect(deliveryCall).toBeUndefined();
    });
  });

  /* ---- Square Gift Card created if API configured ---- */

  describe("Square Gift Card: created when API is configured", () => {
    // When Square is configured, createSquareGiftCard must be called with
    // the correct amountInCents so the card balance is funded in Square.
    it("calls createSquareGiftCard with the correct amount when Square is configured", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(true);
      mockCreateSquareGiftCard.mockResolvedValue({
        gan: "7783320001234567",
        squareGiftCardId: "SQ_GC_001",
      });

      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      // select: profile for Square customer link, then buyer email
      db.select
        .mockReturnValueOnce(makeChain([{ squareCustomerId: null }]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      await purchaseGiftCard({ amountInCents: 10000 });

      expect(mockCreateSquareGiftCard).toHaveBeenCalledWith(
        expect.objectContaining({ amountInCents: 10000 }),
      );
    });

    // The GAN (gift account number) returned by Square becomes the local code.
    it("uses the Square GAN as the gift card code", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(true);
      mockCreateSquareGiftCard.mockResolvedValue({
        gan: "7783320001234567",
        squareGiftCardId: "SQ_GC_001",
      });

      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([{ squareCustomerId: null }]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 10000 });

      expect(result.giftCardCode).toBe("7783320001234567");
    });

    // When Square API returns null (failure), the action must fall back to
    // a sequential TC-GC-XXX code rather than failing the purchase.
    it("falls back to sequential code when Square gift card creation fails", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(true);
      mockCreateSquareGiftCard.mockResolvedValue(null);

      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      // select: no last card (fallback), then buyer email
      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      const result = await purchaseGiftCard({ amountInCents: 5000 });

      expect(result.success).toBe(true);
      expect(result.giftCardCode).toBe("TC-GC-001");
    });

    // When Square is not configured, createSquareGiftCard must never be called.
    it("does not call createSquareGiftCard when Square is not configured", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(false);

      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const fakeTx = { insert: vi.fn(() => ({ values: mockInsertValues })) };
      const db = {
        select: vi.fn(),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(fakeTx)),
      };
      setupMocks(db);
      const { purchaseGiftCard } = await import("./actions");

      db.select
        .mockReturnValueOnce(makeChain([]))
        .mockReturnValueOnce(makeChain([{ email: "buyer@example.com", firstName: "Alice" }]));

      await purchaseGiftCard({ amountInCents: 5000 });

      expect(mockCreateSquareGiftCard).not.toHaveBeenCalled();
    });
  });
});
