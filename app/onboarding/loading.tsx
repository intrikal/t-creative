/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 max-w-md w-full">
        <div className="h-8 w-48 bg-surface rounded animate-pulse mb-2" />
        <div className="h-4 w-72 bg-surface rounded animate-pulse mb-6" />
        <div className="h-48 w-full bg-surface rounded-xl animate-pulse" />
      </div>
    </main>
  );
}
