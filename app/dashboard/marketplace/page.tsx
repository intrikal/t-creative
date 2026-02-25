/**
 * Marketplace dashboard route — `/dashboard/marketplace`.
 *
 * Server Component that fetches products, supplies, and stats
 * then passes them to the `<MarketplacePage>` Client Component.
 *
 * @module marketplace/page
 * @see {@link ./actions.ts} — server actions
 * @see {@link ./MarketplacePage.tsx} — client component
 */
import { getServicesForSelect } from "@/app/dashboard/bookings/actions";
import { getProducts, getSupplies, getMarketplaceStats } from "./actions";
import { MarketplacePage } from "./MarketplacePage";

export default async function Page() {
  const [products, supplies, stats, services] = await Promise.all([
    getProducts(),
    getSupplies(),
    getMarketplaceStats(),
    getServicesForSelect(),
  ]);

  return (
    <MarketplacePage
      initialProducts={products}
      initialSupplies={supplies}
      stats={stats}
      serviceOptions={services.map((s) => ({ id: s.id, name: s.name }))}
    />
  );
}
