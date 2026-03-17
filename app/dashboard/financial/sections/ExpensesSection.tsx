import { Suspense } from "react";
import { getExpenses } from "../actions";
import { ExpensesContent } from "./ExpensesContent";

function ExpensesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

async function ExpensesData() {
  const expenses = await getExpenses();
  return <ExpensesContent expenses={expenses} />;
}

export function ExpensesSection() {
  return (
    <Suspense fallback={<ExpensesSkeleton />}>
      <ExpensesData />
    </Suspense>
  );
}
