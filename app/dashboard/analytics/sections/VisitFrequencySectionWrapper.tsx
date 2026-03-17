import { Suspense } from "react";
import { getVisitFrequency } from "../actions";
import { VisitFrequencySection } from "../components/VisitFrequencySection";

function VisitFrequencySkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function VisitFrequencyData() {
  const data = await getVisitFrequency();
  return <VisitFrequencySection data={data} />;
}

export function VisitFrequencySectionWrapper() {
  return (
    <Suspense fallback={<VisitFrequencySkeleton />}>
      <VisitFrequencyData />
    </Suspense>
  );
}
