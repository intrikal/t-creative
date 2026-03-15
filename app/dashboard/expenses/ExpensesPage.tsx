"use client";

import { useState } from "react";
import { Receipt, TrendingUp, TrendingDown, DollarSign, Hash, Search } from "lucide-react";
import type {
  ExpenseRow,
  ExpenseStats,
  MonthlyExpense,
  ExpenseCategoryBreakdown,
} from "@/app/dashboard/financial/actions";
import { FinancialModals } from "@/app/dashboard/financial/components/FinancialModals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  supplies: "Supplies",
  rent: "Rent",
  marketing: "Marketing",
  equipment: "Equipment",
  software: "Software",
  travel: "Travel",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, string> = {
  Supplies: "bg-[#c4907a]",
  Rent: "bg-[#5b8a8a]",
  Marketing: "bg-[#d4a574]",
  Equipment: "bg-[#7ba3a3]",
  Software: "bg-[#8fa89c]",
  Travel: "bg-[#a68b7c]",
  Other: "bg-foreground/30",
};

interface Props {
  expenses: ExpenseRow[];
  stats: ExpenseStats;
  monthlyExpenses: MonthlyExpense[];
  expenseCategories: ExpenseCategoryBreakdown[];
}

export function ExpensesPage({ expenses, stats, monthlyExpenses, expenseCategories }: Props) {
  const [search, setSearch] = useState("");
  const [logOpen, setLogOpen] = useState(false);

  const maxBar = Math.max(...monthlyExpenses.map((m) => m.amount), 1);

  const filtered = expenses.filter(
    (e) =>
      !search ||
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.vendor ?? "").toLowerCase().includes(search.toLowerCase()) ||
      CATEGORY_LABELS[e.category]?.toLowerCase().includes(search.toLowerCase()),
  );

  const vsLabel =
    stats.expenseVsPriorMonthPct === null
      ? null
      : stats.expenseVsPriorMonthPct >= 0
        ? `↑ ${stats.expenseVsPriorMonthPct}% vs last month`
        : `↓ ${Math.abs(stats.expenseVsPriorMonthPct)}% vs last month`;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Expenses</h1>
          <p className="text-sm text-muted mt-0.5">Business costs and spending overview</p>
        </div>
        <button
          onClick={() => setLogOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors shrink-0"
        >
          + Log Expense
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total Expenses
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalExpenses.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">all time</p>
          </CardContent>
        </Card>

        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                This Month
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.thisMonthExpenses.toLocaleString()}
            </p>
            {vsLabel && (
              <p
                className={cn(
                  "text-xs mt-0.5 flex items-center gap-0.5",
                  stats.expenseVsPriorMonthPct! >= 0 ? "text-destructive" : "text-[#4e6b51]",
                )}
              >
                {stats.expenseVsPriorMonthPct! >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {vsLabel}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg / Month
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.avgMonthlyExpenses.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">last 6 months</p>
          </CardContent>
        </Card>

        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Entries
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {stats.expenseCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">logged expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Monthly bar chart */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">
              Monthly Expenses — Last 6 Months
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            {monthlyExpenses.every((m) => m.amount === 0) ? (
              <p className="text-sm text-muted py-10 text-center">No expense data yet.</p>
            ) : (
              <div className="flex items-end gap-2 h-36">
                {monthlyExpenses.map((bar, i) => (
                  <div key={bar.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted font-medium tabular-nums">
                      {bar.amount > 0 ? `$${(bar.amount / 1000).toFixed(1)}k` : ""}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        i === monthlyExpenses.length - 1 ? "bg-[#c4907a]" : "bg-[#e8c4b8]",
                      )}
                      style={{
                        height: `${Math.max((bar.amount / maxBar) * 100, bar.amount > 0 ? 4 : 0)}%`,
                      }}
                    />
                    <span className="text-[10px] text-muted text-center leading-tight">
                      {bar.month.split(" ")[0]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">By Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-3">
            {expenseCategories.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No data yet.</p>
            ) : (
              expenseCategories.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{cat.category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted">{cat.pct}%</span>
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        ${cat.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        CATEGORY_COLORS[cat.category] ?? "bg-foreground/20",
                      )}
                      style={{ width: `${cat.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Expense log */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Expense Log</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-12">
              {search ? "No expenses match your search." : "No expenses logged yet."}
            </p>
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
                  {filtered.map((exp) => (
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
                      ${filtered.reduce((s, e) => s + e.amount, 0).toLocaleString()}
                    </td>
                    <td className="px-4 md:px-5 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Log expense modal */}
      <FinancialModals modal={logOpen ? "expense" : null} onClose={() => setLogOpen(false)} />
    </div>
  );
}
