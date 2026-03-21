/**
 * Bookings loading skeleton — matches the BookingsPage layout.
 * Header, stat cards, tab bar, search/filter toolbar, and booking rows.
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="h-8 w-40 bg-surface rounded-lg animate-pulse" />
          <div className="h-4 w-56 bg-surface rounded animate-pulse mt-1" />
        </div>
        <div className="h-10 w-32 bg-surface rounded-lg animate-pulse shrink-0" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-background border border-border rounded-xl px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-14 bg-surface rounded animate-pulse" />
                <div className="h-5 w-10 bg-surface rounded animate-pulse" />
                <div className="h-2.5 w-20 bg-surface rounded animate-pulse" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-surface animate-pulse shrink-0" />
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-4 border-b border-border">
        {["Bookings", "Waitlist"].map((tab) => (
          <div key={tab} className="py-2.5 border-b-2 border-transparent">
            <div className="h-4 w-16 bg-surface rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-background border border-border rounded-xl">
        <div className="px-4 pt-4 pb-0">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="h-9 flex-1 bg-surface rounded-lg animate-pulse" />
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-8 w-16 bg-surface rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        </div>
        {/* Booking rows */}
        <div className="px-4 pb-4 pt-3 space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
              <div className="w-7 h-7 rounded-full bg-surface animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-surface rounded animate-pulse" />
                <div className="h-3 w-28 bg-surface rounded animate-pulse" />
              </div>
              <div className="h-3 w-16 bg-surface rounded animate-pulse shrink-0 hidden sm:block" />
              <div className="h-5 w-16 bg-surface rounded-full animate-pulse shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
