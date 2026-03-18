import { Suspense } from "react";
import { getAppointmentGaps, type Range } from "../actions";
import { AppointmentGapSection } from "../components/AppointmentGapSection";

function GapSkeleton() {
  return <div className="h-48 bg-surface rounded-xl animate-pulse" />;
}

async function GapData({ range }: { range: Range }) {
  const appointmentGaps = await getAppointmentGaps(range);
  return <AppointmentGapSection data={appointmentGaps} />;
}

export function AppointmentGapSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<GapSkeleton />}>
      <GapData range={range} />
    </Suspense>
  );
}
