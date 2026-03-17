import { Suspense } from "react";
import { getPayments } from "../actions";
import { getBookingsForPayment } from "../payment-actions";
import { TransactionsContent } from "./TransactionsContent";

function TransactionsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-14 bg-surface rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

async function TransactionsData() {
  const [payments, bookingsForPayment] = await Promise.all([
    getPayments(),
    getBookingsForPayment(),
  ]);

  return <TransactionsContent payments={payments} bookingsForPayment={bookingsForPayment} />;
}

export function TransactionsSection() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionsData />
    </Suspense>
  );
}
