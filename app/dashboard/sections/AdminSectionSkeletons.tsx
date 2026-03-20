/**
 * Skeleton fallbacks for each Suspense boundary on the admin dashboard.
 * These render instantly while data streams in.
 */

export function StatsSkeletonFallback() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="bg-background border border-border rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-16 bg-surface rounded animate-pulse" />
              <div className="h-5 w-12 bg-surface rounded animate-pulse" />
              <div className="h-2.5 w-20 bg-surface rounded animate-pulse" />
            </div>
            <div className="w-8 h-8 rounded-xl bg-surface animate-pulse shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScheduleInquiriesSkeletonFallback() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
      {/* Schedule skeleton */}
      <div className="xl:col-span-3 bg-background border border-border rounded-xl">
        <div className="px-5 pt-4 pb-0 flex items-center justify-between">
          <div className="h-4 w-28 bg-surface rounded animate-pulse" />
          <div className="h-3 w-14 bg-surface rounded animate-pulse" />
        </div>
        <div className="px-5 pb-4 pt-2 space-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
              <div className="w-14 shrink-0 flex flex-col items-center gap-1">
                <div className="w-1.5 h-1.5 bg-surface rounded-full animate-pulse" />
                <div className="h-3 w-10 bg-surface rounded animate-pulse" />
              </div>
              <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-surface rounded animate-pulse" />
                <div className="h-3 w-20 bg-surface rounded animate-pulse" />
              </div>
              <div className="h-5 w-16 bg-surface rounded-full animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
      {/* Inquiries skeleton */}
      <div className="xl:col-span-2 bg-background border border-border rounded-xl">
        <div className="px-5 pt-4 pb-0 flex items-center justify-between">
          <div className="h-4 w-20 bg-surface rounded animate-pulse" />
          <div className="h-3 w-14 bg-surface rounded animate-pulse" />
        </div>
        <div className="px-5 pb-4 pt-2 space-y-0">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3 py-2.5 border-b border-border/50 last:border-0">
              <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-surface rounded animate-pulse" />
                <div className="h-3 w-full bg-surface rounded animate-pulse" />
                <div className="h-2.5 w-16 bg-surface rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RevenueChartSkeletonFallback() {
  return (
    <div className="bg-background border border-border rounded-xl">
      <div className="px-5 pt-4 pb-0 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-4 w-36 bg-surface rounded animate-pulse" />
          <div className="h-3 w-48 bg-surface rounded animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-12 bg-surface rounded animate-pulse" />
          <div className="h-3 w-16 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="px-5 pb-4 pt-3">
        <div className="w-full h-40 bg-surface/40 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

export function BottomSkeletonFallback() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
      {/* Team today skeleton */}
      <div className="xl:col-span-2 bg-background border border-border rounded-xl">
        <div className="px-5 pt-4 pb-0 flex items-center justify-between">
          <div className="h-4 w-24 bg-surface rounded animate-pulse" />
          <div className="h-3 w-16 bg-surface rounded animate-pulse" />
        </div>
        <div className="px-5 pb-4 pt-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-border/50 last:border-0">
              <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-surface rounded animate-pulse" />
                <div className="h-3 w-16 bg-surface rounded animate-pulse" />
              </div>
              <div className="h-3 w-20 bg-surface rounded animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
      {/* Recent clients skeleton */}
      <div className="xl:col-span-3 bg-background border border-border rounded-xl">
        <div className="px-5 pt-4 pb-0 flex items-center justify-between">
          <div className="h-4 w-28 bg-surface rounded animate-pulse" />
          <div className="h-3 w-14 bg-surface rounded animate-pulse" />
        </div>
        <div className="px-5 pb-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
              <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-28 bg-surface rounded animate-pulse" />
                <div className="h-3 w-16 bg-surface rounded animate-pulse" />
              </div>
              <div className="h-2.5 w-16 bg-surface rounded animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
