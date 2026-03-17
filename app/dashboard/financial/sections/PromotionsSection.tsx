import { Suspense } from "react";
import { getPromotions } from "../actions";
import { PromotionsContent } from "./PromotionsContent";

function PromotionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

async function PromotionsData() {
  const promotions = await getPromotions();
  return <PromotionsContent promotions={promotions} />;
}

export function PromotionsSection() {
  return (
    <Suspense fallback={<PromotionsSkeleton />}>
      <PromotionsData />
    </Suspense>
  );
}
