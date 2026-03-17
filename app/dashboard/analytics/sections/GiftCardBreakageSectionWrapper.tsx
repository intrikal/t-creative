import { Suspense } from "react";
import { getGiftCardBreakage } from "../actions";
import { GiftCardBreakageSection } from "../components/GiftCardBreakageSection";

function GiftCardBreakageSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function GiftCardBreakageData() {
  const data = await getGiftCardBreakage();
  return <GiftCardBreakageSection data={data} />;
}

export function GiftCardBreakageSectionWrapper() {
  return (
    <Suspense fallback={<GiftCardBreakageSkeleton />}>
      <GiftCardBreakageData />
    </Suspense>
  );
}
