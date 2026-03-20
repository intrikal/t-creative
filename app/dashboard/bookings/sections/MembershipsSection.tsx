import { Suspense } from "react";
import { getMembershipPlans, getMemberships } from "../../memberships/actions";
import { getSubscriptions } from "../../subscriptions/actions";
import { getClientsForSelect, getServicesForSelect } from "../select-actions";
import { MembershipsPage } from "../../memberships/MembershipsPage";
import { SubscriptionsPage } from "../../subscriptions/SubscriptionsPage";

function MembershipsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-9 w-28 bg-surface rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-48 bg-surface rounded-xl animate-pulse" />
    </div>
  );
}

async function MembershipsData() {
  const [memberships, plans, clients, subscriptions, allServices] = await Promise.all([
    getMemberships(),
    getMembershipPlans(true),
    getClientsForSelect(),
    getSubscriptions(),
    getServicesForSelect(),
  ]);

  const serviceOptions = allServices.map((s) => ({
    id: s.id,
    name: s.name,
    priceInCents: s.priceInCents,
  }));

  return (
    <MembershipsPage
      initialMemberships={memberships}
      plans={plans}
      clients={clients}
      sessionPacksContent={
        <SubscriptionsPage
          initialSubscriptions={subscriptions}
          clients={clients}
          serviceOptions={serviceOptions}
          embedded
        />
      }
      embedded
    />
  );
}

export function MembershipsSection() {
  return (
    <Suspense fallback={<MembershipsSkeleton />}>
      <MembershipsData />
    </Suspense>
  );
}
