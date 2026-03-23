// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Orders integration (createSquareOrder).
 *
 * Covers:
 *  - createSquareOrder: correct line item name, amount, currency, referenceId, and locationId
 *  - createSquareOrder: different booking amount — total forwarded correctly (no hardcoding)
 *  - createSquareOrder: optional clientName metadata included when provided, omitted when absent
 *
 * Note: createSquareOrder accepts a single line item. Multi-service and discount
 * fields are not part of this module's API surface — those are assembled by the
 * caller before invoking this function.
 *
 * Mocks: ./client (squareClient, isSquareConfigured, SQUARE_LOCATION_ID),
 *        @sentry/nextjs (captureException).
 *
 * Note: createSquareOrder does not use withRetry, so @/lib/retry is not mocked here.
 */

// --- Sentry mock ---
const mockCaptureException = vi.fn();
vi.mock("@sentry/nextjs", () => ({
  captureException: mockCaptureException,
}));

// --- Square API mocks ---
const mockIsSquareConfigured = vi.fn().mockReturnValue(true);
const mockOrdersCreate = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  SQUARE_LOCATION_ID: "TEST_LOCATION",
  squareClient: {
    orders: {
      create: (...args: unknown[]) => mockOrdersCreate(...args),
    },
  },
}));

describe("lib/square/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // createSquareOrder
  // ---------------------------------------------------------------------------
  describe("createSquareOrder", () => {
    // The order must carry the service name as the line item name, the exact
    // amount in cents as a BigInt, USD currency, and the bookingId as referenceId
    // so webhook payments can be matched back to the booking.
    it("creates an order with correct line item name, amount, currency, and referenceId", async () => {
      const { createSquareOrder } = await import("./orders");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_001" },
      });

      const result = await createSquareOrder({
        bookingId: 10,
        serviceName: "Lash Full Set",
        amountInCents: 12000,
        clientName: "Jane Doe",
      });

      expect(result).toBe("ORDER_001");

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({
            locationId: "TEST_LOCATION",
            referenceId: "10",
            lineItems: [
              expect.objectContaining({
                name: "Lash Full Set",
                quantity: "1",
                basePriceMoney: {
                  amount: BigInt(12000),
                  currency: "USD",
                },
              }),
            ],
            metadata: expect.objectContaining({
              bookingId: "10",
              clientName: "Jane Doe",
            }),
          }),
        }),
      );
    });

    // Verify a different booking and amount flow through unchanged — confirms
    // no hardcoded values and that the total is whatever the caller supplies.
    it("forwards a different booking amount correctly (no hardcoded total)", async () => {
      const { createSquareOrder } = await import("./orders");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_002" },
      });

      const result = await createSquareOrder({
        bookingId: 99,
        serviceName: "Deep Tissue Massage",
        amountInCents: 8500,
      });

      expect(result).toBe("ORDER_002");

      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          order: expect.objectContaining({
            referenceId: "99",
            lineItems: [
              expect.objectContaining({
                name: "Deep Tissue Massage",
                basePriceMoney: {
                  amount: BigInt(8500),
                  currency: "USD",
                },
              }),
            ],
          }),
        }),
      );
    });

    // clientName is optional — when omitted it must not appear in metadata so
    // Square doesn't receive a stray undefined/null key.
    it("omits clientName from metadata when not provided", async () => {
      const { createSquareOrder } = await import("./orders");

      mockOrdersCreate.mockResolvedValue({ order: { id: "ORDER_003" } });

      await createSquareOrder({
        bookingId: 5,
        serviceName: "Brow Lamination",
        amountInCents: 6000,
        // clientName intentionally omitted
      });

      const callArg = mockOrdersCreate.mock.calls[0][0];
      expect(callArg.order.metadata).not.toHaveProperty("clientName");
      expect(callArg.order.metadata).toEqual({ bookingId: "5" });
    });

    // Square API failure must be re-thrown (createSquareOrder is not a silent
    // degrader — it throws so the booking flow can surface the error) and
    // logged to Sentry.
    it("throws and logs to Sentry when Square order creation fails", async () => {
      const { createSquareOrder } = await import("./orders");

      const apiError = new Error("Square 503");
      mockOrdersCreate.mockRejectedValue(apiError);

      await expect(
        createSquareOrder({
          bookingId: 7,
          serviceName: "Facial",
          amountInCents: 9000,
        }),
      ).rejects.toThrow("Square 503");

      expect(mockCaptureException).toHaveBeenCalledWith(apiError);
    });
  });
});
