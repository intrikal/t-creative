import { Suspense } from "react";
import { getVisitFrequency, type Range } from "../actions";
import { VisitFrequencySection } from "../components/VisitFrequencySection";

function VisitFrequencySkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function VisitFrequencyData({ range }: { range: Range }) {
  const data = await getVisitFrequency(range);
  return <VisitFrequencySection data={data} />;
}

export function VisitFrequencySectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<VisitFrequencySkeleton />}>
      <VisitFrequencyData range={range} />
    </Suspense>
  );
}
