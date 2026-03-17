import { Suspense } from "react";
import { getAppointmentGaps } from "../actions";
import { AppointmentGapSection } from "../components/AppointmentGapSection";

function GapSkeleton() {
  return <div className="h-48 bg-surface rounded-xl animate-pulse" />;
}

async function GapData() {
  const appointmentGaps = await getAppointmentGaps();
  return <AppointmentGapSection data={appointmentGaps} />;
}

export function AppointmentGapSectionWrapper() {
  return (
    <Suspense fallback={<GapSkeleton />}>
      <GapData />
    </Suspense>
  );
}
