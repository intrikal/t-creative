import { Suspense } from "react";
import { getAttendanceStats, getCancellationReasons, getRebookRates } from "../actions";
import { AttendanceSection } from "../components/AttendanceSection";
import { CancellationReasonsSection } from "../components/CancellationReasonsSection";

function OperationalSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-64 bg-surface rounded-xl animate-pulse" />
      <div className="h-48 bg-surface rounded-xl animate-pulse" />
    </div>
  );
}

async function OperationalData() {
  const [attendanceStats, cancellationReasons, rebookRates] = await Promise.all([
    getAttendanceStats(),
    getCancellationReasons(),
    getRebookRates(),
  ]);

  return (
    <>
      <AttendanceSection attendance={attendanceStats} rebookRates={rebookRates} />
      <CancellationReasonsSection reasons={cancellationReasons} />
    </>
  );
}

export function OperationalSection() {
  return (
    <Suspense fallback={<OperationalSkeleton />}>
      <OperationalData />
    </Suspense>
  );
}
