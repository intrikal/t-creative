/**
 * lib/generate-commission-pdf.ts — Generate a styled PDF commission report.
 *
 * Uses @react-pdf/renderer. Studio letterhead, staff name, pay period,
 * per-booking table, category subtotals, grand total.
 */
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CommissionReportData } from "@/app/dashboard/assistants/actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#333" },
  header: { marginBottom: 16, borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 12 },
  businessName: { fontSize: 16, fontWeight: "bold", color: "#1a1a1a", marginBottom: 2 },
  subtitle: { fontSize: 8, color: "#888", marginBottom: 1 },
  title: { fontSize: 13, fontWeight: "bold", color: "#1a1a1a", marginBottom: 4, marginTop: 8 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  metaBlock: {},
  metaLabel: { fontSize: 8, color: "#888" },
  metaValue: { fontSize: 10, fontWeight: "bold", color: "#1a1a1a" },
  // Table
  tableHeader: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#1a1a1a",
    paddingBottom: 3, marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e5e5",
    paddingVertical: 3,
  },
  colDate: { width: "12%" },
  colClient: { width: "14%" },
  colService: { width: "18%" },
  colPrice: { width: "11%", textAlign: "right" },
  colRate: { width: "9%", textAlign: "right" },
  colComm: { width: "12%", textAlign: "right" },
  colTip: { width: "12%", textAlign: "right" },
  colTotal: { width: "12%", textAlign: "right" },
  thText: { fontSize: 7, fontWeight: "bold", color: "#666", textTransform: "uppercase" as const },
  tdText: { fontSize: 8, color: "#333" },
  tdBold: { fontSize: 8, fontWeight: "bold", color: "#1a1a1a" },
  // Summary
  summarySection: { marginTop: 16 },
  summaryTitle: { fontSize: 10, fontWeight: "bold", color: "#1a1a1a", marginBottom: 6 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  summaryLabel: { fontSize: 9, color: "#666" },
  summaryValue: { fontSize: 9, fontWeight: "bold", color: "#1a1a1a" },
  grandTotal: {
    flexDirection: "row", justifyContent: "space-between",
    borderTopWidth: 2, borderTopColor: "#1a1a1a", paddingTop: 6, marginTop: 4,
  },
  grandLabel: { fontSize: 11, fontWeight: "bold", color: "#1a1a1a" },
  grandValue: { fontSize: 11, fontWeight: "bold", color: "#1a1a1a" },
  footer: { marginTop: 24, textAlign: "center" },
  footerText: { fontSize: 7, color: "#999", textAlign: "center" },
});

/* ------------------------------------------------------------------ */
/*  Document                                                           */
/* ------------------------------------------------------------------ */

function CommissionDocument({
  data,
  businessName,
  businessAddress,
}: {
  data: CommissionReportData;
  businessName: string;
  businessAddress: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = (style: any, text: string) => React.createElement(Text, { style }, text);
  const V = View;
  const T = Text;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: s.page },

      /* Header */
      React.createElement(
        V,
        { style: s.header },
        h(s.businessName, businessName),
        h(s.subtitle, businessAddress),
      ),

      h(s.title, "COMMISSION REPORT"),

      /* Meta */
      React.createElement(
        V,
        { style: s.meta },
        React.createElement(
          V,
          { style: s.metaBlock },
          h(s.metaLabel, "Staff Member"),
          h(s.metaValue, data.staffName + (data.role ? ` — ${data.role}` : "")),
        ),
        React.createElement(
          V,
          { style: s.metaBlock },
          h(s.metaLabel, "Pay Period"),
          h(s.metaValue, data.periodLabel),
        ),
        React.createElement(
          V,
          { style: s.metaBlock },
          h(s.metaLabel, "Commission"),
          h(
            s.metaValue,
            data.commissionType === "flat_fee"
              ? `${fmt(data.flatFeeInCents)}/session`
              : `${data.rate}%`,
          ),
        ),
        React.createElement(
          V,
          { style: s.metaBlock },
          h(s.metaLabel, "Tip Split"),
          h(s.metaValue, `${data.tipSplitPercent}%`),
        ),
      ),

      /* Table header */
      React.createElement(
        V,
        { style: s.tableHeader },
        React.createElement(T, { style: { ...s.thText, ...s.colDate } }, "Date"),
        React.createElement(T, { style: { ...s.thText, ...s.colClient } }, "Client"),
        React.createElement(T, { style: { ...s.thText, ...s.colService } }, "Service"),
        React.createElement(T, { style: { ...s.thText, ...s.colPrice } }, "Price"),
        React.createElement(T, { style: { ...s.thText, ...s.colRate } }, "Rate"),
        React.createElement(T, { style: { ...s.thText, ...s.colComm } }, "Commission"),
        React.createElement(T, { style: { ...s.thText, ...s.colTip } }, "Tip"),
        React.createElement(T, { style: { ...s.thText, ...s.colTotal } }, "Total"),
      ),

      /* Table rows */
      ...data.entries.map((e, i) =>
        React.createElement(
          V,
          { key: i, style: s.tableRow },
          React.createElement(T, { style: { ...s.tdText, ...s.colDate } }, e.date),
          React.createElement(T, { style: { ...s.tdText, ...s.colClient } }, e.client),
          React.createElement(T, { style: { ...s.tdText, ...s.colService } }, e.service),
          React.createElement(T, { style: { ...s.tdText, ...s.colPrice } }, fmt(e.priceInCents)),
          React.createElement(
            T,
            { style: { ...s.tdText, ...s.colRate } },
            data.commissionType === "flat_fee" ? fmt(data.flatFeeInCents) : `${e.commissionRate}%`,
          ),
          React.createElement(T, { style: { ...s.tdBold, ...s.colComm } }, fmt(e.commissionInCents)),
          React.createElement(T, { style: { ...s.tdText, ...s.colTip } }, fmt(e.tipEarnedInCents)),
          React.createElement(T, { style: { ...s.tdBold, ...s.colTotal } }, fmt(e.totalEarnedInCents)),
        ),
      ),

      /* Category subtotals */
      React.createElement(
        V,
        { style: s.summarySection },
        h(s.summaryTitle, "By Service Type"),
        ...Object.entries(data.byCategory).map(([cat, sub], i) =>
          React.createElement(
            V,
            { key: i, style: s.summaryRow },
            h(s.summaryLabel, `${cat} (${sub.sessions} sessions)`),
            h(s.summaryValue, `${fmt(sub.commissionInCents)} + ${fmt(sub.tipEarnedInCents)} tips = ${fmt(sub.totalEarnedInCents)}`),
          ),
        ),
      ),

      /* Grand total */
      React.createElement(
        V,
        { style: s.grandTotal },
        h(s.grandLabel, `Grand Total (${data.totals.sessions} sessions)`),
        h(s.grandValue, fmt(data.totals.totalEarnedInCents)),
      ),

      /* Footer */
      React.createElement(
        V,
        { style: s.footer },
        h(s.footerText, `Generated on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`),
      ),
    ),
  );
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function generateCommissionPdf(
  data: CommissionReportData,
  businessName: string,
  businessAddress: string,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(
    React.createElement(CommissionDocument, { data, businessName, businessAddress }) as any,
  );
}
