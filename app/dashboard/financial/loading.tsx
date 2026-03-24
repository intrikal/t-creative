/**
 * Financial page loading skeleton — matches the real layout (header + stat cards + charts + tabs).
 */
export default function Loading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-surface rounded animate-pulse" />
          <div className="h-4 w-64 bg-surface rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 bg-surface rounded-lg animate-pulse" />
          <div className="flex gap-1">
            <div className="h-8 w-12 bg-surface rounded-lg animate-pulse" />
            <div className="h-8 w-12 bg-surface rounded-lg animate-pulse" />
            <div className="h-8 w-12 bg-surface rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl px-4 py-3 animate-pulse">
            <div className="space-y-2">
              <div className="h-2.5 w-20 bg-surface rounded" />
              <div className="h-5 w-16 bg-surface rounded" />
              <div className="h-2.5 w-24 bg-surface rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 h-64 bg-card border border-border rounded-xl animate-pulse" />
        <div className="xl:col-span-2 h-64 bg-card border border-border rounded-xl animate-pulse" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {["Revenue", "Transactions", "Invoices", "Expenses", "Gift Cards", "Promotions"].map(
          (t) => (
            <div key={t} className="px-4 py-2.5">
              <div className="h-4 w-16 bg-surface rounded animate-pulse" />
            </div>
          ),
        )}
      </div>
    </div>
  );
}
