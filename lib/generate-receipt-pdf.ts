/**
 * lib/generate-receipt-pdf.ts — Generate a styled PDF receipt for a completed booking.
 *
 * Uses @react-pdf/renderer to build a PDF document from React components.
 * Called by the /api/receipts/[bookingId] route handler.
 *
 * Receipt includes:
 *   - Studio name, address, phone
 *   - Client name
 *   - Service name + staff
 *   - Date + time
 *   - Itemized charges (service, add-ons, deposit, balance, discount, tip, tax)
 *   - Total paid
 *   - Payment method + Square payment reference IDs
 */
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ReceiptData = {
  /** Studio info */
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  businessEmail: string;

  /** Client info */
  clientName: string;

  /** Booking info */
  serviceName: string;
  staffName: string | null;
  date: string;
  time: string;
  durationMinutes: number;
  location: string | null;

  /** Line items (all in cents) */
  serviceAmountInCents: number;
  addOns: { name: string; priceInCents: number }[];
  discountInCents: number;
  depositPaidInCents: number | null;

  /** Payment totals (from payments table) */
  payments: {
    amountInCents: number;
    tipInCents: number;
    taxAmountInCents: number;
    method: string | null;
    squarePaymentId: string | null;
    paidAt: string | null;
  }[];

  /** Receipt metadata */
  bookingId: number;
  receiptDate: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function methodLabel(method: string | null): string {
  if (!method) return "N/A";
  const map: Record<string, string> = {
    square_card: "Card",
    square_cash: "Cash App",
    square_wallet: "Digital Wallet",
    square_gift_card: "Gift Card",
    square_other: "Other",
    cash: "Cash",
  };
  return map[method] ?? method;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingBottom: 16,
  },
  businessName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#888",
    marginBottom: 2,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 16,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  label: {
    color: "#666",
    fontSize: 10,
  },
  value: {
    color: "#1a1a1a",
    fontSize: 10,
    fontWeight: "bold",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#1a1a1a",
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  totalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1a1a1a",
  },
  footer: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: 12,
    textAlign: "center",
  },
  footerText: {
    fontSize: 8,
    color: "#999",
    textAlign: "center",
  },
  indented: {
    paddingLeft: 12,
  },
});

/* ------------------------------------------------------------------ */
/*  Receipt Document                                                   */
/* ------------------------------------------------------------------ */

function ReceiptDocument({ data }: { data: ReceiptData }) {
  const addOnTotal = data.addOns.reduce((sum, a) => sum + a.priceInCents, 0);
  const subtotal = data.serviceAmountInCents + addOnTotal - data.discountInCents;
  const totalTax = data.payments.reduce((sum, p) => sum + p.taxAmountInCents, 0);
  const totalTip = data.payments.reduce((sum, p) => sum + p.tipInCents, 0);
  const totalPaid = data.payments.reduce(
    (sum, p) => sum + p.amountInCents + p.tipInCents,
    0,
  );

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: s.page },

      /* Header */
      React.createElement(
        View,
        { style: s.header },
        React.createElement(Text, { style: s.businessName }, data.businessName),
        React.createElement(Text, { style: s.subtitle }, data.businessAddress),
        React.createElement(
          Text,
          { style: s.subtitle },
          `${data.businessPhone} · ${data.businessEmail}`,
        ),
      ),

      React.createElement(Text, { style: s.receiptTitle }, "RECEIPT"),

      /* Receipt metadata */
      React.createElement(
        View,
        { style: s.section },
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Receipt #"),
          React.createElement(Text, { style: s.value }, `TC-${data.bookingId}`),
        ),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Date"),
          React.createElement(Text, { style: s.value }, data.receiptDate),
        ),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Client"),
          React.createElement(Text, { style: s.value }, data.clientName),
        ),
      ),

      React.createElement(View, { style: s.divider }),

      /* Appointment details */
      React.createElement(
        View,
        { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, "Appointment"),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Service"),
          React.createElement(Text, { style: s.value }, data.serviceName),
        ),
        data.staffName &&
          React.createElement(
            View,
            { style: s.row },
            React.createElement(Text, { style: s.label }, "Staff"),
            React.createElement(Text, { style: s.value }, data.staffName),
          ),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Date & Time"),
          React.createElement(
            Text,
            { style: s.value },
            `${data.date} at ${data.time}`,
          ),
        ),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Duration"),
          React.createElement(
            Text,
            { style: s.value },
            `${data.durationMinutes} minutes`,
          ),
        ),
        data.location &&
          React.createElement(
            View,
            { style: s.row },
            React.createElement(Text, { style: s.label }, "Location"),
            React.createElement(Text, { style: s.value }, data.location),
          ),
      ),

      React.createElement(View, { style: s.divider }),

      /* Itemized charges */
      React.createElement(
        View,
        { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, "Charges"),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, data.serviceName),
          React.createElement(
            Text,
            { style: s.value },
            fmt(data.serviceAmountInCents),
          ),
        ),
        ...data.addOns.map((a, i) =>
          React.createElement(
            View,
            { key: i, style: { ...s.row, ...s.indented } },
            React.createElement(Text, { style: s.label }, `+ ${a.name}`),
            React.createElement(Text, { style: s.value }, fmt(a.priceInCents)),
          ),
        ),
        data.discountInCents > 0 &&
          React.createElement(
            View,
            { style: s.row },
            React.createElement(Text, { style: s.label }, "Discount"),
            React.createElement(
              Text,
              { style: { ...s.value, color: "#16a34a" } },
              `-${fmt(data.discountInCents)}`,
            ),
          ),
        React.createElement(
          View,
          { style: s.row },
          React.createElement(Text, { style: s.label }, "Subtotal"),
          React.createElement(Text, { style: s.value }, fmt(subtotal)),
        ),
        totalTax > 0 &&
          React.createElement(
            View,
            { style: s.row },
            React.createElement(Text, { style: s.label }, "Tax"),
            React.createElement(Text, { style: s.value }, fmt(totalTax)),
          ),
        totalTip > 0 &&
          React.createElement(
            View,
            { style: s.row },
            React.createElement(Text, { style: s.label }, "Tip"),
            React.createElement(Text, { style: s.value }, fmt(totalTip)),
          ),
        data.depositPaidInCents &&
          data.depositPaidInCents > 0 &&
          React.createElement(
            View,
            { style: s.row },
            React.createElement(Text, { style: s.label }, "Deposit paid"),
            React.createElement(
              Text,
              { style: s.value },
              fmt(data.depositPaidInCents),
            ),
          ),

        /* Total */
        React.createElement(
          View,
          { style: s.totalRow },
          React.createElement(Text, { style: s.totalLabel }, "Total Paid"),
          React.createElement(Text, { style: s.totalValue }, fmt(totalPaid)),
        ),
      ),

      React.createElement(View, { style: s.divider }),

      /* Payment details */
      React.createElement(
        View,
        { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, "Payment"),
        ...data.payments.map((p, i) =>
          React.createElement(
            View,
            { key: i, style: { marginBottom: 8 } },
            React.createElement(
              View,
              { style: s.row },
              React.createElement(Text, { style: s.label }, "Method"),
              React.createElement(
                Text,
                { style: s.value },
                methodLabel(p.method),
              ),
            ),
            React.createElement(
              View,
              { style: s.row },
              React.createElement(Text, { style: s.label }, "Amount"),
              React.createElement(
                Text,
                { style: s.value },
                fmt(p.amountInCents + p.tipInCents),
              ),
            ),
            p.paidAt &&
              React.createElement(
                View,
                { style: s.row },
                React.createElement(Text, { style: s.label }, "Paid"),
                React.createElement(
                  Text,
                  { style: s.value },
                  new Date(p.paidAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }),
                ),
              ),
            p.squarePaymentId &&
              React.createElement(
                View,
                { style: s.row },
                React.createElement(Text, { style: s.label }, "Reference"),
                React.createElement(
                  Text,
                  { style: { ...s.value, fontSize: 8 } },
                  p.squarePaymentId,
                ),
              ),
          ),
        ),
      ),

      /* Footer */
      React.createElement(
        View,
        { style: s.footer },
        React.createElement(
          Text,
          { style: s.footerText },
          `Thank you for choosing ${data.businessName}!`,
        ),
        React.createElement(
          Text,
          { style: s.footerText },
          "This receipt was generated electronically.",
        ),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Generate a PDF receipt as a Node.js Buffer.
 * Returns the raw PDF bytes ready to stream as a response.
 */
export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(React.createElement(ReceiptDocument, { data }) as any);
}
