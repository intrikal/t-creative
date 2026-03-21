/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 max-w-sm w-full">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-surface rounded animate-pulse mb-6" />
        <div className="h-11 w-full bg-surface rounded-lg animate-pulse" />
      </div>
    </main>
  );
}
