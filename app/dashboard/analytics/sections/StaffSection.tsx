import { Suspense } from "react";
import { getStaffPerformance } from "../actions";
import { StaffPerformanceSection } from "../components/StaffPerformance";

function StaffSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function StaffData() {
  const staffPerformance = await getStaffPerformance();
  return <StaffPerformanceSection staff={staffPerformance} />;
}

export function StaffSection() {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <StaffData />
    </Suspense>
  );
}
