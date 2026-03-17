import { Suspense } from "react";
import { getRevenueByService } from "../actions";
import { RevenueByServiceSection } from "../components/RevenueByServiceSection";

function RevenueByServiceSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function RevenueByServiceData() {
  const data = await getRevenueByService();
  return <RevenueByServiceSection data={data} />;
}

export function RevenueByServiceSectionWrapper() {
  return (
    <Suspense fallback={<RevenueByServiceSkeleton />}>
      <RevenueByServiceData />
    </Suspense>
  );
}
