// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Checkout integration (createSquarePaymentLink,
 * createSquareOrderPaymentLink).
 *
 * Covers:
 *  - createSquarePaymentLink (deposit): correct amount, currency, referenceId, and URL returned
 *  - createSquarePaymentLink (balance): line item label uses plain service name (no "Deposit —" prefix)
 *  - createSquareOrderPaymentLink: multiple line items each with correct name, quantity, and unit price
 *
 * Note: link expiry and pre-filled customer fields are not part of this module's
 * API surface — neither createSquarePaymentLink nor createSquareOrderPaymentLink
 * accept those params. The Square SDK infers expiry from account settings and
 * customer pre-fill would require a checkout options extension not present here.
 *
 * Mocks: ./client (squareClient, isSquareConfigured, SQUARE_LOCATION_ID),
 *        @sentry/nextjs (captureException).
 *
 * Note: checkout functions do not use withRetry, so @/lib/retry is not mocked here.
 */

// --- Sentry mock ---
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// --- Square API mocks ---
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);
const mockPaymentLinksCreate = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  SQUARE_LOCATION_ID: "TEST_LOCATION",
  squareClient: {
    checkout: {
      paymentLinks: {
        create: (...args: unknown[]) => mockPaymentLinksCreate(...args),
      },
    },
  },
}));

describe("lib/square/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // createSquarePaymentLink
  // ---------------------------------------------------------------------------
  describe("createSquarePaymentLink", () => {
    // The payment link must carry the exact amount and currency, the bookingId
    // as referenceId (for webhook matching), and return the URL from Square.
    it("creates a deposit payment link with the correct amount, currency, and redirect URL", async () => {
      const { createSquarePaymentLink } = await import("./checkout");

      mockPaymentLinksCreate.mockResolvedValue({
        paymentLink: {
          url: "https://squareup.com/pay/link/DEPOSIT_001",
          orderId: "ORDER_DEPOSIT_001",
        },
      });

      const result = await createSquarePaymentLink({
        bookingId: 10,
        serviceName: "Lash Full Set",
        amountInCents: 5000,
        type: "deposit",
      });

      expect(result).toEqual({
        url: "https://squareup.com/pay/link/DEPOSIT_001",
        orderId: "ORDER_DEPOSIT_001",
      });

      expect(mockPaymentLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({
            locationId: "TEST_LOCATION",
            referenceId: "10",
            lineItems: [
              expect.objectContaining({
                name: "Deposit — Lash Full Set",
                quantity: "1",
                basePriceMoney: {
                  amount: BigInt(5000),
                  currency: "USD",
                },
              }),
            ],
            metadata: expect.objectContaining({
              bookingId: "10",
              paymentType: "deposit",
            }),
          }),
        }),
      );
    });

    // When type is "balance" the line item label must be the plain service name
    // — no "Deposit —" prefix — so the client sees the correct description.
    it("uses the plain service name as the line item label for a balance payment link", async () => {
      const { createSquarePaymentLink } = await import("./checkout");

      mockPaymentLinksCreate.mockResolvedValue({
        paymentLink: {
          url: "https://squareup.com/pay/link/BALANCE_001",
          orderId: "ORDER_BALANCE_001",
        },
      });

      await createSquarePaymentLink({
        bookingId: 11,
        serviceName: "Deep Tissue Massage",
        amountInCents: 9000,
        type: "balance",
      });

      const callArg = mockPaymentLinksCreate.mock.calls[0][0];
      expect(callArg.order.lineItems[0].name).toBe("Deep Tissue Massage");
      expect(callArg.order.lineItems[0].name).not.toContain("Deposit");
    });

    // Square API failures must be re-thrown (not silently swallowed) and logged
    // to Sentry so the booking flow can surface an error to the client.
    it("throws and logs to Sentry when Square payment link creation fails", async () => {
      const { createSquarePaymentLink } = await import("./checkout");

      const apiError = new Error("Square 503");
      mockPaymentLinksCreate.mockRejectedValue(apiError);

      await expect(
        createSquarePaymentLink({
          bookingId: 12,
          serviceName: "Facial",
          amountInCents: 7000,
          type: "deposit",
        }),
      ).rejects.toThrow("Square 503");

      expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    });
  });

  // ---------------------------------------------------------------------------
  // createSquareOrderPaymentLink
  // ---------------------------------------------------------------------------
  describe("createSquareOrderPaymentLink", () => {
    // A product order may have multiple line items. Each must appear with the
    // correct name, quantity string, and unit price (amountInCents / quantity).
    it("creates a payment link with multiple line items at the correct unit prices", async () => {
      const { createSquareOrderPaymentLink } = await import("./checkout");

      mockPaymentLinksCreate.mockResolvedValue({
        paymentLink: {
          url: "https://squareup.com/pay/link/SHOP_001",
          orderId: "ORDER_SHOP_001",
        },
      });

      const result = await createSquareOrderPaymentLink({
        orderId: 50,
        orderNumber: "ORD-0050",
        lineItems: [
          { name: "Lash Serum", quantity: 2, amountInCents: 6000 }, // $60 for 2 → $30/unit
          { name: "Brow Gel", quantity: 1, amountInCents: 2500 }, // $25 for 1 → $25/unit
        ],
      });

      expect(result).toEqual({
        url: "https://squareup.com/pay/link/SHOP_001",
        orderId: "ORDER_SHOP_001",
      });

      expect(mockPaymentLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({
            locationId: "TEST_LOCATION",
            referenceId: "50",
            lineItems: [
              expect.objectContaining({
                name: "Lash Serum",
                quantity: "2",
                basePriceMoney: {
                  amount: BigInt(3000), // 6000 / 2 = 3000 per unit
                  currency: "USD",
                },
              }),
              expect.objectContaining({
                name: "Brow Gel",
                quantity: "1",
                basePriceMoney: {
                  amount: BigInt(2500),
                  currency: "USD",
                },
              }),
            ],
            metadata: expect.objectContaining({
              orderNumber: "ORD-0050",
              source: "shop",
            }),
          }),
        }),
      );
    });
  });
});
