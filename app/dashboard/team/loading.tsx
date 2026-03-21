/**
 * Dashboard loading skeleton — displayed during route transitions within the dashboard.
 */
export default function Loading() {
  return (
    <div className="p-6 md:p-8">
      <div className="h-4 w-32 bg-surface rounded animate-pulse mb-6" />
      <div className="h-8 w-48 bg-surface rounded animate-pulse mb-6" />
      {/* Team member cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-foreground/8 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-surface animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-32 bg-surface rounded animate-pulse" />
                <div className="h-3 w-20 bg-surface rounded animate-pulse" />
              </div>
            </div>
            <div className="h-3 w-full bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* Shifts/schedule skeleton */}
      <div className="h-8 w-40 bg-surface rounded animate-pulse mb-4" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="border border-foreground/8 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="space-y-2">
              <div className="h-4 w-36 bg-surface rounded animate-pulse" />
              <div className="h-3 w-24 bg-surface rounded animate-pulse" />
            </div>
            <div className="h-4 w-20 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
