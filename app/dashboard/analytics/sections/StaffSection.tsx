import { Suspense } from "react";
import { getStaffPerformance, type Range } from "../actions";
import { StaffPerformanceSection } from "../components/StaffPerformance";

function StaffSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function StaffData({ range }: { range: Range }) {
  const staffPerformance = await getStaffPerformance(range);
  return <StaffPerformanceSection staff={staffPerformance} />;
}

export function StaffSection({ range }: { range: Range }) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <StaffData range={range} />
    </Suspense>
  );
}
