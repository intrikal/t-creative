import { Suspense } from "react";
import {
  getPayments,
  getRevenueStats,
  getCategoryRevenue,
  getWeeklyRevenue,
} from "../actions";
import { RevenuePage } from "../../revenue/RevenuePage";

function RevenueSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-surface rounded-xl animate-pulse" />
    </div>
  );
}

async function RevenueData() {
  const [payments, stats, categoryRevenue, weeklyRevenue] = await Promise.all([
    getPayments(),
    getRevenueStats(),
    getCategoryRevenue(),
    getWeeklyRevenue(),
  ]);

  return (
    <RevenuePage
      payments={payments}
      stats={stats}
      categoryRevenue={categoryRevenue}
      weeklyRevenue={weeklyRevenue}
      embedded
    />
  );
}

export function RevenueSection() {
  return (
    <Suspense fallback={<RevenueSkeleton />}>
      <RevenueData />
    </Suspense>
  );
}
