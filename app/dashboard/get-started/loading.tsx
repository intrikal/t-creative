/**
 * Get-started loading skeleton — matches the GettingStartedPage layout.
 * Welcome header, setup checklist cards, next steps, and feature grid.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Welcome header + booking site button */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-64 bg-surface rounded-lg animate-pulse" />
        <div className="h-10 w-40 bg-surface rounded-lg animate-pulse hidden md:block" />
      </div>

      {/* Setup checklist card */}
      <div className="bg-background border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="h-5 w-36 bg-surface rounded animate-pulse mb-2" />
            <div className="h-3.5 w-52 bg-surface rounded animate-pulse" />
          </div>
          <div className="h-4 w-24 bg-surface rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface/40 rounded-xl overflow-hidden">
              <div className="h-28 bg-surface/60 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-32 bg-surface rounded animate-pulse" />
                <div className="h-3 w-full bg-surface rounded animate-pulse" />
                <div className="h-3 w-16 bg-surface rounded animate-pulse mt-1" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Next steps */}
      <div className="h-5 w-28 bg-surface rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-background border border-border rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-surface rounded-lg animate-pulse shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-36 bg-surface rounded animate-pulse" />
              <div className="h-3 w-full bg-surface rounded animate-pulse" />
            </div>
            <div className="h-9 w-28 bg-surface rounded-lg animate-pulse shrink-0" />
          </div>
        ))}
      </div>

      {/* Feature grid */}
      <div className="h-5 w-48 bg-surface rounded animate-pulse mt-2" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-background border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-surface rounded-lg animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-24 bg-surface rounded animate-pulse" />
                <div className="h-3 w-full bg-surface rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
