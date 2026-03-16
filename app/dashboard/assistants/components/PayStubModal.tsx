"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { X, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PayStubData } from "../actions";
import { generatePayStub } from "../actions";

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function PayStubModal({
  assistantId,
  assistantName,
  onClose,
}: {
  assistantId: string;
  assistantName: string;
  onClose: () => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [stub, setStub] = useState<PayStubData | null>(null);
  const [isPending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const data = await generatePayStub(assistantId, month, year);
      setStub(data);
    });
  }

  function exportCsv() {
    if (!stub) return;
    const header = [
      "Date",
      "Service",
      "Client",
      "Gross",
      "Tip",
      "Service Earned",
      "Tip Earned",
      "Total Earned",
    ];
    const lines = stub.entries.map((e) => [
      e.date,
      e.service,
      e.client,
      (e.grossInCents / 100).toFixed(2),
      (e.tipInCents / 100).toFixed(2),
      (e.serviceEarnedInCents / 100).toFixed(2),
      (e.tipEarnedInCents / 100).toFixed(2),
      (e.totalEarnedInCents / 100).toFixed(2),
    ]);
    const csv = [header, ...lines].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pay-stub-${stub.assistantName.replace(/\s+/g, "-").toLowerCase()}-${stub.periodLabel.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length) focusable[0].focus();

    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [stub, isPending]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paystub-title"
        className="relative bg-background border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-accent" />
            <div>
              <h2 id="paystub-title" className="text-sm font-semibold text-foreground">
                Pay Stub
              </h2>
              <p className="text-xs text-muted">{assistantName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:bg-foreground/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Period picker */}
        <div className="px-5 py-4 border-b border-border/60 shrink-0">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <p className="text-[10px] text-muted mb-1.5">Month</p>
              <select
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                  setStub(null);
                }}
                className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <p className="text-[10px] text-muted mb-1.5">Year</p>
              <select
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setStub(null);
                }}
                className="w-full text-sm bg-surface border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={load}
              disabled={isPending}
              className="px-4 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {isPending ? "Loading…" : "Generate"}
            </button>
          </div>
        </div>

        {/* Stub content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!stub ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted">
              Select a period and click Generate
            </div>
          ) : stub.entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted">
              No completed sessions in {MONTHS[month - 1]} {year}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Summary header */}
              <div className="bg-surface/60 rounded-xl p-4 border border-border/60">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{stub.assistantName}</p>
                    <p className="text-xs text-muted">{stub.role ?? "Staff"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted">Pay period</p>
                    <p className="text-sm font-medium text-foreground">{stub.periodLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/60">
                  <div className="text-center">
                    <p className="text-[10px] text-muted">Commission</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {stub.commissionType === "flat_fee"
                        ? `$${Math.round(stub.flatFeeInCents / 100)}/session`
                        : `${stub.rate}%`}
                    </p>
                  </div>
                  <div className="text-center border-x border-border/60">
                    <p className="text-[10px] text-muted">Tip split</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {stub.tipSplitPercent}% to assistant
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-muted">Sessions</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {stub.totals.sessions}
                    </p>
                  </div>
                </div>
              </div>

              {/* Line items */}
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60 bg-surface/40">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2">
                        Date
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2">
                        Service
                      </th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2 hidden sm:table-cell">
                        Gross
                      </th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2 hidden sm:table-cell">
                        Tip
                      </th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2">
                        Earned
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {stub.entries.map((e) => (
                      <tr
                        key={e.bookingId}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60"
                      >
                        <td className="px-3 py-2.5 text-muted whitespace-nowrap">{e.date}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-foreground">{e.service}</p>
                          <p className="text-[10px] text-muted">{e.client}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right text-foreground tabular-nums hidden sm:table-cell">
                          {fmt(e.grossInCents)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted tabular-nums hidden sm:table-cell">
                          {e.tipInCents > 0 ? fmt(e.tipInCents) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right align-middle">
                          <p className="font-semibold text-foreground tabular-nums">
                            {fmt(e.totalEarnedInCents)}
                          </p>
                          {e.tipEarnedInCents > 0 && (
                            <p className="text-[10px] text-muted tabular-nums">
                              +{fmt(e.tipEarnedInCents)} tip
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-surface/40">
                      <td colSpan={2} className="px-3 py-2.5 text-xs font-semibold text-foreground">
                        Total — {stub.totals.sessions} sessions
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums hidden sm:table-cell">
                        {fmt(stub.totals.grossInCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm text-muted tabular-nums hidden sm:table-cell">
                        {fmt(stub.totals.tipsInCents)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          {fmt(stub.totals.totalEarnedInCents)}
                        </p>
                        {stub.totals.tipEarnedInCents > 0 && (
                          <p className="text-[10px] text-muted tabular-nums">
                            incl. {fmt(stub.totals.tipEarnedInCents)} tips
                          </p>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface/60 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted">Service earnings</p>
                  <p className="text-lg font-semibold text-foreground mt-0.5">
                    {fmt(stub.totals.serviceEarnedInCents)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {stub.commissionType === "flat_fee"
                      ? `${stub.totals.sessions} × $${Math.round(stub.flatFeeInCents / 100)}`
                      : `${stub.rate}% of ${fmt(stub.totals.grossInCents)}`}
                  </p>
                </div>
                <div className="bg-surface/60 rounded-xl p-3 border border-border/60">
                  <p className="text-[10px] text-muted">Tip earnings</p>
                  <p className="text-lg font-semibold text-foreground mt-0.5">
                    {fmt(stub.totals.tipEarnedInCents)}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {stub.tipSplitPercent}% of {fmt(stub.totals.tipsInCents)} in tips
                  </p>
                </div>
              </div>

              {/* Total due */}
              <div className="flex items-center justify-between bg-accent/8 rounded-xl px-4 py-3 border border-accent/20">
                <p className="text-sm font-semibold text-foreground">Total Due</p>
                <p className="text-xl font-bold text-foreground tabular-nums">
                  {fmt(stub.totals.totalEarnedInCents)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {stub && stub.entries.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border text-xs font-medium rounded-lg hover:bg-foreground/5 transition-colors text-foreground"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
