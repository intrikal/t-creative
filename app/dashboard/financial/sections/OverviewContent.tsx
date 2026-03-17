"use client";

import { useState } from "react";
import { TrendingUp, DollarSign, CreditCard, TrendingDown } from "lucide-react";
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
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const maxBar = Math.max(...weeklyRevenue.map((b) => b.amount), 1);
  const gridLines = [2000, 1500, 1000, 500].filter((g) => g <= maxBar * 1.1);
  const totalWeek = weeklyRevenue.reduce((s, b) => s + b.amount, 0);

  return (
    <>
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total Revenue
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalRevenue.toLocaleString()}
            </p>
            {stats.revenueVsPriorPeriodPct !== null ? (
              <p
                className={cn(
                  "text-xs mt-1 flex items-center gap-0.5",
                  stats.revenueVsPriorPeriodPct >= 0 ? "text-[#4e6b51]" : "text-destructive",
                )}
              >
                {stats.revenueVsPriorPeriodPct >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(stats.revenueVsPriorPeriodPct)}% vs prior month
              </p>
            ) : (
              <p className="text-xs text-muted mt-1">No prior data</p>
            )}
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                This Week
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${totalWeek.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">7-day rolling</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tips</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.totalTips.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">gratuity collected</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg Ticket
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${stats.avgTicket.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">per transaction</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Est. Tax ({taxEstimate.quarterLabel})
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${taxEstimate.estimatedTax.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-1">
              {taxEstimate.taxRate}% of ${taxEstimate.netIncome.toLocaleString()} net
            </p>
          </CardContent>
        </Card>
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
            <div className="relative h-44">
              {gridLines.map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${(line / maxBar) * 100}%` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-10 text-right shrink-0">
                    ${(line / 1000).toFixed(1)}k
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
              <div className="absolute inset-0 pl-12 flex items-end gap-2">
                {weeklyRevenue.map((bar, i) => (
                  <div
                    key={bar.day}
                    className="relative flex-1 flex flex-col items-center justify-end h-full"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {hoveredBar === i && (
                      <div className="absolute bottom-full mb-1.5 z-10 pointer-events-none">
                        <div className="bg-foreground text-background text-[10px] font-semibold rounded-md px-2 py-1 whitespace-nowrap shadow-sm">
                          ${bar.amount.toLocaleString()}
                        </div>
                        <div className="w-1.5 h-1.5 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all cursor-default",
                        i === 4 ? "bg-[#c4907a]" : "bg-[#e8c4b8]",
                        hoveredBar === i && "brightness-90",
                      )}
                      style={{ height: `${(bar.amount / maxBar) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pl-12 mt-1.5">
              {weeklyRevenue.map((bar) => (
                <div key={bar.day} className="flex-1 text-center">
                  <span className="text-[10px] text-muted">{bar.day}</span>
                </div>
              ))}
            </div>
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
