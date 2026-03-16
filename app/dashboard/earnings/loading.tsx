/**
 * Dashboard loading skeleton — displayed during route transitions within the dashboard.
 */
export default function Loading() {
  return (
    <div className="p-6 md:p-8">
      <div className="h-4 w-32 bg-surface rounded animate-pulse mb-6" />
      <div className="h-8 w-64 bg-surface rounded animate-pulse mb-6" />
      <div className="h-4 w-48 bg-surface rounded animate-pulse" />
    </div>
  );
}
