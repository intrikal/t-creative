import { Suspense } from "react";
import { getRevenuePerHour, type Range } from "../actions";
import { RevenuePerHourSection } from "../components/RevenuePerHourSection";

function RevenuePerHourSkeleton() {
  return <div className="h-72 bg-surface rounded-xl animate-pulse" />;
}

async function RevenuePerHourData({ range }: { range: Range }) {
  const data = await getRevenuePerHour(range);
  return <RevenuePerHourSection data={data} />;
}

export function RevenuePerHourSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<RevenuePerHourSkeleton />}>
      <RevenuePerHourData range={range} />
    </Suspense>
  );
}
