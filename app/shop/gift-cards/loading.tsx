/**
 * Gift cards page loading skeleton.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      <section className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="h-3 w-20 bg-surface rounded animate-pulse mx-auto mb-6" />
          <div className="h-10 w-72 max-w-full bg-surface rounded animate-pulse mx-auto mb-6" />
          <div className="h-4 w-96 max-w-full bg-surface rounded animate-pulse mx-auto mb-8" />
          {/* Gift card form skeleton */}
          <div className="space-y-4 max-w-md mx-auto text-left">
            <div className="h-10 w-full bg-surface rounded animate-pulse" />
            <div className="h-10 w-full bg-surface rounded animate-pulse" />
            <div className="h-10 w-full bg-surface rounded animate-pulse" />
            <div className="h-12 w-full bg-surface rounded animate-pulse mt-6" />
          </div>
        </div>
      </section>
    </main>
  );
}
