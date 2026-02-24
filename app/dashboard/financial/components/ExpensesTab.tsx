/**
 * Expenses tab — DB-wired expense table with receipt status.
 *
 * Receives `ExpenseRow[]` from `getExpenses()` via parent props.
 *
 * @module financial/components/ExpensesTab
 * @see {@link ../actions.ts} — `ExpenseRow` type, `getExpenses()`
 */
"use client";

import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ExpenseRow } from "../actions";

const CATEGORY_LABELS: Record<string, string> = {
  supplies: "Supplies",
  rent: "Rent",
  marketing: "Marketing",
  equipment: "Equipment",
  software: "Software",
  travel: "Travel",
  other: "Other",
};

export function ExpensesTab({
  expenses,
  onLogExpense,
}: {
  expenses: ExpenseRow[];
  onLogExpense: () => void;
}) {
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-muted" /> Expenses
          </CardTitle>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">${totalExpenses.toLocaleString()} total</span>
            <button
              onClick={onLogExpense}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              + Log Expense
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {expenses.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">No expenses logged yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                    Date
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Category
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                    Description
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                    Vendor
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Amount
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                    Receipt
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr
                    key={exp.id}
                    className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-4 md:px-5 py-3 text-xs text-muted align-middle whitespace-nowrap">
                      {exp.date}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="text-xs font-medium text-foreground">
                        {CATEGORY_LABELS[exp.category] ?? exp.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell align-middle">
                      <span className="text-xs text-muted">{exp.description}</span>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell align-middle">
                      <span className="text-xs text-muted">{exp.vendor ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-right align-middle">
                      <span className="text-sm font-semibold text-foreground tabular-nums">
                        ${exp.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 md:px-5 py-3 text-center align-middle">
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          exp.hasReceipt ? "text-[#4e6b51]" : "text-muted",
                        )}
                      >
                        {exp.hasReceipt ? "Yes" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface/40">
                  <td
                    colSpan={4}
                    className="px-4 md:px-5 py-2.5 text-xs font-semibold text-foreground hidden lg:table-cell"
                  >
                    Total
                  </td>
                  <td
                    colSpan={4}
                    className="px-4 md:px-5 py-2.5 text-xs font-semibold text-foreground lg:hidden"
                  >
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                    ${totalExpenses.toLocaleString()}
                  </td>
                  <td className="px-4 md:px-5 py-2.5" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
