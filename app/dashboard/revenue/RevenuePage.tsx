"use client";

/**
 * RevenuePage — Revenue analytics and payment transaction history.
 *
 * Backed by real `payments` table data fetched in the server component (page.tsx).
 * Receives PaymentRow[], RevenueStats, CategoryRevenue[], and DailyRevenue[] as props.
 */

import { useState } from "react";
import { DollarSign, CreditCard, Search, Users } from "lucide-react";
import type {
  PaymentRow,
  RevenueStats,
  CategoryRevenue,
  DailyRevenue,
} from "@/app/dashboard/financial/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

const CATEGORY_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#c4907a]",
  Jewelry: "bg-[#d4a574]",
  Consulting: "bg-[#5b8a8a]",
  Crochet: "bg-[#7ba3a3]",
  "3D Printing": "bg-[#8fa89c]",
  Aesthetics: "bg-[#b4ccc6]",
};

function statusConfig(status: string) {
  switch (status) {
    case "paid":
    case "completed":
      return { label: "Paid", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "refunded":
      return { label: "Refunded", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "failed":
      return {
        label: "Failed",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    default:
      return { label: status, className: "bg-foreground/8 text-muted border-foreground/10" };
  }
}

function methodLabel(method: string | null) {
  if (!method) return "—";
  return { card: "Card", cash: "Cash", square: "Square", afterpay: "Afterpay" }[method] ?? method;
}

/* ------------------------------------------------------------------ */
/*  Props                                                               */
/* ------------------------------------------------------------------ */

interface Props {
  payments: PaymentRow[];
  stats: RevenueStats;
  categoryRevenue: CategoryRevenue[];
  weeklyRevenue: DailyRevenue[];
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function RevenuePage({ payments, stats, categoryRevenue, weeklyRevenue }: Props) {
  const [search, setSearch] = useState("");

  const maxBar = Math.max(...weeklyRevenue.map((b) => b.amount), 1);

  const filtered = payments.filter(
    (p) =>
      !search ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.service.toLowerCase().includes(search.toLowerCase()),
  );

  const vsLabel =
    stats.revenueVsPriorPeriodPct === null
      ? null
      : stats.revenueVsPriorPeriodPct >= 0
        ? `↑ ${stats.revenueVsPriorPeriodPct}% vs last month`
        : `↓ ${Math.abs(stats.revenueVsPriorPeriodPct)}% vs last month`;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Revenue</h1>
        <p className="text-sm text-muted mt-0.5">Payments and earnings overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total Revenue
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalRevenue.toLocaleString()}
            </p>
            {vsLabel && (
              <p
                className={cn(
                  "text-xs mt-0.5",
                  stats.revenueVsPriorPeriodPct! >= 0 ? "text-[#4e6b51]" : "text-destructive",
                )}
              >
                {vsLabel}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Transactions
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              {stats.transactionCount.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">all time</p>
          </CardContent>
        </Card>

        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Tips
            </p>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalTips.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">gratuity collected</p>
          </CardContent>
        </Card>

        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg Ticket
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${stats.avgTicket}</p>
            <p className="text-xs text-muted mt-0.5">per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bar chart */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Revenue by Day of Week</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            {weeklyRevenue.every((b) => b.amount === 0) ? (
              <p className="text-sm text-muted py-10 text-center">No payment data yet.</p>
            ) : (
              <div className="flex items-end gap-2 h-36">
                {weeklyRevenue.map((bar, i) => (
                  <div key={bar.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted font-medium tabular-nums">
                      {bar.amount > 0 ? `$${(bar.amount / 1000).toFixed(1)}k` : ""}
                    </span>
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        i === 4 ? "bg-[#c4907a]" : "bg-[#e8c4b8]",
                      )}
                      style={{
                        height: `${Math.max((bar.amount / maxBar) * 100, bar.amount > 0 ? 4 : 0)}%`,
                      }}
                    />
                    <span className="text-[10px] text-muted">{bar.day}</span>
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
            {categoryRevenue.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">No data yet.</p>
            ) : (
              categoryRevenue.map((cat) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-foreground">{cat.category}</span>
                    <span className="text-xs font-medium text-foreground">
                      ${cat.amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        CATEGORY_COLORS[cat.category] ?? "bg-[#c4907a]",
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

      {/* Transaction history */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Transactions</CardTitle>
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
        <CardContent className="px-4 pb-4 pt-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center">
              {search ? "No transactions match your search." : "No transactions yet."}
            </p>
          ) : (
            filtered.map((payment) => {
              const status = statusConfig(payment.status);
              return (
                <div
                  key={payment.id}
                  className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{payment.client}</p>
                    <p className="text-xs text-muted mt-0.5">{payment.service}</p>
                    <p className="text-[10px] text-muted/60 mt-0.5">
                      {payment.date} · {methodLabel(payment.method)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-foreground">${payment.amount}</p>
                    {payment.tip > 0 && (
                      <p className="text-[10px] text-muted">+${payment.tip} tip</p>
                    )}
                  </div>

                  <Badge
                    className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
                  >
                    {status.label}
                  </Badge>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
