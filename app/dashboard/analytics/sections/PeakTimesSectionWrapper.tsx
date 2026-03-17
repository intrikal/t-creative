import { Suspense } from "react";
import { getPeakTimes, type Range } from "../actions";
import { PeakTimesSection } from "../components/PeakTimes";

function PeakTimesSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function PeakTimesData({ range }: { range: Range }) {
  const peakTimes = await getPeakTimes(range);
  return <PeakTimesSection byHour={peakTimes.byHour} byDay={peakTimes.byDay} />;
}

export function PeakTimesSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<PeakTimesSkeleton />}>
      <PeakTimesData range={range} />
    </Suspense>
  );
}
