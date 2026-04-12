// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ReceiptData } from "./generate-receipt-pdf";

/**
 * Tests for lib/generate-receipt-pdf — data assembly and rendering entrypoint.
 *
 * Strategy:
 *  - @react-pdf/renderer is mocked so renderToBuffer is a fast no-op (no PDF canvas ops).
 *  - renderToBuffer receives `React.createElement(ReceiptDocument, { data })`, so
 *    inspecting `capturedElement.props.data` verifies the data is assembled correctly.
 *  - Smoke tests confirm no crash for optional-field combinations.
 *
 * Covers:
 *  - Valid booking: renderToBuffer called, correct fields forwarded to the document component
 *  - Booking with discount (discountInCents > 0): no crash, discount value present in props
 *  - Booking with gift card payment (method: "square_gift_card"): no crash
 *  - Missing optional fields (staffName, location, depositPaidInCents null): no crash
 *
 * Mocks: @react-pdf/renderer (renderToBuffer, Document, Page, Text, View, StyleSheet).
 */

/* ------------------------------------------------------------------ */
/*  Mock @react-pdf/renderer                                           */
/* ------------------------------------------------------------------ */

// Captures the React element passed to renderToBuffer so tests can inspect props.data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedElement: any;

const mockRenderToBuffer = vi.fn(async (el: unknown) => {
  capturedElement = el;
  return Buffer.from("fake-pdf-bytes");
});

// Mock all react-pdf primitives to lightweight no-ops so the component tree
// can be constructed without a PDF rendering engine.
vi.mock("@react-pdf/renderer", () => ({
  renderToBuffer: mockRenderToBuffer,
  Document: vi.fn(),
  Page: vi.fn(),
  Text: vi.fn(),
  View: vi.fn(),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

/* ------------------------------------------------------------------ */
/*  Test fixture                                                        */
/* ------------------------------------------------------------------ */

/** A fully-populated receipt used as the baseline for most tests. */
const validReceipt: ReceiptData = {
  businessName: "T Creative Studio",
  businessAddress: "123 Main St, Atlanta GA 30301",
  businessPhone: "404-555-0100",
  businessEmail: "hello@tcreativestudio.com",

  clientName: "Jane Doe",

  serviceName: "Classic Lash Set",
  staffName: "Maria",
  date: "2026-04-10",
  time: "10:00 AM",
  durationMinutes: 90,
  location: "Suite 4B",

  serviceAmountInCents: 15000,
  addOns: [{ name: "Lash Bath", priceInCents: 1500 }],
  discountInCents: 0,
  depositPaidInCents: 5000,

  payments: [
    {
      amountInCents: 11500,
      tipInCents: 2000,
      taxAmountInCents: 0,
      method: "square_card",
      squarePaymentId: "sq_pay_abc123",
      paidAt: "2026-04-10T12:00:00Z",
    },
  ],

  bookingId: 42,
  receiptDate: "April 10, 2026",
};

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/generate-receipt-pdf", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedElement = undefined;
    mockRenderToBuffer.mockImplementation(async (el: unknown) => {
      capturedElement = el;
      return Buffer.from("fake-pdf-bytes");
    });
  });

  describe("generateReceiptPdf", () => {
    // Core happy path — confirms the data is forwarded intact to the PDF document component
    it("calls renderToBuffer with correct receipt fields for a valid booking", async () => {
      const { generateReceiptPdf } = await import("./generate-receipt-pdf");

      const result = await generateReceiptPdf(validReceipt);

      expect(mockRenderToBuffer).toHaveBeenCalledOnce();
      expect(result).toBeInstanceOf(Buffer);

      // The element passed to renderToBuffer must carry the full ReceiptData on its props
      expect(capturedElement.props.data).toMatchObject({
        bookingId: 42,
        clientName: "Jane Doe",
        serviceName: "Classic Lash Set",
        staffName: "Maria",
        serviceAmountInCents: 15000,
        receiptDate: "April 10, 2026",
      });
    });

    // A non-zero discount must be present in the props so the component can render the discount row
    it("passes discountInCents > 0 to the document when a discount is applied", async () => {
      const { generateReceiptPdf } = await import("./generate-receipt-pdf");

      const dataWithDiscount: ReceiptData = { ...validReceipt, discountInCents: 2500 };
      await generateReceiptPdf(dataWithDiscount);

      expect(capturedElement.props.data.discountInCents).toBe(2500);
    });

    // Gift card payments are expressed as a payment method — the function must not crash
    it("handles a gift card payment method without throwing", async () => {
      const { generateReceiptPdf } = await import("./generate-receipt-pdf");

      const dataWithGiftCard: ReceiptData = {
        ...validReceipt,
        payments: [
          {
            amountInCents: 16500,
            tipInCents: 0,
            taxAmountInCents: 0,
            method: "square_gift_card",
            squarePaymentId: "sq_gc_xyz789",
            paidAt: "2026-04-10T12:05:00Z",
          },
        ],
      };

      await expect(generateReceiptPdf(dataWithGiftCard)).resolves.toBeInstanceOf(Buffer);
      expect(capturedElement.props.data.payments[0].method).toBe("square_gift_card");
    });

    // All optional fields may be null — the function must tolerate their absence
    it("does not crash when staffName, location, and depositPaidInCents are null", async () => {
      const { generateReceiptPdf } = await import("./generate-receipt-pdf");

      const minimalData: ReceiptData = {
        ...validReceipt,
        staffName: null,
        location: null,
        depositPaidInCents: null,
        addOns: [],
        discountInCents: 0,
      };

      await expect(generateReceiptPdf(minimalData)).resolves.toBeInstanceOf(Buffer);
    });

    // Multiple payments (split payment scenario) must all be forwarded correctly
    it("forwards multiple payment entries to the document", async () => {
      const { generateReceiptPdf } = await import("./generate-receipt-pdf");

      const splitPayment: ReceiptData = {
        ...validReceipt,
        payments: [
          {
            amountInCents: 8000,
            tipInCents: 1000,
            taxAmountInCents: 0,
            method: "square_card",
            squarePaymentId: "sq_pay_1",
            paidAt: null,
          },
          {
            amountInCents: 7500,
            tipInCents: 0,
            taxAmountInCents: 0,
            method: "square_gift_card",
            squarePaymentId: null,
            paidAt: null,
          },
        ],
      };

      await generateReceiptPdf(splitPayment);
      expect(capturedElement.props.data.payments).toHaveLength(2);
    });
  });
});
