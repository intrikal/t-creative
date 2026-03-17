/**
 * Checkout rebook rate — what % of completed appointments resulted in
 * the client booking their next visit within 24 hours (i.e. before leaving).
 *
 * Shows overall rate, per-staff breakdown, and per-category breakdown.
 *
 * DB-wired: data from `getCheckoutRebookRate()`.
 *
 * @module analytics/components/CheckoutRebookSection
 * @see {@link ../actions.ts} — `CheckoutRebookStats` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CheckoutRebookStats } from "../actions";

function rateColor(rate: number) {
  if (rate >= 70) return "text-[#4e6b51]";
  if (rate >= 40) return "text-[#d4a574]";
  return "text-destructive";
}

function rateBarColor(rate: number) {
  if (rate >= 70) return "bg-[#4e6b51]";
  if (rate >= 40) return "bg-[#d4a574]";
  return "bg-destructive/60";
}

export function CheckoutRebookSection({ data }: { data: CheckoutRebookStats }) {
  if (data.totalCompleted === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Checkout Rebook Rate</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">
            No completed appointments in the last 30 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Overall rate + by category */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Checkout Rebook Rate</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            Clients who booked their next visit within 24h
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="flex flex-col items-center justify-center py-3 mb-4">
            <span className={cn("text-4xl font-bold tabular-nums", rateColor(data.overallRate))}>
              {data.overallRate}%
            </span>
            <p className="text-[11px] text-muted mt-1">
              {data.totalRebooked} of {data.totalCompleted} appointments
            </p>
          </div>

          {data.byCategory.length > 0 && (
            <div className="space-y-2.5 pt-3 border-t border-border/40">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                By Category
              </p>
              {data.byCategory.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{c.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted">
                        {c.rebooked}/{c.completed}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums w-8 text-right",
                          rateColor(c.rate),
                        )}
                      >
                        {c.rate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", rateBarColor(c.rate))}
                      style={{ width: `${c.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-staff breakdown */}
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Rebook Rate by Staff</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            Who&apos;s best at getting clients to rebook before leaving
          </p>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {data.byStaff.length === 0 ? (
            <p className="text-sm text-muted text-center py-8 px-5">No staff data available.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Staff
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden sm:table-cell">
                    Completed
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden sm:table-cell">
                    Rebooked
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byStaff.map((s) => (
                  <tr
                    key={s.name}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-5 py-3 align-middle">
                      <p className="text-sm text-foreground">{s.name}</p>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden sm:table-cell">
                      <span className="text-xs text-muted tabular-nums">{s.completed}</span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle hidden sm:table-cell">
                      <span className="text-xs text-muted tabular-nums">{s.rebooked}</span>
                    </td>
                    <td className="px-5 py-3 text-right align-middle">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-border rounded-full overflow-hidden hidden md:block">
                          <div
                            className={cn("h-full rounded-full", rateBarColor(s.rate))}
                            style={{ width: `${s.rate}%` }}
                          />
                        </div>
                        <span className={cn("text-sm font-medium tabular-nums", rateColor(s.rate))}>
                          {s.rate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
