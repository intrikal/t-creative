import { Suspense } from "react";
import { getWaitlistConversion, type Range } from "../actions";
import { WaitlistConversionSection } from "../components/WaitlistConversionSection";

function WaitlistSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function WaitlistData({ range }: { range: Range }) {
  const data = await getWaitlistConversion(range);
  return <WaitlistConversionSection data={data} />;
}

export function WaitlistConversionSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<WaitlistSkeleton />}>
      <WaitlistData range={range} />
    </Suspense>
  );
}
