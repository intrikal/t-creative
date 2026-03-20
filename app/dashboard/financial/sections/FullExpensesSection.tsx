import { Suspense } from "react";
import {
  getExpenses,
  getExpenseStats,
  getMonthlyExpenses,
  getExpenseCategoryBreakdown,
} from "../actions";
import { ExpensesPage } from "../../expenses/ExpensesPage";

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
  const [expenses, stats, monthlyExpenses, expenseCategories] = await Promise.all([
    getExpenses(),
    getExpenseStats(),
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
