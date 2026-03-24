import { Suspense } from "react";
import { RevenuePage } from "../../revenue/RevenuePage";
import { getPayments, getRevenueStats, getCategoryRevenue, getWeeklyRevenue } from "../actions";

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
  // Sequential pairs to avoid overloading the connection pool.
  // getRevenueStats/getCategoryRevenue/getWeeklyRevenue results may already
  // be cached from the Overview section's render in the same request.
  const [payments, stats] = await Promise.all([getPayments(), getRevenueStats()]);
  const [categoryRevenue, weeklyRevenue] = await Promise.all([
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
