import { Suspense } from "react";
import { getPromotionRoi, type Range } from "../actions";
import { PromotionRoiSection } from "../components/PromotionRoiSection";

function PromotionRoiSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function PromotionRoiData({ range }: { range: Range }) {
  const data = await getPromotionRoi(range);
  return <PromotionRoiSection data={data} />;
}

export function PromotionRoiSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<PromotionRoiSkeleton />}>
      <PromotionRoiData range={range} />
    </Suspense>
  );
}
