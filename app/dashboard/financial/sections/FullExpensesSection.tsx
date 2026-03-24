import { Suspense } from "react";
import { ExpensesPage } from "../../expenses/ExpensesPage";
import {
  getExpenses,
  getExpenseStats,
  getMonthlyExpenses,
  getExpenseCategoryBreakdown,
} from "../actions";

function ExpensesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-surface rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-surface rounded-xl animate-pulse" />
    </div>
  );
}

async function ExpensesData() {
  // Sequential to reduce connection pool pressure — all sections stream independently via Suspense.
  const expenses = await getExpenses();
  const stats = await getExpenseStats();
  const [monthlyExpenses, expenseCategories] = await Promise.all([
    getMonthlyExpenses(),
    getExpenseCategoryBreakdown(),
  ]);

  return (
    <ExpensesPage
      expenses={expenses}
      stats={stats}
      monthlyExpenses={monthlyExpenses}
      expenseCategories={expenseCategories}
      embedded
    />
  );
}

export function FullExpensesSection() {
  return (
    <Suspense fallback={<ExpensesSkeleton />}>
      <ExpensesData />
    </Suspense>
  );
}
