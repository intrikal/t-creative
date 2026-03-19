import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import {
  getExpenses,
  getExpenseStats,
  getMonthlyExpenses,
  getExpenseCategoryBreakdown,
} from "@/app/dashboard/financial/actions";
import { ExpensesPage } from "./ExpensesPage";

export const metadata: Metadata = {
  title: "Expenses — T Creative Studio",
  description: "Track and manage business expenses.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

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
    />
  );
}
