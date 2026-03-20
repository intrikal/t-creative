/**
 * Dashboard overview loading skeleton — matches the streaming layout.
 * Header + quick actions skeleton, then stat/section skeletons matching
 * the Suspense fallback shapes so the transition feels seamless.
 */
import {
  StatsSkeletonFallback,
  ScheduleInquiriesSkeletonFallback,
  RevenueChartSkeletonFallback,
  BottomSkeletonFallback,
} from "./sections/AdminSectionSkeletons";

export default function Loading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Greeting + booking site button */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-8 w-56 bg-surface rounded-lg animate-pulse" />
          <div className="h-4 w-36 bg-surface rounded animate-pulse mt-1" />
        </div>
        <div className="h-10 w-40 bg-surface rounded-lg animate-pulse hidden sm:block" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-surface border border-border">
            <div className="w-8 h-8 rounded-lg bg-surface/60 animate-pulse" />
            <div className="h-3 w-14 bg-surface/60 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Reuse the same skeletons as the Suspense fallbacks */}
      <StatsSkeletonFallback />
      <ScheduleInquiriesSkeletonFallback />
      <RevenueChartSkeletonFallback />
      <BottomSkeletonFallback />
    </div>
  );
}
