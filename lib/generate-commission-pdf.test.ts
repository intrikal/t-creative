// describe: groups related tests into a labeled block (like a folder for tests)
// it/test: defines a single test case with a description and assertion function
// expect: creates an assertion — checks that a value matches an expected condition
// vi: Vitest's mock utility — creates fake functions, spies on calls, and controls return values
// beforeEach: runs a setup function before every test in the current describe block
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CommissionReportData } from "@/app/dashboard/assistants/actions";

/**
 * Tests for lib/generate-commission-pdf — commission report data assembly and entrypoint.
 *
 * Strategy:
 *  - @react-pdf/renderer is mocked (no PDF rendering engine needed in tests).
 *  - renderToBuffer receives `React.createElement(CommissionDocument, { data, ... })`,
 *    so `capturedElement.props` lets us verify the data is forwarded correctly.
 *
 * Covers:
 *  - Valid date range: renderToBuffer called, staff/period/rate forwarded to component
 *  - Empty entries (no bookings in range): no crash, totals all zero
 *  - Commission percentage rounding: non-integer rates forwarded without modification
 *  - Flat-fee commission type: flatFeeInCents forwarded instead of rate
 *
 * Mocks: @react-pdf/renderer (renderToBuffer, Document, Page, Text, View, StyleSheet).
 */

/* ------------------------------------------------------------------ */
/*  Mock @react-pdf/renderer                                           */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedElement: any;

const mockRenderToBuffer = vi.fn(async (el: unknown) => {
  capturedElement = el;
  return Buffer.from("fake-commission-pdf");
});

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
/*  Test fixtures                                                       */
/* ------------------------------------------------------------------ */

function makeEntry(
  overrides: Partial<CommissionReportData["entries"][number]> = {},
): CommissionReportData["entries"][number] {
  return {
    bookingId: 1,
    date: "2026-04-01",
    client: "Alice Smith",
    service: "Classic Lash",
    serviceCategory: "Lashes",
    priceInCents: 15000,
    commissionRate: 40,
    commissionInCents: 6000,
    tipInCents: 2000,
    tipEarnedInCents: 1000,
    totalEarnedInCents: 7000,
    ...overrides,
  };
}

/** Builds a minimal but complete CommissionReportData for use in tests. */
function makeReportData(overrides: Partial<CommissionReportData> = {}): CommissionReportData {
  return {
    staffId: "staff-uuid-001",
    staffName: "Maria Chen",
    role: "Senior Lash Artist",
    periodLabel: "Apr 1 – Apr 30, 2026",
    commissionType: "percentage",
    rate: 40,
    flatFeeInCents: 0,
    tipSplitPercent: 50,
    entries: [makeEntry()],
    byCategory: {
      Lashes: {
        sessions: 1,
        revenueInCents: 15000,
        commissionInCents: 6000,
        tipsInCents: 2000,
        tipEarnedInCents: 1000,
        totalEarnedInCents: 7000,
      },
    },
    totals: {
      sessions: 1,
      revenueInCents: 15000,
      commissionInCents: 6000,
      tipsInCents: 2000,
      tipEarnedInCents: 1000,
      totalEarnedInCents: 7000,
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                               */
/* ------------------------------------------------------------------ */

describe("lib/generate-commission-pdf", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedElement = undefined;
    mockRenderToBuffer.mockImplementation(async (el: unknown) => {
      capturedElement = el;
      return Buffer.from("fake-commission-pdf");
    });
  });

  describe("generateCommissionPdf", () => {
    // Core happy path — staff info, period label, and rate must reach the component
    it("calls renderToBuffer and forwards staff/period/rate for a valid date range", async () => {
      const { generateCommissionPdf } = await import("./generate-commission-pdf");
      const data = makeReportData();

      const result = await generateCommissionPdf(data, "T Creative Studio", "123 Main St");

      expect(mockRenderToBuffer).toHaveBeenCalledOnce();
      expect(result).toBeInstanceOf(Buffer);

      expect(capturedElement.props.data).toMatchObject({
        staffName: "Maria Chen",
        periodLabel: "Apr 1 – Apr 30, 2026",
        commissionType: "percentage",
        rate: 40,
        totals: expect.objectContaining({ sessions: 1, totalEarnedInCents: 7000 }),
      });
      expect(capturedElement.props.businessName).toBe("T Creative Studio");
      expect(capturedElement.props.businessAddress).toBe("123 Main St");
    });

    // An empty date range produces a report with no rows — must not crash
    it("does not crash when entries is empty (no bookings in range)", async () => {
      const { generateCommissionPdf } = await import("./generate-commission-pdf");

      const emptyData = makeReportData({
        entries: [],
        byCategory: {},
        totals: {
          sessions: 0,
          revenueInCents: 0,
          commissionInCents: 0,
          tipsInCents: 0,
          tipEarnedInCents: 0,
          totalEarnedInCents: 0,
        },
      });

      await expect(
        generateCommissionPdf(emptyData, "T Creative Studio", "123 Main St"),
      ).resolves.toBeInstanceOf(Buffer);

      expect(capturedElement.props.data.entries).toHaveLength(0);
      expect(capturedElement.props.data.totals.totalEarnedInCents).toBe(0);
    });

    // Non-integer commission rates (e.g. 33.333%) must pass through unmodified
    it("forwards non-integer commission rates without rounding them", async () => {
      const { generateCommissionPdf } = await import("./generate-commission-pdf");

      const data = makeReportData({
        rate: 33.333,
        entries: [makeEntry({ commissionRate: 33.333, commissionInCents: 4999 })],
      });

      await generateCommissionPdf(data, "Studio", "Address");

      expect(capturedElement.props.data.rate).toBe(33.333);
      expect(capturedElement.props.data.entries[0].commissionRate).toBe(33.333);
    });

    // Flat-fee commission type uses a per-session fee instead of a percentage
    it("forwards flat_fee commission type and flatFeeInCents to the component", async () => {
      const { generateCommissionPdf } = await import("./generate-commission-pdf");

      const data = makeReportData({
        commissionType: "flat_fee",
        rate: 0,
        flatFeeInCents: 5000,
      });

      await generateCommissionPdf(data, "Studio", "Address");

      expect(capturedElement.props.data.commissionType).toBe("flat_fee");
      expect(capturedElement.props.data.flatFeeInCents).toBe(5000);
    });

    // Multiple service categories must all appear in byCategory
    it("forwards multiple category subtotals to the component", async () => {
      const { generateCommissionPdf } = await import("./generate-commission-pdf");

      const data = makeReportData({
        entries: [
          makeEntry({ service: "Classic Lash", serviceCategory: "Lashes" }),
          makeEntry({ bookingId: 2, service: "Brow Lamination", serviceCategory: "Brows" }),
        ],
        byCategory: {
          Lashes: {
            sessions: 1,
            revenueInCents: 15000,
            commissionInCents: 6000,
            tipsInCents: 2000,
            tipEarnedInCents: 1000,
            totalEarnedInCents: 7000,
          },
          Brows: {
            sessions: 1,
            revenueInCents: 8000,
            commissionInCents: 3200,
            tipsInCents: 500,
            tipEarnedInCents: 250,
            totalEarnedInCents: 3450,
          },
        },
      });

      await generateCommissionPdf(data, "Studio", "Address");

      expect(Object.keys(capturedElement.props.data.byCategory)).toHaveLength(2);
      expect(capturedElement.props.data.byCategory).toHaveProperty("Lashes");
      expect(capturedElement.props.data.byCategory).toHaveProperty("Brows");
    });
  });
});
