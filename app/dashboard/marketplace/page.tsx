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
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getServicesForSelect } from "@/app/dashboard/bookings/select-actions";
import { getProducts, getSupplies, getMarketplaceStats } from "./actions";
import { MarketplacePage } from "./MarketplacePage";

export const metadata: Metadata = {
  title: "Marketplace — T Creative Studio",
  description: "Browse and manage studio products, supplies, and marketplace listings.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "admin") redirect("/dashboard");

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
