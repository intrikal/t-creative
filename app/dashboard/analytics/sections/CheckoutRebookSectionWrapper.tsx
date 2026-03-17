import { Suspense } from "react";
import { getCheckoutRebookRate } from "../actions";
import { CheckoutRebookSection } from "../components/CheckoutRebookSection";

function CheckoutRebookSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function CheckoutRebookData() {
  const data = await getCheckoutRebookRate();
  return <CheckoutRebookSection data={data} />;
}

export function CheckoutRebookSectionWrapper() {
  return (
    <Suspense fallback={<CheckoutRebookSkeleton />}>
      <CheckoutRebookData />
    </Suspense>
  );
}
