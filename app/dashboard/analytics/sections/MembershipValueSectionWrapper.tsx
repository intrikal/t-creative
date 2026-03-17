import { Suspense } from "react";
import { getMembershipValue } from "../actions";
import { MembershipValueSection } from "../components/MembershipValueSection";

function MembershipValueSkeleton() {
  return <div className="h-64 bg-surface rounded-xl animate-pulse" />;
}

async function MembershipValueData() {
  const data = await getMembershipValue();
  return <MembershipValueSection data={data} />;
}

export function MembershipValueSectionWrapper() {
  return (
    <Suspense fallback={<MembershipValueSkeleton />}>
      <MembershipValueData />
    </Suspense>
  );
}
