/**
 * Notifications loading skeleton — matches the NotificationsPage layout.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header skeleton */}
      <div>
        <div className="h-6 w-36 bg-surface rounded animate-pulse" />
        <div className="h-3.5 w-48 bg-surface rounded animate-pulse mt-2" />
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border py-4 px-4 space-y-2">
            <div className="h-2.5 w-16 bg-surface rounded animate-pulse" />
            <div className="h-7 w-10 bg-surface rounded animate-pulse" />
            <div className="h-2.5 w-20 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filter tabs skeleton */}
      <div className="flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-7 bg-surface rounded-lg animate-pulse"
            style={{ width: `${48 + i * 8}px` }}
          />
        ))}
      </div>

      {/* List skeleton */}
      <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3.5">
            <div className="w-8 h-8 bg-surface rounded-lg animate-pulse shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-3/4 bg-surface rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-surface rounded animate-pulse" />
              <div className="h-2.5 w-24 bg-surface rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
