import { Suspense } from "react";
import { getClientSources, getClientLifetimeValues, getTopServices } from "../actions";
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

async function ClientsData() {
  const [clientSources, clientLtv, topServices] = await Promise.all([
    getClientSources(),
    getClientLifetimeValues(),
    getTopServices(),
  ]);

  return (
    <>
      <ClientLtvSection clients={clientLtv} />
      <ServicesAndSources topServices={topServices} clientSources={clientSources} />
    </>
  );
}

export function ClientsSection() {
  return (
    <Suspense fallback={<ClientsSkeleton />}>
      <ClientsData />
    </Suspense>
  );
}
