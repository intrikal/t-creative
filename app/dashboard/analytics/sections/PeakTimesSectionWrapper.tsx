import { Suspense } from "react";
import { getPeakTimes } from "../actions";
import { PeakTimesSection } from "../components/PeakTimes";

function PeakTimesSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function PeakTimesData() {
  const peakTimes = await getPeakTimes();
  return <PeakTimesSection byHour={peakTimes.byHour} byDay={peakTimes.byDay} />;
}

export function PeakTimesSectionWrapper() {
  return (
    <Suspense fallback={<PeakTimesSkeleton />}>
      <PeakTimesData />
    </Suspense>
  );
}
