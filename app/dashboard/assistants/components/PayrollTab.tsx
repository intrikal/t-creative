"use client";

import { DollarSign, Download, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const PAYROLL_DATA = [
  {
    name: "Aaliyah",
    role: "Lash Tech",
    type: "1099",
    sessions: 24,
    revenue: 2880,
    owed: 864,
    paid: false,
  },
  {
    name: "Jade",
    role: "Jewelry Tech",
    type: "1099",
    sessions: 12,
    revenue: 1020,
    owed: 306,
    paid: false,
  },
  {
    name: "Maya",
    role: "Crochet Tech",
    type: "1099",
    sessions: 8,
    revenue: 820,
    owed: 246,
    paid: true,
  },
  {
    name: "Trini",
    role: "Owner",
    type: "Owner Draw",
    sessions: 38,
    revenue: 5640,
    owed: 0,
    paid: true,
  },
];

const TAX_DATA = [
  { name: "Aaliyah", ein: "***-**-4821", total: 8640 },
  { name: "Jade", ein: "***-**-3392", total: 3670 },
  { name: "Maya", ein: "***-**-7714", total: 2460 },
];

export function PayrollTab() {
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
          <button className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border text-xs font-medium rounded-lg hover:bg-foreground/5 transition-colors text-foreground">
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors">
            <DollarSign className="w-3.5 h-3.5" />
            Run Payroll
          </button>
        </div>
      </div>

      {/* Pay period summary */}
      <div className="bg-background border border-border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted">Current Pay Period</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">Feb 1 – Feb 28, 2026</p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <p className="text-xs text-muted">Total Owed</p>
            <p className="text-lg font-semibold text-foreground">$1,416</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">Paid Out</p>
            <p className="text-lg font-semibold text-[#4e6b51]">$1,110</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted">Remaining</p>
            <p className="text-lg font-semibold text-[#a07040]">$306</p>
          </div>
        </div>
      </div>

      {/* Payroll table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-surface/40">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                Staff
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Type
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Sessions
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Revenue
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 py-2.5">
                Owed
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                Status
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 py-2.5">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {PAYROLL_DATA.map((s) => (
              <tr
                key={s.name}
                className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
              >
                <td className="px-4 py-3 align-middle">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-[10px] text-muted">{s.role}</p>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className="text-[10px] font-medium text-muted bg-surface border border-border px-1.5 py-0.5 rounded-full">
                    {s.type}
                  </span>
                </td>
                <td className="px-3 py-3 text-center align-middle">
                  <span className="text-sm text-foreground tabular-nums">{s.sessions}</span>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span className="text-sm text-foreground tabular-nums">
                    ${s.revenue.toLocaleString()}
                  </span>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      s.owed === 0 ? "text-muted" : "text-foreground",
                    )}
                  >
                    ${s.owed.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  {s.owed === 0 ? (
                    <span className="text-[10px] text-muted">N/A</span>
                  ) : s.paid ? (
                    <span className="flex items-center justify-center gap-1 text-[10px] text-[#4e6b51]">
                      <CheckSquare className="w-3 h-3" /> Paid
                    </span>
                  ) : (
                    <span className="text-[10px] text-[#a07040] bg-[#a07040]/10 px-1.5 py-0.5 rounded-full">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-center align-middle">
                  {s.owed > 0 && !s.paid && (
                    <button className="text-[10px] text-accent hover:underline">Mark Paid</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 1099 section */}
      <div className="bg-background border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-foreground">1099 Summary — Tax Year 2025</p>
          <button className="flex items-center gap-1.5 text-xs text-accent hover:underline">
            <Download className="w-3 h-3" /> Download All 1099s
          </button>
        </div>
        <div className="space-y-2">
          {TAX_DATA.map((s) => (
            <div
              key={s.name}
              className="flex items-center justify-between py-2 border-b border-border/40 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-[10px] text-muted">EIN/SSN: {s.ein}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular-nums">
                    ${s.total.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted">earned in 2025</p>
                </div>
                <button className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors">
                  <Download className="w-3 h-3" /> 1099
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
