// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Gift Cards integration (createSquareGiftCard,
 * getSquareGiftCardBalance, redeemSquareGiftCard).
 *
 * Covers:
 *  - createSquareGiftCard: correct amount forwarded to ACTIVATE activity; GAN and ID returned
 *  - getSquareGiftCardBalance: returns current balance in cents from Square
 *  - redeemSquareGiftCard: REDEEM activity called with correct amount; balance after returned
 *  - redeemSquareGiftCard: insufficient balance → Square throws, function returns null
 *  - createSquareGiftCard: ACTIVATE activity funds the card (load funds path)
 *
 * Mocks: ./client (squareClient, isSquareConfigured, SQUARE_LOCATION_ID),
 *        @/lib/retry (withRetry pass-through), @sentry/nextjs (captureException).
 */

// --- Sentry mock ---
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// --- Square API mocks ---
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);
const mockGiftCardsCreate = vi.fn();
const mockGiftCardsGet = vi.fn();
const mockGiftCardsActivitiesCreate = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  SQUARE_LOCATION_ID: "TEST_LOCATION",
  squareClient: {
    giftCards: {
      create: (...args: unknown[]) => mockGiftCardsCreate(...args),
      get: (...args: unknown[]) => mockGiftCardsGet(...args),
      activities: {
        create: (...args: unknown[]) => mockGiftCardsActivitiesCreate(...args),
      },
    },
  },
}));

// withRetry: pass-through — calls fn() immediately so tests stay synchronous-style
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
}));

describe("lib/square/gift-cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // createSquareGiftCard
  // ---------------------------------------------------------------------------
  describe("createSquareGiftCard", () => {
    // createSquareGiftCard is a two-step flow: create a DIGITAL card, then fire
    // an ACTIVATE activity to load it with funds. The returned GAN is the code
    // clients use at POS. The amount must reach the ACTIVATE call unchanged.
    it("creates a gift card and returns the GAN and ID with the correct activation amount", async () => {
      const { createSquareGiftCard } = await import("./gift-cards");

      mockGiftCardsCreate.mockResolvedValue({
        giftCard: { id: "GC_001", gan: "7783320012345678" },
      });
      mockGiftCardsActivitiesCreate.mockResolvedValue({
        giftCardActivity: { id: "ACT_001" },
      });

      const result = await createSquareGiftCard({
        amountInCents: 5000,
        referenceId: "order-ref-001",
      });

      expect(result).toEqual({
        squareGiftCardId: "GC_001",
        gan: "7783320012345678",
        balanceInCents: 5000,
      });

      // Step 1: gift card creation with DIGITAL type
      expect(mockGiftCardsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "gc-create-order-ref-001",
          locationId: "TEST_LOCATION",
          giftCard: { type: "DIGITAL" },
        }),
      );

      // Step 2: ACTIVATE activity funds the card with the exact amount
      expect(mockGiftCardsActivitiesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "gc-activate-order-ref-001",
          giftCardActivity: expect.objectContaining({
            giftCardId: "GC_001",
            type: "ACTIVATE",
            locationId: "TEST_LOCATION",
            activateActivityDetails: expect.objectContaining({
              amountMoney: {
                amount: BigInt(5000),
                currency: "USD",
              },
            }),
          }),
        }),
      );
    });

    // The ACTIVATE step is the "load funds" operation — it funds the card on
    // creation. Verify a different amount (e.g. $100) flows through correctly.
    it("loads the correct amount onto the card during activation (load funds path)", async () => {
      const { createSquareGiftCard } = await import("./gift-cards");

      mockGiftCardsCreate.mockResolvedValue({
        giftCard: { id: "GC_LOAD", gan: "7783320098765432" },
      });
      mockGiftCardsActivitiesCreate.mockResolvedValue({
        giftCardActivity: { id: "ACT_LOAD" },
      });

      const result = await createSquareGiftCard({
        amountInCents: 10000, // $100 gift card
        referenceId: "order-ref-100",
      });

      expect(result?.balanceInCents).toBe(10000);

      expect(mockGiftCardsActivitiesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          giftCardActivity: expect.objectContaining({
            activateActivityDetails: expect.objectContaining({
              amountMoney: {
                amount: BigInt(10000),
                currency: "USD",
              },
            }),
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getSquareGiftCardBalance
  // ---------------------------------------------------------------------------
  describe("getSquareGiftCardBalance", () => {
    // Square is the source of truth for gift card balances. The function must
    // return the live balance in cents (converted from BigInt) and the card state.
    it("returns the current balance in cents and card state from Square", async () => {
      const { getSquareGiftCardBalance } = await import("./gift-cards");

      mockGiftCardsGet.mockResolvedValue({
        giftCard: {
          id: "GC_BAL_001",
          state: "ACTIVE",
          balanceMoney: { amount: BigInt(3500), currency: "USD" },
        },
      });

      const result = await getSquareGiftCardBalance("GC_BAL_001");

      expect(result).toEqual({ balanceInCents: 3500, state: "ACTIVE" });
      expect(mockGiftCardsGet).toHaveBeenCalledWith({ id: "GC_BAL_001" });
    });
  });

  // ---------------------------------------------------------------------------
  // redeemSquareGiftCard
  // ---------------------------------------------------------------------------
  describe("redeemSquareGiftCard", () => {
    // A REDEEM activity deducts the amount from the card. Square returns the
    // balance after the deduction which must be surfaced to the caller.
    it("redeems the correct amount and returns the balance after deduction", async () => {
      const { redeemSquareGiftCard } = await import("./gift-cards");

      // Card starts at $50, redeem $20 → $30 remaining
      mockGiftCardsActivitiesCreate.mockResolvedValue({
        giftCardActivity: {
          giftCardBalanceMoney: { amount: BigInt(3000), currency: "USD" },
        },
      });

      const result = await redeemSquareGiftCard({
        squareGiftCardId: "GC_REDEEM_001",
        amountInCents: 2000,
        referenceId: "booking-redeem-001",
      });

      expect(result).toEqual({ balanceAfterInCents: 3000 });

      expect(mockGiftCardsActivitiesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "gc-redeem-booking-redeem-001",
          giftCardActivity: expect.objectContaining({
            giftCardId: "GC_REDEEM_001",
            type: "REDEEM",
            locationId: "TEST_LOCATION",
            redeemActivityDetails: expect.objectContaining({
              amountMoney: {
                amount: BigInt(2000),
                currency: "USD",
              },
            }),
          }),
        }),
      );
    });

    // When the redemption amount exceeds the card balance, Square rejects the
    // request. The function must catch the error, log it to Sentry, and return
    // null so the booking flow can surface an appropriate message to the client.
    it("returns null and logs to Sentry when Square rejects redemption due to insufficient balance", async () => {
      const { redeemSquareGiftCard } = await import("./gift-cards");

      const balanceError = new Error("INSUFFICIENT_FUNDS");
      mockGiftCardsActivitiesCreate.mockRejectedValue(balanceError);

      const result = await redeemSquareGiftCard({
        squareGiftCardId: "GC_LOW_BAL",
        amountInCents: 9999,
        referenceId: "booking-over-limit",
      });

      // Must not throw — return null so the caller can handle it
      expect(result).toBeNull();
      expect(mockCaptureException).toHaveBeenCalledWith(balanceError);
    });
  });
});
