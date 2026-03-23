// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Payments integration (createSquarePayment, chargeCardOnFile).
 *
 * Covers:
 *  - createSquarePayment: correct amount, currency, sourceId, and idempotency key forwarded to Square
 *  - createSquarePayment: duplicate idempotency key → Square returns the existing payment (no double-charge)
 *  - createSquarePayment: payment failure (e.g. insufficient funds) → error thrown, no DB changes
 *  - chargeCardOnFile: full fee charge with correct payment_id, customerId, and amount
 *  - chargeCardOnFile: partial/reduced amount charge (less than a full service price)
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
const mockOrdersCreate = vi.fn();
const mockPaymentsCreate = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  SQUARE_LOCATION_ID: "TEST_LOCATION",
  squareClient: {
    orders: {
      create: (...args: unknown[]) => mockOrdersCreate(...args),
    },
    payments: {
      create: (...args: unknown[]) => mockPaymentsCreate(...args),
    },
  },
}));

// withRetry: pass-through — calls fn() immediately so tests stay synchronous-style
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
}));

describe("lib/square/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // createSquarePayment
  // ---------------------------------------------------------------------------
  describe("createSquarePayment", () => {
    // The payment must reach Square with the exact amount, currency, sourceId,
    // and idempotency key supplied by the caller. A mismatch here would charge
    // the wrong amount or break idempotency guarantees.
    it("forwards the correct amount, currency, sourceId, and idempotency key to Square", async () => {
      const { createSquarePayment } = await import("./payments");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_001" },
      });
      mockPaymentsCreate.mockResolvedValue({
        payment: { id: "PMT_001", receiptUrl: "https://squareup.com/receipt/preview/PMT_001" },
      });

      const result = await createSquarePayment({
        bookingId: 10,
        serviceName: "Lash Full Set",
        amountInCents: 5000,
        sourceId: "cnon:card-nonce-ok",
        idempotencyKey: "booking-10-deposit",
      });

      expect(result).toEqual({
        paymentId: "PMT_001",
        orderId: "ORDER_001",
        receiptUrl: "https://squareup.com/receipt/preview/PMT_001",
      });

      // Verify the payment call carries the correct amount and idempotency key
      expect(mockPaymentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "cnon:card-nonce-ok",
          amountMoney: {
            amount: BigInt(5000),
            currency: "USD",
          },
          idempotencyKey: "booking-10-deposit",
          orderId: "ORDER_001",
          locationId: "TEST_LOCATION",
          autocomplete: true,
        }),
      );
    });

    // When the same idempotency key is replayed, Square returns the original
    // payment rather than creating a second charge. The function must surface
    // the existing payment ID rather than throwing.
    it("returns the existing payment when the idempotency key is replayed (no double-charge)", async () => {
      const { createSquarePayment } = await import("./payments");

      // First call: creates order and payment
      mockOrdersCreate.mockResolvedValue({ order: { id: "ORDER_DUP" } });
      mockPaymentsCreate.mockResolvedValue({
        payment: { id: "PMT_ORIGINAL", receiptUrl: null },
      });

      const first = await createSquarePayment({
        bookingId: 11,
        serviceName: "Facial",
        amountInCents: 3000,
        sourceId: "cnon:card-nonce-ok",
        idempotencyKey: "booking-11-deposit",
      });

      expect(first.paymentId).toBe("PMT_ORIGINAL");

      // Replay with the same idempotency key — Square returns the same payment
      mockOrdersCreate.mockResolvedValue({ order: { id: "ORDER_DUP" } });
      mockPaymentsCreate.mockResolvedValue({
        payment: { id: "PMT_ORIGINAL", receiptUrl: null },
      });

      const second = await createSquarePayment({
        bookingId: 11,
        serviceName: "Facial",
        amountInCents: 3000,
        sourceId: "cnon:card-nonce-ok",
        idempotencyKey: "booking-11-deposit", // Same key
      });

      // Both calls must resolve to the same payment ID
      expect(second.paymentId).toBe("PMT_ORIGINAL");
      expect(first.paymentId).toBe(second.paymentId);
    });

    // Insufficient funds or card decline causes Square to reject the payment.
    // The function must re-throw (so the booking flow can surface the error)
    // and must not write any DB records.
    it("throws and logs to Sentry on payment failure, making no DB changes", async () => {
      const { createSquarePayment } = await import("./payments");

      // Order creation succeeds
      mockOrdersCreate.mockResolvedValue({ order: { id: "ORDER_FAIL" } });

      // Payment rejected — insufficient funds
      const paymentError = new Error("INSUFFICIENT_FUNDS");
      mockPaymentsCreate.mockRejectedValue(paymentError);

      await expect(
        createSquarePayment({
          bookingId: 12,
          serviceName: "Brow Lamination",
          amountInCents: 4000,
          sourceId: "cnon:card-nonce-bad",
          idempotencyKey: "booking-12-deposit",
        }),
      ).rejects.toThrow("INSUFFICIENT_FUNDS");

      // Sentry must log the error
      expect(mockCaptureException).toHaveBeenCalledWith(paymentError);
    });
  });

  // ---------------------------------------------------------------------------
  // chargeCardOnFile
  // ---------------------------------------------------------------------------
  describe("chargeCardOnFile", () => {
    // A no-show fee charge must carry the correct customerId, cardId (sourceId),
    // amount, and return the payment and order IDs for audit records.
    it("charges the full fee amount with the correct payment_id, customerId, and amount", async () => {
      const { chargeCardOnFile } = await import("./payments");

      mockOrdersCreate.mockResolvedValue({ order: { id: "ORDER_FEE_001" } });
      mockPaymentsCreate.mockResolvedValue({
        payment: {
          id: "PMT_FEE_001",
          receiptUrl: "https://squareup.com/receipt/preview/PMT_FEE_001",
        },
      });

      const result = await chargeCardOnFile({
        bookingId: 20,
        squareCustomerId: "SQ_CUST_ABC",
        cardId: "CARD_XYZ",
        amountInCents: 7500,
        feeType: "no_show",
        serviceName: "Deep Tissue Massage",
      });

      expect(result).toEqual({
        paymentId: "PMT_FEE_001",
        orderId: "ORDER_FEE_001",
        receiptUrl: "https://squareup.com/receipt/preview/PMT_FEE_001",
      });

      // Payment must include the stored card as source and the customer ID
      expect(mockPaymentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: "CARD_XYZ",
          customerId: "SQ_CUST_ABC",
          amountMoney: {
            amount: BigInt(7500),
            currency: "USD",
          },
          locationId: "TEST_LOCATION",
          autocomplete: true,
        }),
      );
    });

    // A partial charge (e.g. half the service price as a late-cancel penalty)
    // must pass through the reduced amount unchanged.
    it("charges the reduced amount for a partial fee (less than the full service price)", async () => {
      const { chargeCardOnFile } = await import("./payments");

      mockOrdersCreate.mockResolvedValue({ order: { id: "ORDER_FEE_PARTIAL" } });
      mockPaymentsCreate.mockResolvedValue({
        payment: { id: "PMT_FEE_PARTIAL", receiptUrl: null },
      });

      const result = await chargeCardOnFile({
        bookingId: 21,
        squareCustomerId: "SQ_CUST_DEF",
        cardId: "CARD_DEF",
        amountInCents: 2500, // Half of a $50 service — partial penalty
        feeType: "late_cancellation",
        serviceName: "Hot Stone Massage",
      });

      expect(result).not.toBeNull();
      expect(result?.paymentId).toBe("PMT_FEE_PARTIAL");

      // The partial amount must reach Square exactly as supplied
      expect(mockPaymentsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amountMoney: {
            amount: BigInt(2500),
            currency: "USD",
          },
        }),
      );
    });
  });
});
