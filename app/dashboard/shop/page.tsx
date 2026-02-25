import { redirect } from "next/navigation";
import { getPublishedProducts, getClientOrders } from "@/app/shop/actions";
import { getCurrentUser } from "@/lib/auth";
import { ClientShopPage } from "./ShopPage";

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile?.role !== "client") redirect("/dashboard/marketplace");

  const [products, orders] = await Promise.all([getPublishedProducts(), getClientOrders()]);

  return <ClientShopPage products={products} orders={orders} />;
}
