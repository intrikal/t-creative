import type { Metadata } from "next";
import { PublicShopPage } from "./PublicShopPage";

export const metadata: Metadata = {
  title: "Shop — T Creative Studio",
  description:
    "Aftercare products, permanent jewelry, and studio merch from T Creative Studio in San Jose, CA.",
  robots: { index: true, follow: true },
};

export default function Page() {
  return <PublicShopPage />;
}
