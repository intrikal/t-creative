import { Suspense } from "react";
import { ReferralStatsSection } from "../components/ReferralStatsSection";
import { getReferralStats } from "../referral-actions";

function ReferralStatsSkeleton() {
  return <div className="h-48 bg-surface rounded-xl animate-pulse" />;
}

async function ReferralStatsData() {
  const data = await getReferralStats();
  return <ReferralStatsSection data={data} />;
}

export function ReferralStatsSectionWrapper() {
  return (
    <Suspense fallback={<ReferralStatsSkeleton />}>
      <ReferralStatsData />
    </Suspense>
  );
}
