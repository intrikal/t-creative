"use client";

import { useState } from "react";
import type { InvoiceRow } from "../actions";
import { FinancialModals } from "../components/FinancialModals";
import { InvoicesTab } from "../components/InvoicesTab";

export function InvoicesContent({ invoices }: { invoices: InvoiceRow[] }) {
  const [modal, setModal] = useState<"invoice" | null>(null);

  return (
    <>
      <InvoicesTab invoices={invoices} onNewInvoice={() => setModal("invoice")} />
      <FinancialModals modal={modal} onClose={() => setModal(null)} />
    </>
  );
}
