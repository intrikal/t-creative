/**
 * Profit & Loss summary — monthly revenue vs expenses table.
 *
 * @module financial/components/ProfitLossSection
 * @see {@link ../actions.ts} — `ProfitLossRow` type, `getProfitLoss()`
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProfitLossRow } from "../actions";

export function ProfitLossSection({ data }: { data: ProfitLossRow[] }) {
  const totals = data.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      expenses: acc.expenses + r.expenses,
      profit: acc.profit + r.profit,
    }),
    { revenue: 0, expenses: 0, profit: 0 },
  );

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-5 px-5">
        <CardTitle className="text-sm font-semibold">Profit & Loss — Last 6 Months</CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">No revenue or expense data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Month
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Revenue
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Expenses
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                    Profit
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr
                    key={r.month}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-5 py-3 align-middle">
                      <span className="text-sm text-foreground">{r.month}</span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm text-foreground tabular-nums">
                        ${r.revenue.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm text-muted tabular-nums">
                        ${r.expenses.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right align-middle">
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          r.profit >= 0 ? "text-[#4e6b51]" : "text-destructive",
                        )}
                      >
                        {r.profit >= 0 ? "+" : ""}${r.profit.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border bg-surface/40">
                  <td className="px-5 py-3 align-middle">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      ${totals.revenue.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <span className="text-sm font-semibold text-muted tabular-nums">
                      ${totals.expenses.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right align-middle">
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        totals.profit >= 0 ? "text-[#4e6b51]" : "text-destructive",
                      )}
                    >
                      {totals.profit >= 0 ? "+" : ""}${totals.profit.toLocaleString()}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
