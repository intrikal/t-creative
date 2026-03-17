import { Suspense } from "react";
import { getKpiStats } from "../actions";
import { KpiCards } from "../components/KpiCards";

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-28 bg-surface rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

async function KpiData() {
  const kpiStats = await getKpiStats();
  return <KpiCards stats={kpiStats} />;
}

export function KpiSection() {
  return (
    <Suspense fallback={<KpiSkeleton />}>
      <KpiData />
    </Suspense>
  );
}
