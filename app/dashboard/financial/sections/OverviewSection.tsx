import { Suspense } from "react";
import {
  getRevenueStats,
  getCategoryRevenue,
  getWeeklyRevenue,
  getProfitLoss,
  getTaxEstimate,
  getProductSales,
  getDepositStats,
  getTipTrends,
  getExpenseCategoryBreakdown,
} from "../actions";
import { OverviewContent } from "./OverviewContent";

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 bg-surface rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 h-64 bg-surface rounded-xl animate-pulse" />
        <div className="xl:col-span-2 h-64 bg-surface rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

async function OverviewData() {
  // Batch queries in groups of 3 to avoid exhausting the connection pool.
  // Each function calls requireAdmin() internally, but cache() deduplicates
  // the auth check — only the data queries compete for connections.
  const [stats, categoryRevenue, weeklyRevenue] = await Promise.all([
    getRevenueStats(),
    getCategoryRevenue(),
    getWeeklyRevenue(),
  ]);

  const [profitLoss, taxEstimate, productSales] = await Promise.all([
    getProfitLoss(),
    getTaxEstimate(),
    getProductSales(),
  ]);

  const [depositStats, tipTrends, expenseCategories] = await Promise.all([
    getDepositStats(),
    getTipTrends(),
    getExpenseCategoryBreakdown(),
  ]);

  return (
    <OverviewContent
      stats={stats}
      categoryRevenue={categoryRevenue}
      weeklyRevenue={weeklyRevenue}
      profitLoss={profitLoss}
      taxEstimate={taxEstimate}
      productSales={productSales}
      depositStats={depositStats}
      tipTrends={tipTrends}
      expenseCategories={expenseCategories}
    />
  );
}

export function OverviewSection() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewData />
    </Suspense>
  );
}
