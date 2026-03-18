import { Suspense } from "react";
import { getGiftCardBreakage, type Range } from "../actions";
import { GiftCardBreakageSection } from "../components/GiftCardBreakageSection";

function GiftCardBreakageSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function GiftCardBreakageData({ range }: { range: Range }) {
  const data = await getGiftCardBreakage(range);
  return <GiftCardBreakageSection data={data} />;
}

export function GiftCardBreakageSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<GiftCardBreakageSkeleton />}>
      <GiftCardBreakageData range={range} />
    </Suspense>
  );
}
