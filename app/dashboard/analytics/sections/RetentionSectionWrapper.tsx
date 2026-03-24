import { Suspense } from "react";
import { getRetentionTrend, getAtRiskClients, type Range } from "../actions";
import { RetentionSection } from "../components/RetentionSection";

function RetentionSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function RetentionData({ range }: { range: Range }) {
  const retentionTrend = await getRetentionTrend(range);
  const atRiskClients = await getAtRiskClients();
  return <RetentionSection retentionTrend={retentionTrend} atRiskClients={atRiskClients} />;
}

export function RetentionSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<RetentionSkeleton />}>
      <RetentionData range={range} />
    </Suspense>
  );
}
