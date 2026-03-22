"use client";

/**
 * CommissionReportPage — Admin UI for generating commission reports.
 *
 * Date range picker (default last 2 weeks), staff selector, preview table,
 * and CSV/PDF export buttons.
 */

import { useState, useTransition } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  generateCommissionReport,
  type CommissionReportData,
} from "@/app/dashboard/assistants/actions";

type StaffOption = { id: string; name: string; role: string | null };

function fmt(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function defaultDates(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 14);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export function CommissionReportPage({ staff }: { staff: StaffOption[] }) {
  const defaults = defaultDates();
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [report, setReport] = useState<CommissionReportData | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (!staffId || !fromDate || !toDate) return;
    startTransition(async () => {
      const data = await generateCommissionReport(staffId, fromDate, toDate);
      setReport(data);
    });
  }

  const exportUrl = (format: "csv" | "pdf") =>
    `/api/commission-report?staffId=${staffId}&from=${fromDate}&to=${toDate}&format=${format}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground">Commission Reports</h1>
        <p className="text-sm text-muted mt-0.5">
          Generate exportable commission reports for staff pay periods.
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs font-medium text-muted block mb-1">
            Staff Member
          </label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 min-w-[180px]"
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.role ? ` — ${s.role}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted block mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={isPending || !staffId}
          className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Generate
        </button>
      </div>

      {/* Report preview */}
      {report && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="Sessions" value={String(report.totals.sessions)} />
            <SummaryCard label="Revenue" value={fmt(report.totals.revenueInCents)} />
            <SummaryCard label="Commission" value={fmt(report.totals.commissionInCents)} />
            <SummaryCard
              label="Total Earned"
              value={fmt(report.totals.totalEarnedInCents)}
              highlight
            />
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <a
              href={exportUrl("csv")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
            <a
              href={exportUrl("pdf")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Export PDF
            </a>
          </div>

          {/* Staff info */}
          <div className="text-xs text-muted">
            <span className="font-semibold text-foreground">{report.staffName}</span>
            {report.role && <span> — {report.role}</span>}
            <span className="mx-2">·</span>
            <span>{report.periodLabel}</span>
            <span className="mx-2">·</span>
            <span>
              {report.commissionType === "flat_fee"
                ? `${fmt(report.flatFeeInCents)}/session`
                : `${report.rate}% commission`}
            </span>
            <span className="mx-2">·</span>
            <span>{report.tipSplitPercent}% tip split</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface/60 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted">Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted">Client</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted">Service</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Price</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Rate</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Commission</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Tip</th>
                  <th className="text-right px-3 py-2 font-semibold text-muted">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.entries.map((e) => (
                  <tr
                    key={e.bookingId}
                    className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-muted">{e.date}</td>
                    <td className="px-3 py-2 text-foreground">{e.client}</td>
                    <td className="px-3 py-2 text-foreground">{e.service}</td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {fmt(e.priceInCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {report.commissionType === "flat_fee"
                        ? fmt(report.flatFeeInCents)
                        : `${e.commissionRate}%`}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">
                      {fmt(e.commissionInCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {fmt(e.tipEarnedInCents)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-accent">
                      {fmt(e.totalEarnedInCents)}
                    </td>
                  </tr>
                ))}
                {report.entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted">
                      No completed bookings in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              {report.entries.length > 0 && (
                <tfoot>
                  <tr className="bg-surface/60 border-t-2 border-foreground/20 font-semibold">
                    <td className="px-3 py-2 text-foreground" colSpan={3}>
                      Total ({report.totals.sessions} sessions)
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {fmt(report.totals.revenueInCents)}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right text-foreground">
                      {fmt(report.totals.commissionInCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground">
                      {fmt(report.totals.tipEarnedInCents)}
                    </td>
                    <td className="px-3 py-2 text-right text-accent">
                      {fmt(report.totals.totalEarnedInCents)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Category breakdown */}
          {Object.keys(report.byCategory).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">By Service Type</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(report.byCategory).map(([cat, sub]) => (
                  <div
                    key={cat}
                    className="flex items-center justify-between px-3 py-2 bg-surface/40 border border-border/50 rounded-lg text-xs"
                  >
                    <span className="text-foreground font-medium capitalize">
                      {cat}{" "}
                      <span className="text-muted font-normal">
                        ({sub.sessions} sessions)
                      </span>
                    </span>
                    <span className="font-semibold text-accent">
                      {fmt(sub.totalEarnedInCents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-background border border-border rounded-xl p-3">
      <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
        {label}
      </p>
      <p
        className={cn(
          "text-xl font-semibold mt-1",
          highlight ? "text-accent" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}
