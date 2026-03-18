import { Suspense } from "react";
import { getMembershipValue, type Range } from "../actions";
import { MembershipValueSection } from "../components/MembershipValueSection";

function MembershipValueSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function MembershipValueData({ range }: { range: Range }) {
  const data = await getMembershipValue(range);
  return <MembershipValueSection data={data} />;
}

export function MembershipValueSectionWrapper({ range }: { range: Range }) {
  return (
    <Suspense fallback={<MembershipValueSkeleton />}>
      <MembershipValueData range={range} />
    </Suspense>
  );
}
