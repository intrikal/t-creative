import { Suspense } from "react";
import { getRevenuePerHour } from "../actions";
import { RevenuePerHourSection } from "../components/RevenuePerHourSection";

function RevenuePerHourSkeleton() {
  return <div className="h-72 bg-surface rounded-xl animate-pulse" />;
}

async function RevenuePerHourData() {
  const data = await getRevenuePerHour();
  return <RevenuePerHourSection data={data} />;
}

export function RevenuePerHourSectionWrapper() {
  return (
    <Suspense fallback={<RevenuePerHourSkeleton />}>
      <RevenuePerHourData />
    </Suspense>
  );
}
