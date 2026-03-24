import { Suspense } from "react";
import { getAttendanceStats, getCancellationReasons, getRebookRates, type Range } from "../actions";
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

async function OperationalData({ range }: { range: Range }) {
  const attendanceStats = await getAttendanceStats(range);
  const cancellationReasons = await getCancellationReasons();
  const rebookRates = await getRebookRates();

  return (
    <>
      <AttendanceSection attendance={attendanceStats} rebookRates={rebookRates} />
      <CancellationReasonsSection reasons={cancellationReasons} />
    </>
  );
}

export function OperationalSection({ range }: { range: Range }) {
  return (
    <Suspense fallback={<OperationalSkeleton />}>
      <OperationalData range={range} />
    </Suspense>
  );
}
