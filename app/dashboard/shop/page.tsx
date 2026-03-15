import { redirect } from "next/navigation";
import { getPublishedProducts, getClientOrders, getWishlistProductIds } from "@/app/shop/actions";
import { getCurrentUser } from "@/lib/auth";
import { ClientShopPage } from "./ShopPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard/marketplace");

  const [products, orders, wishlistIds] = await Promise.all([
    getPublishedProducts(),
    getClientOrders(),
    getWishlistProductIds(),
  ]);

  return <ClientShopPage products={products} orders={orders} wishlistIds={wishlistIds} />;
}
