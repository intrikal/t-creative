/**
 * Shop page loading skeleton — matches the product grid layout.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      {/* Hero skeleton */}
      <section className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-5xl text-center">
          <div className="h-3 w-16 bg-surface rounded animate-pulse mx-auto mb-6" />
          <div className="h-10 w-80 max-w-full bg-surface rounded animate-pulse mx-auto mb-6" />
          <div className="h-4 w-96 max-w-full bg-surface rounded animate-pulse mx-auto" />
        </div>
      </section>

      {/* Product grid skeleton */}
      <section className="pb-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-foreground/8 flex flex-col">
                <div className="w-full aspect-[4/3] bg-surface animate-pulse" />
                <div className="p-6 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-4 w-32 bg-surface rounded animate-pulse" />
                    <div className="h-5 w-16 bg-surface rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-full bg-surface rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-surface rounded animate-pulse" />
                  <div className="flex items-center justify-between pt-3 border-t border-foreground/5 mt-2">
                    <div className="h-4 w-16 bg-surface rounded animate-pulse" />
                    <div className="h-8 w-24 bg-surface rounded animate-pulse" />
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
