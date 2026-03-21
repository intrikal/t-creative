/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      <div className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-3xl">
          <div className="h-4 w-32 bg-surface rounded animate-pulse mb-6" />
          <div className="h-10 w-72 max-w-full bg-surface rounded animate-pulse mb-4" />
          <div className="h-4 w-48 bg-surface rounded animate-pulse mb-12" />
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-4 bg-surface rounded animate-pulse"
                style={{ width: `${85 + (i % 3) * 5}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
