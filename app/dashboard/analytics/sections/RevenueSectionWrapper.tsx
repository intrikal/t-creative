import { Suspense } from "react";
import { getRevenueTrend, getRevenueGoal, getKpiStats } from "../actions";
import { RevenueSection } from "../components/RevenueSection";

function RevenueSkeleton() {
  return <div className="h-72 bg-surface rounded-xl animate-pulse" />;
}

async function RevenueData() {
  const [revenueTrend, revenueGoal, kpiStats] = await Promise.all([
    getRevenueTrend(),
    getRevenueGoal(),
    getKpiStats(),
  ]);

  return (
    <RevenueSection
      revenueTrend={revenueTrend}
      revenueMtd={kpiStats.revenueMtd}
      revenueGoal={revenueGoal}
    />
  );
}

export function RevenueSectionWrapper() {
  return (
    <Suspense fallback={<RevenueSkeleton />}>
      <RevenueData />
    </Suspense>
  );
}
