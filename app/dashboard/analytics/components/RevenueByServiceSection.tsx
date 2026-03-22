/**
 * Revenue by individual service — table showing paid revenue per service
 * with percentage-of-total bar, category label, and booking count.
 *
 * DB-wired: data from `getRevenueByService()`.
 *
 * @module analytics/components/RevenueByServiceSection
 * @see {@link ../actions.ts} — `ServiceRevenueItem` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ServiceRevenueItem } from "@/lib/types/analytics.types";

const CATEGORY_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#4e6b51]",
  Jewelry: "bg-[#d4a574]",
  Crochet: "bg-[#7ba3a3]",
  Consulting: "bg-foreground/50",
};

export function RevenueByServiceSection({ data }: { data: ServiceRevenueItem[] }) {
  if (data.length === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Revenue by Service</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">
            No paid revenue in the last 30 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxPct = Math.max(...data.map((d) => d.pct), 1);

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold">Revenue by Service</CardTitle>
        <p className="text-xs text-muted mt-0.5">
          Last 30 days — paid revenue per individual service
        </p>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                Service
              </th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden sm:table-cell">
                Category
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden sm:table-cell">
                Bookings
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                Revenue
              </th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 w-28 hidden md:table-cell">
                % of Total
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => (
              <tr
                key={s.service}
                className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
              >
                <td className="px-5 py-3 align-middle">
                  <p className="text-sm text-foreground">{s.service}</p>
                </td>
                <td className="px-3 py-3 align-middle hidden sm:table-cell">
                  <span className="text-xs text-muted">{s.category}</span>
                </td>
                <td className="px-3 py-3 text-right align-middle hidden sm:table-cell">
                  <span className="text-xs text-muted tabular-nums">{s.bookings}</span>
                </td>
                <td className="px-3 py-3 text-right align-middle">
                  <span className="text-sm font-medium text-foreground tabular-nums">
                    ${s.revenue.toLocaleString()}
                  </span>
                </td>
                <td className="px-5 py-3 align-middle hidden md:table-cell">
                  <div className="flex items-center gap-2 justify-end">
                    <div className="w-16 h-2 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${CATEGORY_COLORS[s.category] ?? "bg-foreground/30"}`}
                        style={{ width: `${(s.pct / maxPct) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted tabular-nums w-7 text-right">{s.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
