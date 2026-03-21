/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 max-w-sm w-full">
        <div className="w-12 h-12 rounded-full bg-surface animate-pulse" />
        <div className="h-6 w-48 bg-surface rounded animate-pulse" />
        <div className="h-4 w-64 bg-surface rounded animate-pulse" />
      </div>
    </main>
  );
}
