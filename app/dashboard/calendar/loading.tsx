/**
 * Calendar loading skeleton — matches the CalendarPage layout.
 * Tab bar, toolbar (nav + view switcher), and time-grid week view.
 */
export default function Loading() {
  return (
    <div className="flex flex-col h-full px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-4 gap-4">
      {/* Tab bar */}
      <div className="flex gap-4 border-b border-border -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 shrink-0">
        {["Calendar", "Availability", "Events"].map((tab) => (
          <div key={tab} className="py-2.5 border-b-2 border-transparent">
            <div className="h-4 w-16 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 bg-surface rounded-lg animate-pulse" />
          <div className="w-16 h-8 bg-surface rounded-lg animate-pulse" />
          <div className="w-8 h-8 bg-surface rounded-lg animate-pulse" />
        </div>
        <div className="h-5 w-40 bg-surface rounded animate-pulse flex-1" />
        <div className="h-8 w-64 bg-surface rounded-lg animate-pulse" />
        <div className="h-9 w-20 bg-surface rounded-lg animate-pulse" />
      </div>

      {/* Calendar grid */}
      <div className="flex-1 min-h-0 border border-border rounded-2xl overflow-hidden bg-background flex flex-col">
        {/* Day headers */}
        <div className="flex border-b border-border shrink-0">
          <div className="w-14 shrink-0" />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-1 py-3 flex flex-col items-center gap-1 border-l border-border/30">
              <div className="h-3 w-6 bg-surface rounded animate-pulse" />
              <div className="w-7 h-7 bg-surface rounded-full animate-pulse" />
            </div>
          ))}
        </div>
        {/* Time grid skeleton */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-14 shrink-0 pt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 flex items-start justify-end pr-2">
                <div className="h-3 w-8 bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="flex-1 relative">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-border/20"
                style={{ top: `${i * 64 + 12}px` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
