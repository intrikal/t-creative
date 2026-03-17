import { Suspense } from "react";
import { getPromotionRoi } from "../actions";
import { PromotionRoiSection } from "../components/PromotionRoiSection";

function PromotionRoiSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function PromotionRoiData() {
  const data = await getPromotionRoi();
  return <PromotionRoiSection data={data} />;
}

export function PromotionRoiSectionWrapper() {
  return (
    <Suspense fallback={<PromotionRoiSkeleton />}>
      <PromotionRoiData />
    </Suspense>
  );
}
