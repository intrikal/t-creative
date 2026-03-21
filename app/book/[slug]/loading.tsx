/**
 * Booking page loading skeleton — matches the BookingPage layout.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      <section className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-4xl">
          {/* Studio header skeleton */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-full bg-surface animate-pulse" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-surface rounded animate-pulse" />
              <div className="h-3 w-32 bg-surface rounded animate-pulse" />
            </div>
          </div>
          {/* Service cards skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-foreground/8 p-6 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-5 w-40 bg-surface rounded animate-pulse" />
                    <div className="h-3 w-64 bg-surface rounded animate-pulse" />
                  </div>
                  <div className="text-right space-y-2">
                    <div className="h-5 w-16 bg-surface rounded animate-pulse" />
                    <div className="h-3 w-20 bg-surface rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
