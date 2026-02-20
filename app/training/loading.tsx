/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main id="main-content" className="pt-16">
      <div className="py-24 md:py-32 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="h-4 w-32 bg-surface rounded animate-pulse mb-6" />
          <div className="h-10 w-96 max-w-full bg-surface rounded animate-pulse mb-6" />
          <div className="h-4 w-64 bg-surface rounded animate-pulse" />
        </div>
      </div>
    </main>
  );
}
