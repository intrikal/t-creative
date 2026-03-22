/**
 * Gift card breakage — what percentage of gift card value goes unredeemed.
 *
 * Shows overall breakage rate, breakdown by card status, and aging
 * analysis for cards with remaining balance.
 *
 * DB-wired: data from `getGiftCardBreakage()`.
 *
 * @module analytics/components/GiftCardBreakageSection
 * @see {@link ../actions.ts} — `GiftCardBreakageStats` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GiftCardBreakageStats } from "@/lib/types/analytics.types";

const AGING_COLORS = ["bg-[#4e6b51]", "bg-[#7ba3a3]", "bg-[#d4a574]", "bg-destructive/60"];

export function GiftCardBreakageSection({ data }: { data: GiftCardBreakageStats }) {
  if (data.totalSold === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Gift Card Breakage</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">No gift cards sold yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Overview */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Gift Card Breakage</CardTitle>
          <p className="text-xs text-muted mt-0.5">Unredeemed value is profit</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          {/* Big number */}
          <div className="flex flex-col items-center justify-center py-3 mb-4">
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {data.breakageRate}%
            </span>
            <p className="text-[11px] text-muted mt-1">unredeemed</p>
          </div>

          {/* Value breakdown */}
          <div className="space-y-2 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Cards sold</span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                {data.totalSold}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Total value</span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                ${data.totalOriginalValue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Redeemed</span>
              <span className="text-xs font-medium text-foreground tabular-nums">
                ${data.totalRedeemed.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">Remaining balance</span>
              <span className="text-xs font-semibold text-[#4e6b51] tabular-nums">
                ${data.totalRemaining.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Stacked bar showing redeemed vs remaining */}
          <div className="mt-3 h-3 bg-border rounded-full overflow-hidden flex">
            <div
              className="h-full bg-foreground/20"
              style={{
                width: `${data.totalOriginalValue > 0 ? (data.totalRedeemed / data.totalOriginalValue) * 100 : 0}%`,
              }}
            />
            <div
              className="h-full bg-[#4e6b51]"
              style={{
                width: `${data.breakageRate}%`,
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-foreground/20" />
              <span className="text-[10px] text-muted">Redeemed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#4e6b51]" />
              <span className="text-[10px] text-muted">Unredeemed</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status + Aging */}
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Breakdown</CardTitle>
          <p className="text-xs text-muted mt-0.5">By status and age of outstanding balance</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          {/* By status */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2.5">
              By Status
            </p>
            <table className="w-full text-sm mb-5">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted pb-2">
                    Status
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted pb-2 hidden sm:table-cell">
                    Cards
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted pb-2">
                    Original
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted pb-2">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.byStatus.map((s) => (
                  <tr key={s.status} className="border-b border-border/40 last:border-0">
                    <td className="py-2.5 text-sm text-foreground">{s.status}</td>
                    <td className="py-2.5 text-right hidden sm:table-cell">
                      <span className="text-xs text-muted tabular-nums">{s.count}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="text-xs text-muted tabular-nums">
                        ${s.originalValue.toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span
                        className={cn(
                          "text-sm font-medium tabular-nums",
                          s.remaining > 0 ? "text-[#4e6b51]" : "text-muted",
                        )}
                      >
                        ${s.remaining.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Aging */}
          {data.aging.some((a) => a.count > 0) && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2.5">
                Outstanding Balance by Age
              </p>
              <div className="space-y-2.5">
                {data.aging.map((bucket, i) => {
                  const maxRemaining = Math.max(...data.aging.map((a) => a.remaining), 1);
                  return (
                    <div key={bucket.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-foreground">{bucket.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted">
                            {bucket.count} card{bucket.count !== 1 ? "s" : ""}
                          </span>
                          <span className="text-xs font-medium text-foreground tabular-nums w-12 text-right">
                            ${bucket.remaining.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${AGING_COLORS[i] ?? "bg-foreground/30"}`}
                          style={{
                            width: `${maxRemaining > 0 ? (bucket.remaining / maxRemaining) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
