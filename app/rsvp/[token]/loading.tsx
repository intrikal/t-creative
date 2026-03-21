/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="border border-foreground/8 rounded-2xl p-8 space-y-4">
          <div className="h-6 w-48 bg-surface rounded animate-pulse" />
          <div className="h-4 w-64 bg-surface rounded animate-pulse" />
          <div className="h-px bg-surface my-4" />
          <div className="space-y-2">
            <div className="h-4 w-full bg-surface rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-surface rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-surface rounded animate-pulse" />
          </div>
          <div className="h-11 w-full bg-surface rounded-lg animate-pulse mt-6" />
        </div>
      </div>
    </main>
  );
}
