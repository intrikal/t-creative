/**
 * PayrollTab — Payroll summary, per-assistant breakdown, CSV export,
 * and 1099 year-to-date summary for independent contractors.
 *
 * Displays the current pay-period totals (tips owed, total owed),
 * a detailed table with per-assistant session counts and earned amounts,
 * and a YTD section for tax-year 1099 reporting. Each row has a "View"
 * link that opens the PayStubModal for a full line-item pay stub.
 */
"use client";

import { useState } from "react";
import { DollarSign, Download, CheckSquare, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayrollRow, PayrollSummary } from "../actions";
import { PayStubModal } from "./PayStubModal";

function fmt(cents: number) {
  return "$" + Math.round(cents / 100).toLocaleString();
}

function commissionLabel(r: PayrollRow): string {
  if (r.commissionType === "flat_fee") {
    return `$${Math.round(r.flatFeeInCents / 100)}/session`;
  }
  return `${r.rate}%`;
}

/** Build a CSV string from the payroll rows and trigger a browser download.
 *  map: transform each row into a comma-separated line of values. */
function exportCsv(rows: PayrollRow[], summary: PayrollSummary) {
  const header = [
    "Name",
    "Role",
    "Commission",
    "Sessions",
    "Revenue",
    "Tips",
    "Service Owed",
    "Tip Owed",
    "Total Owed",
    "Status",
  ];
  const lines = rows.map((r) => [
    r.name,
    r.role ?? "Staff",
    commissionLabel(r),
    String(r.sessions),
    (r.revenueInCents / 100).toFixed(2),
    (r.tipsInCents / 100).toFixed(2),
    (r.serviceOwedInCents / 100).toFixed(2),
    (r.tipOwedInCents / 100).toFixed(2),
    (r.owedInCents / 100).toFixed(2),
    r.owedInCents > 0 ? "Pending" : "N/A",
  ]);
  // map + join: assemble the CSV — each sub-array becomes a comma-joined
  // line, then lines are newline-joined into a single downloadable string
  const csv = [header, ...lines].map((row) => row.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-${summary.periodLabel.replace(/\s/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PayrollTab({ rows, summary }: { rows: PayrollRow[]; summary: PayrollSummary }) {
  const totalOwed = summary.totalOwedInCents;
  // reduce: sum tips across all assistants for the period header
  const totalTips = rows.reduce((s, r) => s + r.tipsInCents, 0);
  const totalTipOwed = rows.reduce((s, r) => s + r.tipOwedInCents, 0);

  // filter: only show the 1099 section for assistants who have
  // actually earned revenue this calendar year
  const ytdRows = rows.filter((r) => r.ytdRevenueInCents > 0);

  /** payStubFor: when set, opens the PayStubModal for this assistant */
  const [payStubFor, setPayStubFor] = useState<{ id: string; name: string } | null>(null);
  /** paidIds: set of assistant IDs marked paid in this session (optimistic) */
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  /** confirmRunPayroll: shows the run payroll confirmation banner */
  const [confirmRunPayroll, setConfirmRunPayroll] = useState(false);
  /** payrollRan: true after confirming run payroll, shows success state */
  const [payrollRan, setPayrollRan] = useState(false);

  function handleRunPayroll() {
    // Mark all rows with owed > 0 as paid optimistically
    const pendingIds = new Set(rows.filter((r) => r.owedInCents > 0).map((r) => r.id));
    setPaidIds(pendingIds);
    setConfirmRunPayroll(false);
    setPayrollRan(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Payroll & 1099</h2>
          <p className="text-xs text-muted mt-0.5">
            Track payments and generate 1099 summaries for independent contractors.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportCsv(rows, summary)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border text-xs font-medium rounded-lg hover:bg-foreground/5 transition-colors text-foreground"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {payrollRan ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4e6b51]/10 text-[#4e6b51] text-xs font-medium rounded-lg border border-[#4e6b51]/20">
              <Check className="w-3.5 h-3.5" /> Payroll Complete
            </span>
          ) : (
            <button
              onClick={() => setConfirmRunPayroll(true)}
              disabled={totalOwed === 0}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <DollarSign className="w-3.5 h-3.5" />
              Run Payroll
            </button>
          )}
        </div>
      </div>

      {/* Run Payroll confirmation banner */}
      {confirmRunPayroll && (
        <div className="flex items-center justify-between gap-4 bg-accent/8 border border-accent/20 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Mark all as paid?</p>
            <p className="text-xs text-muted mt-0.5">
              This will mark {rows.filter((r) => r.owedInCents > 0).length} team member
              {rows.filter((r) => r.owedInCents > 0).length !== 1 ? "s" : ""} as paid for{" "}
              {summary.periodLabel}.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setConfirmRunPayroll(false)}
              className="px-3 py-1.5 bg-surface border border-border text-xs font-medium rounded-lg hover:bg-foreground/5 transition-colors text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleRunPayroll}
              className="px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Pay period summary */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted">Current Pay Period</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">{summary.periodLabel}</p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          {totalTips > 0 && (
            <div className="text-center">
              <p className="text-xs text-muted">Total Tips</p>
              <p className="text-lg font-semibold text-foreground">{fmt(totalTips)}</p>
              <p className="text-[10px] text-muted">{fmt(totalTipOwed)} to staff</p>
            </div>
          )}
          <div className="text-center">
            <p className="text-xs text-muted">Total Owed</p>
            <p className="text-lg font-semibold text-foreground">{fmt(totalOwed)}</p>
          </div>
        </div>
      </div>

      {/* Payroll table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-surface/40">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                Staff
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Sessions
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Revenue
              </th>
              {totalTips > 0 && (
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5 hidden md:table-cell">
                  Tips
                </th>
              )}
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Owed
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Status
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                Pay Stub
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
              >
                <td className="px-4 py-3 align-middle">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-[10px] text-muted">
                    {r.role ?? "Staff"} · {commissionLabel(r)}
                  </p>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className="text-sm text-foreground tabular-nums">{r.sessions}</span>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span className="text-sm text-foreground tabular-nums">
                    {fmt(r.revenueInCents)}
                  </span>
                </td>
                {totalTips > 0 && (
                  <td className="px-3 py-3 text-right align-middle hidden md:table-cell">
                    <div>
                      <p className="text-sm text-foreground tabular-nums">{fmt(r.tipsInCents)}</p>
                      {r.tipOwedInCents > 0 && (
                        <p className="text-[10px] text-muted tabular-nums">
                          {fmt(r.tipOwedInCents)} earned
                        </p>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-3 py-3 text-right align-middle">
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        r.owedInCents === 0 ? "text-muted" : "text-foreground",
                      )}
                    >
                      {fmt(r.owedInCents)}
                    </p>
                    {r.tipOwedInCents > 0 && (
                      <p className="text-[10px] text-muted tabular-nums">
                        incl. {fmt(r.tipOwedInCents)} tips
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  {r.owedInCents === 0 || paidIds.has(r.id) ? (
                    <span className="flex items-center justify-center gap-1 text-[10px] text-[#4e6b51]">
                      <CheckSquare className="w-3 h-3" /> Paid
                    </span>
                  ) : (
                    <button
                      onClick={() => setPaidIds((s) => new Set(s).add(r.id))}
                      className="text-[10px] text-[#a07040] bg-[#a07040]/10 px-1.5 py-0.5 rounded-full hover:bg-[#a07040]/20 transition-colors border border-[#a07040]/20"
                    >
                      Pending
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  <button
                    onClick={() => setPayStubFor({ id: r.id, name: r.name })}
                    className="flex items-center gap-1 mx-auto text-[10px] text-accent hover:text-accent/80 font-medium transition-colors"
                  >
                    <FileText className="w-3 h-3" />
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 1099 section */}
      {ytdRows.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">
              1099 Summary — Tax Year {new Date().getFullYear()}
            </p>
          </div>
          <div className="space-y-2">
            {ytdRows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-[10px] text-muted">{r.role ?? "1099 Contractor"}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    {fmt(r.ytdRevenueInCents)}
                  </p>
                  <p className="text-[10px] text-muted">earned YTD</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {payStubFor && (
        <PayStubModal
          assistantId={payStubFor.id}
          assistantName={payStubFor.name}
          onClose={() => setPayStubFor(null)}
        />
      )}
    </div>
  );
}
