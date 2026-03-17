import { Suspense } from "react";
import { getGiftCards } from "../actions";
import { GiftCardsContent } from "./GiftCardsContent";

function GiftCardsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

async function GiftCardsData() {
  const giftCards = await getGiftCards();
  return <GiftCardsContent giftCards={giftCards} />;
}

export function GiftCardsSection() {
  return (
    <Suspense fallback={<GiftCardsSkeleton />}>
      <GiftCardsData />
    </Suspense>
  );
}
