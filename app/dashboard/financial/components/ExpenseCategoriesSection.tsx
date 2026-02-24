/**
 * Expense breakdown by category — progress bars per expense type.
 *
 * @module financial/components/ExpenseCategoriesSection
 * @see {@link ../actions.ts} — `ExpenseCategoryBreakdown` type, `getExpenseCategoryBreakdown()`
 */
"use client";

import { PieChart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExpenseCategoryBreakdown } from "../actions";

const CATEGORY_COLORS: Record<string, string> = {
  Supplies: "bg-[#c4907a]",
  Rent: "bg-[#5b8a8a]",
  Marketing: "bg-[#d4a574]",
  Equipment: "bg-[#7ba3a3]",
  Software: "bg-[#8fa89c]",
  Travel: "bg-[#a68b7c]",
  Other: "bg-foreground/30",
};

export function ExpenseCategoriesSection({ data }: { data: ExpenseCategoryBreakdown[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0);

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieChart className="w-4 h-4 text-muted" /> Expense Breakdown
          </CardTitle>
          <span className="text-xs text-muted">${total.toLocaleString()} total</span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 space-y-3.5">
        {data.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No expenses logged yet.</p>
        ) : (
          data.map((d) => (
            <div key={d.category}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-foreground">{d.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{d.pct}%</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    ${d.amount.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${CATEGORY_COLORS[d.category] ?? "bg-foreground/20"}`}
                  style={{ width: `${d.pct}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
