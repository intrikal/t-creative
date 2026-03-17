import { Suspense } from "react";
import { getInvoices } from "../actions";
import { InvoicesContent } from "./InvoicesContent";

function InvoicesSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

async function InvoicesData() {
  const invoices = await getInvoices();
  return <InvoicesContent invoices={invoices} />;
}

export function InvoicesSection() {
  return (
    <Suspense fallback={<InvoicesSkeleton />}>
      <InvoicesData />
    </Suspense>
  );
}
