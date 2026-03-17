import { Suspense } from "react";
import { getClientSources, getClientLifetimeValues, getTopServices, type Range } from "../actions";
import { ClientLtvSection } from "../components/ClientLtvSection";
import { ServicesAndSources } from "../components/ServicesAndSources";

function ClientsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-64 bg-surface rounded-xl animate-pulse" />
      <div className="h-64 bg-surface rounded-xl animate-pulse" />
    </div>
  );
}

async function ClientsData({ range }: { range: Range }) {
  const [clientSources, clientLtv, topServices] = await Promise.all([
    getClientSources(),
    getClientLifetimeValues(),
    getTopServices(range),
  ]);

  return (
    <>
      <ClientLtvSection clients={clientLtv} />
      <ServicesAndSources topServices={topServices} clientSources={clientSources} />
    </>
  );
}

export function ClientsSection({ range }: { range: Range }) {
  return (
    <Suspense fallback={<ClientsSkeleton />}>
      <ClientsData range={range} />
    </Suspense>
  );
}
