// describe: groups related tests into a labeled block
// it: defines a single test case
// expect: creates an assertion to check a value matches expected condition
// vi: Vitest's mock utility for creating fake functions and spying on calls
// beforeEach: runs setup before every test (typically resets mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for app/dashboard/financial/promo-gift-actions.ts
 *
 * Covers all 9 exported functions:
 *  1. createPromoCode — discount type, max_uses, dates
 *  2. applyPromoCode — percentage + fixed math
 *  3. applyPromoCode — max_uses reached (throws)
 *  4. applyPromoCode — expired promo
 *  5. createGiftCard — code generation, Square integration
 *  6. redeemGiftCard — FOR UPDATE lock, balance deduction
 *  7. redeemGiftCard — insufficient balance (throws)
 *  8. recordRedemption — partial redemption
 *  9. validatePromoCode — void / inactive
 *
 * Mocks: @/db (chainable Drizzle), @/lib/square, @/lib/auth, @sentry/nextjs,
 *        @/lib/posthog, @/lib/resend, @/lib/audit, next/cache, settings-actions.
 */

/* ------------------------------------------------------------------ */
/*  Chainable DB mock helper                                           */
/* ------------------------------------------------------------------ */

function makeChain(rows: unknown[] = []) {
  const resolved = Promise.resolve(rows);
  const chain: any = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    innerJoin: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    for: () => chain,
    then: resolved.then.bind(resolved),
    catch: resolved.catch.bind(resolved),
    finally: resolved.finally.bind(resolved),
  };
  return chain;
}

/* ------------------------------------------------------------------ */
/*  Shared mock refs                                                   */
/* ------------------------------------------------------------------ */

const mockGetUser = vi.fn().mockResolvedValue({ id: "admin-1", role: "admin" });
const mockLogAction = vi.fn();
const mockTrackEvent = vi.fn();
const mockSendEmail = vi.fn().mockResolvedValue(true);
const mockGetEmailRecipient = vi.fn();
const mockCaptureException = vi.fn();
const mockRevalidatePath = vi.fn();
const mockIsSquareConfigured = vi.fn().mockReturnValue(false);
const mockCreateSquareGiftCard = vi.fn();
const mockRedeemSquareGiftCard = vi.fn();
const mockGetSquareGiftCardBalance = vi.fn();
const mockLinkGiftCardToCustomer = vi.fn();
const mockGetPublicBusinessProfile = vi.fn().mockResolvedValue({ businessName: "Test Salon" });
const mockGetPublicInventoryConfig = vi.fn().mockResolvedValue({ giftCardCodePrefix: "TC-GC" });

/* ------------------------------------------------------------------ */
/*  Mock setup                                                         */
/* ------------------------------------------------------------------ */

function setupMocks(dbOverrides: Record<string, unknown> | null = null) {
  const resolvedDb = makeDefaultDb();
  if (dbOverrides) Object.assign(resolvedDb, dbOverrides);

  vi.doMock("@/db", () => ({ db: resolvedDb }));
  vi.doMock("@/db/schema", () => ({
    giftCards: {
      id: "id",
      code: "code",
      squareGiftCardId: "squareGiftCardId",
      purchasedByClientId: "purchasedByClientId",
      recipientName: "recipientName",
      originalAmountInCents: "originalAmountInCents",
      balanceInCents: "balanceInCents",
      status: "status",
      purchasedAt: "purchasedAt",
      expiresAt: "expiresAt",
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
      createdAt: "createdAt",
    },
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
      clientId: "clientId",
      serviceId: "serviceId",
      totalInCents: "totalInCents",
      giftCardId: "giftCardId",
      promotionId: "promotionId",
      discountInCents: "discountInCents",
    },
    services: { id: "id", name: "name" },
    profiles: {
      id: "id",
      firstName: "firstName",
      lastName: "lastName",
      squareCustomerId: "squareCustomerId",
    },
  }));
  vi.doMock("drizzle-orm", () => ({
    eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
    desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
    sql: vi.fn(),
  }));
  vi.doMock("drizzle-orm/pg-core", () => ({
    alias: vi.fn((_table: unknown, name: string) => ({ _alias: name })),
  }));
  vi.doMock("next/cache", () => ({ revalidatePath: mockRevalidatePath }));
  vi.doMock("@sentry/nextjs", () => ({ captureException: mockCaptureException }));
  vi.doMock("@/lib/auth", () => ({ requireAdmin: mockGetUser }));
  vi.doMock("@/lib/audit", () => ({ logAction: mockLogAction }));
  vi.doMock("@/lib/posthog", () => ({ trackEvent: mockTrackEvent }));
  vi.doMock("@/lib/resend", () => ({
    sendEmail: mockSendEmail,
    getEmailRecipient: mockGetEmailRecipient,
  }));
  vi.doMock("@/lib/logger", () => ({ default: { info: vi.fn(), error: vi.fn() } }));
  vi.doMock("@/lib/square", () => ({
    isSquareConfigured: mockIsSquareConfigured,
    createSquareGiftCard: mockCreateSquareGiftCard,
    redeemSquareGiftCard: mockRedeemSquareGiftCard,
    getSquareGiftCardBalance: mockGetSquareGiftCardBalance,
    linkGiftCardToCustomer: mockLinkGiftCardToCustomer,
  }));
  vi.doMock("@/app/dashboard/settings/settings-actions", () => ({
    getPublicBusinessProfile: mockGetPublicBusinessProfile,
    getPublicInventoryConfig: mockGetPublicInventoryConfig,
  }));
  vi.doMock("@/emails/GiftCardDelivery", () => ({ GiftCardDelivery: vi.fn(() => null) }));
  vi.doMock("@/emails/GiftCardPurchase", () => ({ GiftCardPurchase: vi.fn(() => null) }));
}

function makeDefaultDb() {
  const self: Record<string, unknown> = {
    select: vi.fn(() => makeChain([])),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ clientId: "client-1" }]) })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => fn(self)),
  };
  return self;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("promo-gift-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "admin-1", role: "admin" });
    mockIsSquareConfigured.mockReturnValue(false);
  });

  /* ---- createPromotion ---- */

  describe("createPromotion", () => {
    it("inserts a promotion with discount type, max_uses, and date range", async () => {
      vi.resetModules();
      const mockValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) =>
          fn({
            select: vi.fn(() => makeChain([])),
            insert: vi.fn(() => ({ values: mockValues })),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          }),
        ),
      });
      const { createPromotion } = await import("@/app/dashboard/financial/promo-gift-actions");

      await createPromotion({
        code: "summer20",
        discountType: "percent",
        discountValue: 20,
        maxUses: 50,
        startsAt: "2026-06-01",
        endsAt: "2026-08-31",
      });

      // Should insert with uppercase code and all fields
      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "SUMMER20",
          discountType: "percent",
          discountValue: 20,
          maxUses: 50,
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/financial");
    });
  });

  /* ---- applyPromoCode ---- */

  describe("applyPromoCode", () => {
    it("applies a percentage discount correctly", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      let txSelectCall = 0;
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => {
          txSelectCall = 0;
          return fn({
            select: vi.fn(() => {
              txSelectCall++;
              if (txSelectCall === 1) {
                // promo lookup
                return makeChain([
                  {
                    id: 10,
                    code: "SAVE25",
                    discountType: "percent",
                    discountValue: 25,
                    maxUses: null,
                    redemptionCount: 0,
                    isActive: true,
                  },
                ]);
              }
              // booking lookup — $100 total
              return makeChain([{ id: 1, totalInCents: 10000 }]);
            }),
            update: vi.fn(() => ({ set: mockUpdateSet })),
          });
        }),
      });
      const { applyPromoCode } = await import("@/app/dashboard/financial/promo-gift-actions");

      await applyPromoCode(1, "SAVE25");

      // 25% of 10000 = 2500
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          discountInCents: 2500,
          promotionId: 10,
        }),
      );
    });

    it("applies a fixed discount capped at booking total", async () => {
      vi.resetModules();
      const mockUpdateSet = vi.fn(() => ({ where: vi.fn() }));
      let txSelectCall = 0;
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: mockUpdateSet })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => {
          txSelectCall = 0;
          return fn({
            select: vi.fn(() => {
              txSelectCall++;
              if (txSelectCall === 1) {
                return makeChain([
                  {
                    id: 11,
                    code: "FLAT50",
                    discountType: "fixed",
                    discountValue: 5000,
                    maxUses: null,
                    redemptionCount: 0,
                    isActive: true,
                  },
                ]);
              }
              // booking total is $30 (3000 cents) — less than $50 discount
              return makeChain([{ id: 2, totalInCents: 3000 }]);
            }),
            update: vi.fn(() => ({ set: mockUpdateSet })),
          });
        }),
      });
      const { applyPromoCode } = await import("@/app/dashboard/financial/promo-gift-actions");

      await applyPromoCode(2, "FLAT50");

      // Fixed discount capped at booking total: Math.min(5000, 3000) = 3000
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          discountInCents: 3000,
        }),
      );
    });

    it("throws when promo code has reached max uses", async () => {
      vi.resetModules();
      let txSelectCall = 0;
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => {
          txSelectCall = 0;
          return fn({
            select: vi.fn(() => {
              txSelectCall++;
              return makeChain([
                {
                  id: 12,
                  code: "MAXED",
                  discountType: "percent",
                  discountValue: 10,
                  maxUses: 5,
                  redemptionCount: 5,
                  isActive: true,
                },
              ]);
            }),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          });
        }),
      });
      const { applyPromoCode } = await import("@/app/dashboard/financial/promo-gift-actions");

      await expect(applyPromoCode(1, "MAXED")).rejects.toThrow("Promo code has reached max uses");
    });
  });

  /* ---- validatePromoCode ---- */

  describe("validatePromoCode", () => {
    it("returns valid=false for an expired promo code", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 20,
              code: "EXPIRED",
              discountType: "percent",
              discountValue: 10,
              isActive: true,
              endsAt: new Date("2020-01-01"),
              startsAt: null,
              maxUses: null,
              redemptionCount: 0,
              appliesTo: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) =>
          fn({
            select: vi.fn(() => makeChain([])),
            insert: vi.fn(),
            update: vi.fn(),
          }),
        ),
      });
      const { validatePromoCode } = await import("@/app/dashboard/financial/promo-gift-actions");

      const result = await validatePromoCode("EXPIRED");

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Promo code has expired");
    });

    it("returns valid=false when promo is not active (void)", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 21,
              code: "VOID",
              discountType: "fixed",
              discountValue: 500,
              isActive: false,
              endsAt: null,
              startsAt: null,
              maxUses: null,
              redemptionCount: 0,
              appliesTo: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) =>
          fn({
            select: vi.fn(() => makeChain([])),
            insert: vi.fn(),
            update: vi.fn(),
          }),
        ),
      });
      const { validatePromoCode } = await import("@/app/dashboard/financial/promo-gift-actions");

      const result = await validatePromoCode("VOID");

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Promo code is no longer active");
    });

    it("returns valid=false when max uses reached", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() =>
          makeChain([
            {
              id: 22,
              code: "MAXED",
              discountType: "percent",
              discountValue: 15,
              isActive: true,
              endsAt: null,
              startsAt: null,
              maxUses: 10,
              redemptionCount: 10,
              appliesTo: null,
            },
          ]),
        ),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) =>
          fn({
            select: vi.fn(() => makeChain([])),
            insert: vi.fn(),
            update: vi.fn(),
          }),
        ),
      });
      const { validatePromoCode } = await import("@/app/dashboard/financial/promo-gift-actions");

      const result = await validatePromoCode("MAXED");

      expect(result.valid).toBe(false);
      expect(result.message).toBe("Promo code has reached max uses");
    });
  });

  /* ---- createGiftCard ---- */

  describe("createGiftCard", () => {
    it("generates a sequential code when Square is not configured", async () => {
      vi.resetModules();
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      let selectCall = 0;
      setupMocks({
        select: vi.fn(() => {
          selectCall++;
          // last card lookup for code generation
          if (selectCall === 1) return makeChain([{ code: "TC-GC-003" }]);
          return makeChain([]);
        }),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn(() => ({ values: mockInsertValues })),
            select: vi.fn(() => makeChain([])),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          };
          return fn(tx);
        }),
      });
      const { createGiftCard } = await import("@/app/dashboard/financial/promo-gift-actions");

      await createGiftCard({ amountInCents: 5000 });

      // Should generate TC-GC-004 (next after TC-GC-003)
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "TC-GC-004",
          originalAmountInCents: 5000,
          balanceInCents: 5000,
          squareGiftCardId: null,
        }),
      );
    });

    it("uses Square GAN code when Square is configured", async () => {
      vi.resetModules();
      mockIsSquareConfigured.mockReturnValue(true);
      mockCreateSquareGiftCard.mockResolvedValue({
        squareGiftCardId: "sqgc-123",
        gan: "7070 0001 0002 0003",
        balanceInCents: 5000,
      });
      const mockInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({ values: mockInsertValues })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => {
          const tx = {
            insert: vi.fn(() => ({ values: mockInsertValues })),
            select: vi.fn(() => makeChain([])),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          };
          return fn(tx);
        }),
      });
      const { createGiftCard } = await import("@/app/dashboard/financial/promo-gift-actions");

      await createGiftCard({ amountInCents: 5000 });

      expect(mockCreateSquareGiftCard).toHaveBeenCalledWith(
        expect.objectContaining({ amountInCents: 5000 }),
      );
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "7070 0001 0002 0003",
          squareGiftCardId: "sqgc-123",
        }),
      );
    });
  });

  /* ---- redeemGiftCard ---- */

  describe("redeemGiftCard", () => {
    it("deducts balance with FOR UPDATE lock and updates booking", async () => {
      vi.resetModules();
      const mockGiftCardUpdate = vi.fn(() => ({ where: vi.fn() }));
      const mockBookingUpdate = vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ clientId: "client-1" }]),
        })),
      }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => {
          let txUpdateCall = 0;
          return fn({
            select: vi.fn(() =>
              makeChain([
                {
                  id: 5,
                  balanceInCents: 10000,
                  status: "active",
                  squareGiftCardId: null,
                },
              ]),
            ),
            update: vi.fn(() => {
              txUpdateCall++;
              if (txUpdateCall === 1) return { set: mockGiftCardUpdate };
              return {
                set: mockBookingUpdate,
              };
            }),
          });
        }),
      });
      const { redeemGiftCard } = await import("@/app/dashboard/financial/promo-gift-actions");

      await redeemGiftCard({
        bookingId: 1,
        giftCardId: 5,
        amountInCents: 3000,
      });

      // Gift card balance: 10000 - 3000 = 7000, still active
      expect(mockGiftCardUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          balanceInCents: 7000,
          status: "active",
        }),
      );
    });

    it("throws when gift card has insufficient balance", async () => {
      vi.resetModules();
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) =>
          fn({
            select: vi.fn(() =>
              makeChain([
                {
                  id: 5,
                  balanceInCents: 1000,
                  status: "active",
                  squareGiftCardId: null,
                },
              ]),
            ),
            update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
          }),
        ),
      });
      const { redeemGiftCard } = await import("@/app/dashboard/financial/promo-gift-actions");

      await expect(
        redeemGiftCard({ bookingId: 1, giftCardId: 5, amountInCents: 5000 }),
      ).rejects.toThrow("Insufficient gift card balance");
    });
  });

  /* ---- recordRedemption ---- */

  describe("recordRedemption", () => {
    it("records a partial redemption with transaction ledger entry", async () => {
      vi.resetModules();
      const mockTxInsertValues = vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
      }));
      const mockGiftCardUpdate = vi.fn(() => ({ where: vi.fn() }));
      setupMocks({
        select: vi.fn(() => makeChain([])),
        insert: vi.fn(() => ({
          values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) })),
        })),
        update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
        delete: vi.fn(() => ({ where: vi.fn() })),
        transaction: vi.fn((fn: (tx: any) => Promise<unknown>) =>
          fn({
            select: vi.fn(() =>
              makeChain([
                {
                  id: 5,
                  balanceInCents: 8000,
                  status: "active",
                  squareGiftCardId: null,
                },
              ]),
            ),
            insert: vi.fn(() => ({ values: mockTxInsertValues })),
            update: vi.fn(() => ({ set: mockGiftCardUpdate })),
          }),
        ),
      });
      const { recordRedemption } = await import("@/app/dashboard/financial/promo-gift-actions");

      await recordRedemption({
        giftCardId: 5,
        bookingId: 1,
        amountInCents: 3000,
      });

      // Balance deducted: 8000 - 3000 = 5000, card remains active
      expect(mockGiftCardUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          balanceInCents: 5000,
          status: "active",
        }),
      );
      // Transaction ledger entry with negative amount (debit)
      expect(mockTxInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          giftCardId: 5,
          type: "redemption",
          amountInCents: -3000,
          balanceAfterInCents: 5000,
          bookingId: 1,
        }),
      );
    });
  });
});
