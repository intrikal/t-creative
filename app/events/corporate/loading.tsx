/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      <div className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="h-4 w-32 bg-surface rounded animate-pulse mb-6" />
          <div className="h-10 w-96 max-w-full bg-surface rounded animate-pulse mb-4" />
          <div className="h-4 w-64 bg-surface rounded animate-pulse mb-12" />
          <div className="grid md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-foreground/8 rounded-xl p-6 space-y-3">
                <div className="h-5 w-40 bg-surface rounded animate-pulse" />
                <div className="h-4 w-full bg-surface rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-surface rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
