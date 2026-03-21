/**
 * Dashboard loading skeleton — displayed during route transitions within the dashboard.
 */
export default function Loading() {
  return (
    <div className="p-6 md:p-8">
      {/* Back link skeleton */}
      <div className="h-4 w-24 bg-surface rounded animate-pulse mb-6" />
      {/* Client header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-full bg-surface animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-surface rounded animate-pulse" />
          <div className="h-4 w-32 bg-surface rounded animate-pulse" />
        </div>
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-foreground/8 rounded-xl p-4 space-y-2">
            <div className="h-4 w-20 bg-surface rounded animate-pulse" />
            <div className="h-6 w-16 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>
      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border border-foreground/8 rounded-xl p-4 flex items-center justify-between"
          >
            <div className="space-y-2">
              <div className="h-4 w-40 bg-surface rounded animate-pulse" />
              <div className="h-3 w-28 bg-surface rounded animate-pulse" />
            </div>
            <div className="h-4 w-16 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
