/**
 * Loading skeleton — displayed during route transitions.
 */
export default function Loading() {
  return (
    <main className="min-h-screen bg-[#faf6f1] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 w-full max-w-lg space-y-4">
        <div className="h-6 w-48 bg-stone-100 rounded animate-pulse" />
        <div className="h-4 w-64 bg-stone-100 rounded animate-pulse" />
        <div className="h-px bg-stone-100 my-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-stone-100 rounded animate-pulse"
              style={{ width: `${80 + (i % 3) * 7}%` }}
            />
          ))}
        </div>
        <div className="h-24 w-full bg-stone-100 rounded-xl animate-pulse mt-4" />
        <div className="h-11 w-full bg-stone-100 rounded-lg animate-pulse" />
      </div>
    </main>
  );
}
