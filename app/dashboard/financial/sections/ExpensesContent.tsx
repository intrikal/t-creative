"use client";

import { useState } from "react";
import type { ExpenseRow } from "../actions";
import { ExpensesTab } from "../components/ExpensesTab";
import { FinancialModals } from "../components/FinancialModals";

export function ExpensesContent({ expenses }: { expenses: ExpenseRow[] }) {
  const [modal, setModal] = useState<"expense" | null>(null);

  return (
    <>
      <ExpensesTab expenses={expenses} onLogExpense={() => setModal("expense")} />
      <FinancialModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
