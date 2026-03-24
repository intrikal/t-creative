"use client";

import { TrendingUp, DollarSign, CreditCard, TrendingDown } from "lucide-react";
import {
  BarChart,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type {
  RevenueStats,
  CategoryRevenue,
  DailyRevenue,
  ProfitLossRow,
  TaxEstimate,
  ProductSalesStats,
  DepositStats,
  TipStats,
  ExpenseCategoryBreakdown,
} from "../actions";
import { DepositTrackingSection } from "../components/DepositTrackingSection";
import { ExpenseCategoriesSection } from "../components/ExpenseCategoriesSection";
import { ProductSalesSection } from "../components/ProductSalesSection";
import { ProfitLossSection } from "../components/ProfitLossSection";
import { TipTrendsSection } from "../components/TipTrendsSection";

const CATEGORY_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#c4907a]",
  Jewelry: "bg-[#d4a574]",
  Consulting: "bg-[#5b8a8a]",
  Crochet: "bg-[#7ba3a3]",
};

export function OverviewContent({
  stats,
  categoryRevenue,
  weeklyRevenue,
  profitLoss,
  taxEstimate,
  productSales,
  depositStats,
  tipTrends,
  expenseCategories,
}: {
  stats: RevenueStats;
  categoryRevenue: CategoryRevenue[];
  weeklyRevenue: DailyRevenue[];
  profitLoss: ProfitLossRow[];
  taxEstimate: TaxEstimate;
  productSales: ProductSalesStats;
  depositStats: DepositStats;
  tipTrends: TipStats;
  expenseCategories: ExpenseCategoryBreakdown[];
}) {
  const totalWeek = weeklyRevenue.reduce((s, b) => s + b.amount, 0);

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {[
          {
            label: "Total Revenue",
            value: `$${stats.totalRevenue.toLocaleString()}`,
            sub:
              stats.revenueVsPriorPeriodPct !== null
                ? `${stats.revenueVsPriorPeriodPct >= 0 ? "+" : ""}${stats.revenueVsPriorPeriodPct}% vs prior month`
                : "No prior data",
            icon: DollarSign,
            color: "text-[#4e6b51]",
            bg: "bg-[#4e6b51]/10",
          },
          {
            label: "This Week",
            value: `$${totalWeek.toLocaleString()}`,
            sub: "7-day rolling",
            icon: TrendingUp,
            color: "text-accent",
            bg: "bg-accent/10",
          },
          {
            label: "Tips",
            value: `$${stats.totalTips.toLocaleString()}`,
            sub: "gratuity collected",
            icon: TrendingDown,
            color: "text-[#d4a574]",
            bg: "bg-[#d4a574]/10",
          },
          {
            label: "Avg Ticket",
            value: `$${stats.avgTicket.toLocaleString()}`,
            sub: "per transaction",
            icon: CreditCard,
            color: "text-[#c4907a]",
            bg: "bg-[#c4907a]/10",
          },
          {
            label: `Est. Tax (${taxEstimate.quarterLabel})`,
            value: `$${taxEstimate.estimatedTax.toLocaleString()}`,
            sub: `${taxEstimate.taxRate}% of $${taxEstimate.netIncome.toLocaleString()} net`,
            icon: DollarSign,
            color: "text-[#7a5c10]",
            bg: "bg-[#7a5c10]/10",
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-muted uppercase tracking-wide leading-none">
                  {stat.label}
                </p>
                <p className="text-lg font-semibold text-foreground leading-tight">{stat.value}</p>
                <p className="text-xs text-muted">{stat.sub}</p>
              </div>
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                  stat.bg,
                )}
              >
                <stat.icon className={cn("w-4 h-4", stat.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sales tax collected — not revenue, collected on behalf of the state */}
      {stats.taxCollected > 0 && (
        <div className="flex items-center gap-2 px-1">
          <p className="text-xs text-muted">
            Sales tax collected this month:{" "}
            <span className="font-medium">${stats.taxCollected.toLocaleString()}</span>
          </p>
          <span className="text-[10px] text-muted/60">
            (reported by Square — not studio revenue)
          </span>
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bar chart */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Daily Revenue — This Week</CardTitle>
              <span className="text-xs text-muted">${totalWeek.toLocaleString()} total</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyRevenue} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-tertiary)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="day"
                  tick={{
                    fontSize: 11,
                    fontFamily: "inherit",
                    fill: "var(--color-text-secondary)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  tick={{
                    fontSize: 11,
                    fontFamily: "inherit",
                    fill: "var(--color-text-secondary)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                        <p className="font-semibold mb-1">{label}</p>
                        <p className="text-muted">
                          ${(payload[0].value as number).toLocaleString()}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="amount"
                  fill="#c4907a"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-3.5">
            {categoryRevenue.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1.5">
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
                      CATEGORY_COLORS[cat.category] ?? "bg-[#8fa89c]",
                    )}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* P&L over time */}
      {profitLoss.length > 0 && (
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-semibold">Profit &amp; Loss</CardTitle>
              <div className="flex gap-3 flex-wrap">
                {[
                  { label: "Revenue", color: "bg-[#4e6b51]" },
                  { label: "Expenses", color: "bg-[#c4907a]" },
                  { label: "Net income", color: "bg-[#2d2d2d]" },
                ].map((l) => (
                  <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={cn("w-2 h-2 rounded-sm", l.color)} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={profitLoss} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border-tertiary)"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="month"
                  tickFormatter={(v: string) => v.slice(0, 3)}
                  tick={{
                    fontSize: 11,
                    fontFamily: "inherit",
                    fill: "var(--color-text-secondary)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{
                    fontSize: 11,
                    fontFamily: "inherit",
                    fill: "var(--color-text-secondary)",
                  }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const get = (key: string) =>
                      (payload.find((p) => p.dataKey === key)?.value as number) ?? 0;
                    return (
                      <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                        <p className="font-semibold mb-1.5 pb-1 border-b border-border">{label}</p>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">Revenue</span>
                            <span className="font-medium">${get("revenue").toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">Expenses</span>
                            <span className="font-medium">${get("expenses").toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">Net income</span>
                            <span className="font-medium">${get("net").toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#4e6b51"
                  fillOpacity={0.7}
                  name="Revenue"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="expenses"
                  fill="#c4907a"
                  fillOpacity={0.7}
                  name="Expenses"
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#2d2d2d"
                  strokeWidth={2}
                  dot={false}
                  name="Net income"
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Product vs Service Revenue */}
      <ProductSalesSection productSales={productSales} totalRevenue={stats.totalRevenue} />

      {/* Tip Trends */}
      <TipTrendsSection data={tipTrends} />

      {/* Profit & Loss + Expense Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ProfitLossSection data={profitLoss} />
        <ExpenseCategoriesSection data={expenseCategories} />
      </div>

      {/* Deposit Collection */}
      <DepositTrackingSection data={depositStats} />
    </>
  );
}
