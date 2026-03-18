import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getClientCommissions } from "@/app/dashboard/commissions/actions";
import { getPublishedProducts, getClientOrders, getWishlistProductIds } from "@/app/shop/actions";
import { getCurrentUser } from "@/lib/auth";
import { ClientShopPage } from "./ShopPage";

export const metadata: Metadata = {
  title: "Shop — T Creative Studio",
  description: "Browse and purchase studio products and merchandise.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard/marketplace");

  const [products, orders, wishlistIds, commissions] = await Promise.all([
    getPublishedProducts(),
    getClientOrders(),
    getWishlistProductIds(),
    getClientCommissions(),
  ]);

  return (
    <ClientShopPage
      products={products}
      orders={orders}
      wishlistIds={wishlistIds}
      commissions={commissions}
    />
  );
}
