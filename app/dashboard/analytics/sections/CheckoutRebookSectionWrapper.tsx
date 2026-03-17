import { Suspense } from "react";
import { getCheckoutRebookRate, type Range } from "../actions";
import { CheckoutRebookSection } from "../components/CheckoutRebookSection";

function CheckoutRebookSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function CheckoutRebookData({ range }: { range: Range }) {
  const data = await getCheckoutRebookRate(range);
  return <CheckoutRebookSection data={data} />;
}

export function CheckoutRebookSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<CheckoutRebookSkeleton />}>
      <CheckoutRebookData range={range} />
    </Suspense>
  );
}
