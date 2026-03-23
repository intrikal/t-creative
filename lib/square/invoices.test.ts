// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the Square Invoices integration (createNoShowInvoice, publishInvoice).
 *
 * Covers:
 *  - createNoShowInvoice: correct amount_money, customer_id, due_date, idempotency_key
 *  - publishInvoice: invoice transitions from DRAFT to UNPAID, publish called with invoice_id and version
 *  - Invoice already published: no-op, no error
 *  - API failure on create: returns error object, Sentry captureException called
 *  - API failure on publish: invoice stays in DRAFT, flagged for manual review
 *  - Zero-dollar no-show fee (settings configured to $0): skips API call, returns null
 *  - Customer not in Square: error with 'client has no Square customer ID'
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
const mockInvoicesCreate = vi.fn();
const mockInvoicesPublish = vi.fn();

vi.mock("./client", () => ({
  isSquareConfigured: mockIsSquareConfigured,
  SQUARE_LOCATION_ID: "TEST_LOCATION",
  squareClient: {
    orders: {
      create: (...args: unknown[]) => mockOrdersCreate(...args),
    },
    invoices: {
      create: (...args: unknown[]) => mockInvoicesCreate(...args),
      publish: (...args: unknown[]) => mockInvoicesPublish(...args),
    },
  },
}));

// withRetry: pass-through — calls fn() immediately so tests stay synchronous-style
vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn().mockImplementation((fn: () => unknown) => fn()),
}));

describe("lib/square/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSquareConfigured.mockReturnValue(true);
  });

  // ---------------------------------------------------------------------------
  // createNoShowInvoice — correct field forwarding
  // ---------------------------------------------------------------------------
  describe("createNoShowInvoice", () => {
    // Square requires amount_money (amount + currency), customer_id, due_date,
    // and an idempotency_key to safely create a draft invoice without duplicates.
    it("creates a draft invoice with the correct amount_money, customer_id, due_date, and idempotency_key", async () => {
      const { createSquareInvoice } = await import("./invoices");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_NS_001" },
      });
      mockInvoicesCreate.mockResolvedValue({
        invoice: { id: "INV_NS_001", version: 0 },
      });
      mockInvoicesPublish.mockResolvedValue({
        invoice: { id: "INV_NS_001", status: "UNPAID" },
      });

      const result = await createSquareInvoice({
        bookingId: 100,
        squareCustomerId: "SQ_CUST_NS_001",
        clientEmail: "client@example.com",
        amountInCents: 5000,
        title: "No-Show Fee",
        description: "No-show fee for appointment on 2026-03-20",
        dueDate: "2026-03-27",
      });

      expect(result).toEqual({ invoiceId: "INV_NS_001", orderId: "ORDER_NS_001" });

      // Order must carry the correct amount and customer
      expect(mockOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "fee-invoice-order-100",
          order: expect.objectContaining({
            customerId: "SQ_CUST_NS_001",
            lineItems: expect.arrayContaining([
              expect.objectContaining({
                basePriceMoney: expect.objectContaining({
                  amount: BigInt(5000),
                  currency: "USD",
                }),
              }),
            ]),
          }),
        }),
      );

      // Invoice draft must be tied to the correct customer and due date
      expect(mockInvoicesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "fee-invoice-100",
          invoice: expect.objectContaining({
            orderId: "ORDER_NS_001",
            primaryRecipient: { customerId: "SQ_CUST_NS_001" },
            paymentRequests: expect.arrayContaining([
              expect.objectContaining({ dueDate: "2026-03-27" }),
            ]),
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // publishInvoice — DRAFT → UNPAID transition
  // ---------------------------------------------------------------------------
  describe("publishInvoice", () => {
    // After creation the invoice is in DRAFT. Publishing sends the payment
    // link to the client and transitions the status to UNPAID. Square requires
    // both the invoice_id and the current version for optimistic concurrency.
    it("transitions the invoice from DRAFT to UNPAID and calls publish with invoice_id and version", async () => {
      const { createSquareInvoice } = await import("./invoices");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_PUBLISH_001" },
      });
      // Invoice created at version 0 (DRAFT)
      mockInvoicesCreate.mockResolvedValue({
        invoice: { id: "INV_PUBLISH_001", version: 0 },
      });
      // Publish returns the invoice in UNPAID state
      mockInvoicesPublish.mockResolvedValue({
        invoice: { id: "INV_PUBLISH_001", status: "UNPAID" },
      });

      await createSquareInvoice({
        bookingId: 200,
        squareCustomerId: "SQ_CUST_PUB_001",
        clientEmail: "publish@example.com",
        amountInCents: 3000,
        title: "No-Show Fee",
        description: "No-show for 2026-03-21",
        dueDate: "2026-03-28",
      });

      // Publish must be called with the exact invoice_id and version returned from create
      expect(mockInvoicesPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          invoiceId: "INV_PUBLISH_001",
          version: 0,
          idempotencyKey: "fee-invoice-publish-200",
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Invoice already published — no-op
  // ---------------------------------------------------------------------------
  describe("invoice already published", () => {
    // If publish is called on an invoice that is already UNPAID/PAID (e.g. due
    // to a retry), the function must treat it as a success and not throw.
    // Square returns the existing invoice unchanged when the idempotency key matches.
    it("is a no-op and does not throw when the invoice is already published", async () => {
      const { createSquareInvoice } = await import("./invoices");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_NOOP_001" },
      });
      mockInvoicesCreate.mockResolvedValue({
        invoice: { id: "INV_NOOP_001", version: 1 },
      });
      // Square returns the existing published invoice on idempotency key replay
      mockInvoicesPublish.mockResolvedValue({
        invoice: { id: "INV_NOOP_001", status: "UNPAID" },
      });

      // Must not throw — treat the replay as success
      const result = await createSquareInvoice({
        bookingId: 300,
        squareCustomerId: "SQ_CUST_NOOP_001",
        clientEmail: "noop@example.com",
        amountInCents: 2500,
        title: "No-Show Fee",
        description: "Already published invoice replay",
        dueDate: "2026-03-29",
      });

      expect(result).toEqual({ invoiceId: "INV_NOOP_001", orderId: "ORDER_NOOP_001" });
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // API failure on create — error returned, Sentry alerted
  // ---------------------------------------------------------------------------
  describe("API failure on create", () => {
    // A Square API error during invoice creation (e.g. invalid order, network
    // timeout) must not propagate to the caller. The function returns null and
    // logs to Sentry so oncall is notified without crashing the booking flow.
    it("returns null and calls Sentry captureException when the invoices.create API fails", async () => {
      const { createSquareInvoice } = await import("./invoices");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_FAIL_CREATE" },
      });

      const createError = new Error("Square invoice create failed: INVALID_REQUEST_ERROR");
      mockInvoicesCreate.mockRejectedValue(createError);

      const result = await createSquareInvoice({
        bookingId: 400,
        squareCustomerId: "SQ_CUST_FAIL_001",
        clientEmail: "fail-create@example.com",
        amountInCents: 4000,
        title: "No-Show Fee",
        description: "Create failure test",
        dueDate: "2026-03-30",
      });

      // Must degrade gracefully — null, not a thrown exception
      expect(result).toBeNull();

      // Sentry must capture the underlying error for oncall visibility
      expect(mockCaptureException).toHaveBeenCalledWith(createError);
    });
  });

  // ---------------------------------------------------------------------------
  // API failure on publish — invoice stays in DRAFT, flagged for manual review
  // ---------------------------------------------------------------------------
  describe("API failure on publish", () => {
    // If publish fails after the draft invoice is created, the invoice remains
    // in DRAFT (Square did not send the payment link). The function must return
    // null and alert Sentry so the team can manually publish or re-trigger.
    it("returns null and calls Sentry captureException when invoices.publish fails, leaving invoice in DRAFT", async () => {
      const { createSquareInvoice } = await import("./invoices");

      mockOrdersCreate.mockResolvedValue({
        order: { id: "ORDER_FAIL_PUBLISH" },
      });
      // Draft created successfully
      mockInvoicesCreate.mockResolvedValue({
        invoice: { id: "INV_FAIL_PUBLISH", version: 0 },
      });
      // Publish fails — invoice stays DRAFT, payment link never sent
      const publishError = new Error("Square publish failed: SERVICE_UNAVAILABLE");
      mockInvoicesPublish.mockRejectedValue(publishError);

      const result = await createSquareInvoice({
        bookingId: 500,
        squareCustomerId: "SQ_CUST_FAIL_PUB_001",
        clientEmail: "fail-publish@example.com",
        amountInCents: 6000,
        title: "No-Show Fee",
        description: "Publish failure test",
        dueDate: "2026-03-31",
      });

      // Invoice was never published — must return null (flagged for manual review)
      expect(result).toBeNull();

      // Sentry must capture the publish error so the team can follow up
      expect(mockCaptureException).toHaveBeenCalledWith(publishError);
    });
  });

  // ---------------------------------------------------------------------------
  // Zero-dollar no-show fee — skip API call entirely
  // ---------------------------------------------------------------------------
  describe("zero-dollar no-show fee", () => {
    // When settings configure a $0 no-show fee (e.g. studio policy waives fees),
    // there is nothing to invoice. The function must short-circuit before hitting
    // the Square API to avoid creating a $0 invoice that Square would reject.
    it("skips the Square API entirely and returns null when amountInCents is 0", async () => {
      const { createSquareInvoice } = await import("./invoices");

      const result = await createSquareInvoice({
        bookingId: 600,
        squareCustomerId: "SQ_CUST_ZERO_001",
        clientEmail: "zero@example.com",
        amountInCents: 0,
        title: "No-Show Fee",
        description: "Zero-dollar fee — should be skipped",
        dueDate: "2026-04-01",
      });

      // No invoice created — amount is zero
      expect(result).toBeNull();

      // Square must never be called — no order or invoice creation
      expect(mockOrdersCreate).not.toHaveBeenCalled();
      expect(mockInvoicesCreate).not.toHaveBeenCalled();
      expect(mockInvoicesPublish).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Customer not in Square — error with descriptive message
  // ---------------------------------------------------------------------------
  describe("customer not in Square", () => {
    // Invoices require a Square customer ID to attach a recipient. If the
    // client has no Square customer record (e.g. they pre-date the Square
    // integration), the function must fail with a clear error message so the
    // caller can surface it and prompt manual resolution.
    it("returns null with a 'client has no Square customer ID' error when squareCustomerId is missing", async () => {
      const { createSquareInvoice } = await import("./invoices");

      const result = await createSquareInvoice({
        bookingId: 700,
        squareCustomerId: "", // No Square customer linked
        clientEmail: "no-square@example.com",
        amountInCents: 5000,
        title: "No-Show Fee",
        description: "Customer without Square ID",
        dueDate: "2026-04-02",
      });

      // Must not throw — return null and log to Sentry
      expect(result).toBeNull();

      // Sentry must be called with an error describing the missing customer ID
      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("client has no Square customer ID"),
        }),
      );

      // Square API must not be called without a valid customer ID
      expect(mockOrdersCreate).not.toHaveBeenCalled();
    });
  });
});
