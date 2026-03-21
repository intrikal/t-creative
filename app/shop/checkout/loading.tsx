/**
 * Checkout page loading skeleton.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      <section className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="h-8 w-32 bg-surface rounded animate-pulse mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Cart items */}
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 py-3 border-b border-foreground/5">
                  <div className="w-16 h-16 bg-surface animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-surface rounded animate-pulse" />
                    <div className="h-3 w-16 bg-surface rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            {/* Summary */}
            <div className="space-y-4">
              <div className="h-6 w-24 bg-surface rounded animate-pulse" />
              <div className="h-4 w-full bg-surface rounded animate-pulse" />
              <div className="h-4 w-full bg-surface rounded animate-pulse" />
              <div className="h-12 w-full bg-surface rounded animate-pulse mt-6" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
