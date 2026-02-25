import type { Metadata } from "next";
import { getPublishedProducts } from "./actions";
import { PublicShopPage } from "./PublicShopPage";

export const metadata: Metadata = {
  title: "Shop — T Creative Studio",
  description:
    "Aftercare products, permanent jewelry, and studio merch from T Creative Studio in San Jose, CA.",
  robots: { index: true, follow: true },
};

export default async function Page() {
  const products = await getPublishedProducts();
  return <PublicShopPage products={products} />;
}
