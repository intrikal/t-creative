/**
 * Reviews page loading skeleton — matches the page structure for seamless transitions.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div>
        <div className="h-8 w-36 bg-surface rounded animate-pulse" />
        <div className="h-4 w-64 bg-surface rounded animate-pulse mt-2" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border pb-px">
        <div className="h-4 w-20 bg-surface rounded animate-pulse my-2.5" />
        <div className="h-4 w-32 bg-surface rounded animate-pulse my-2.5" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-background border border-border rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-16 bg-surface rounded animate-pulse" />
                <div className="h-5 w-12 bg-surface rounded animate-pulse" />
                <div className="h-2.5 w-24 bg-surface rounded animate-pulse" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-surface animate-pulse shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Rating distribution */}
      <div className="bg-background border border-border rounded-xl px-5 py-4">
        <div className="flex items-center gap-6">
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <div className="h-10 w-14 bg-surface rounded animate-pulse" />
            <div className="h-3 w-20 bg-surface rounded animate-pulse" />
            <div className="h-2.5 w-16 bg-surface rounded animate-pulse" />
          </div>
          <div className="flex-1 space-y-2.5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-2.5 w-3 bg-surface rounded animate-pulse" />
                <div className="h-2.5 w-2.5 bg-surface rounded animate-pulse" />
                <div className="flex-1 h-1.5 bg-surface rounded-full animate-pulse" />
                <div className="h-2.5 w-6 bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="h-7 bg-surface rounded-lg animate-pulse"
            style={{ width: `${48 + i * 8}px` }}
          />
        ))}
        <div className="ml-auto h-7 w-24 bg-surface rounded-lg animate-pulse" />
        <div className="h-7 w-44 bg-surface rounded-lg animate-pulse" />
      </div>

      {/* Review cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-background border border-border rounded-xl px-5 pt-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-surface animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-3.5 w-24 bg-surface rounded animate-pulse" />
                  <div className="h-4 w-14 bg-surface rounded-full animate-pulse" />
                </div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, j) => (
                    <div key={j} className="w-3.5 h-3.5 bg-surface rounded animate-pulse" />
                  ))}
                  <div className="h-2.5 w-28 bg-surface rounded animate-pulse ml-2" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              <div className="h-3 w-full bg-surface rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-surface rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/50">
              <div className="h-3 w-16 bg-surface rounded animate-pulse" />
              <div className="h-3 w-12 bg-surface rounded animate-pulse" />
              <div className="h-3 w-10 bg-surface rounded animate-pulse ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
