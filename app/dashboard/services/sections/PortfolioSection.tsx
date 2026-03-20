import { Suspense } from "react";
import { getMediaItems, getMediaStats } from "../../media/actions";
import { MediaPage } from "../../media/MediaPage";

function PortfolioSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-surface rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square bg-surface rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

async function PortfolioData() {
  const [items, stats] = await Promise.all([getMediaItems(), getMediaStats()]);

  return <MediaPage initialItems={items} stats={stats} embedded />;
}

export function PortfolioSection() {
  return (
    <Suspense fallback={<PortfolioSkeleton />}>
      <PortfolioData />
    </Suspense>
  );
}
