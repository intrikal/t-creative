import { Suspense } from "react";
import { getRevenueByService, type Range } from "../actions";
import { RevenueByServiceSection } from "../components/RevenueByServiceSection";

function RevenueByServiceSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function RevenueByServiceData({ range }: { range: Range }) {
  const data = await getRevenueByService(range);
  return <RevenueByServiceSection data={data} />;
}

export function RevenueByServiceSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<RevenueByServiceSkeleton />}>
      <RevenueByServiceData range={range} />
    </Suspense>
  );
}
