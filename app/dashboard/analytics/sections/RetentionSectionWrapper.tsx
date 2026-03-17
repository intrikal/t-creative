import { Suspense } from "react";
import { getRetentionTrend, getAtRiskClients } from "../actions";
import { RetentionSection } from "../components/RetentionSection";

function RetentionSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function RetentionData() {
  const [retentionTrend, atRiskClients] = await Promise.all([
    getRetentionTrend(),
    getAtRiskClients(),
  ]);
  return <RetentionSection retentionTrend={retentionTrend} atRiskClients={atRiskClients} />;
}

export function RetentionSectionWrapper() {
  return (
    <Suspense fallback={<RetentionSkeleton />}>
      <RetentionData />
    </Suspense>
  );
}
