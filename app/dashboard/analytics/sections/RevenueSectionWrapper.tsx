import { Suspense } from "react";
import { getRevenueTrend, getRevenueGoal, getKpiStats, type Range } from "../actions";
import { RevenueSection } from "../components/RevenueSection";

function RevenueSkeleton() {
  return <div className="h-72 bg-surface rounded-xl animate-pulse" />;
}

async function RevenueData({ range }: { range: Range }) {
  const [revenueTrend, revenueGoal, kpiStats] = await Promise.all([
    getRevenueTrend(range),
    getRevenueGoal(),
    getKpiStats(range),
  ]);

  return (
    <RevenueSection
      revenueTrend={revenueTrend}
      revenueMtd={kpiStats.revenueMtd}
      revenueGoal={revenueGoal}
    />
  );
}

export function RevenueSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<RevenueSkeleton />}>
      <RevenueData range={range} />
    </Suspense>
  );
}
