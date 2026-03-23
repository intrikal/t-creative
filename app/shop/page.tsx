import type { Metadata } from "next";
import { getSiteData } from "@/lib/site-data";
import { PublicShopPage } from "./PublicShopPage";
import { getPublishedProducts } from "./queries";

export const metadata: Metadata = {
  title: "Shop | Aftercare Products & Studio Merch | T Creative Studio",
  description:
    "Aftercare products, permanent jewelry, and studio merch from T Creative Studio in San Jose, CA.",
  alternates: {
    canonical: "/shop",
  },
  openGraph: {
    title: "Shop | Aftercare Products & Studio Merch | T Creative Studio",
    description:
      "Aftercare products, permanent jewelry, and studio merch from T Creative Studio in San Jose, CA.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop | Aftercare Products & Studio Merch | T Creative Studio",
    description:
      "Aftercare products, permanent jewelry, and studio merch from T Creative Studio in San Jose, CA.",
  },
};

const BASE_URL = "https://tcreativestudio.com";

const AVAILABILITY_MAP: Record<string, string> = {
  in_stock: "https://schema.org/InStock",
  made_to_order: "https://schema.org/MadeToOrder",
  pre_order: "https://schema.org/PreOrder",
  out_of_stock: "https://schema.org/OutOfStock",
};

function buildShopJsonLd(products: Awaited<ReturnType<typeof getPublishedProducts>>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "T Creative Studio Shop",
    url: `${BASE_URL}/shop`,
    itemListElement: products.map((product, index) => {
      let offer: Record<string, unknown> | undefined;
      const availability = AVAILABILITY_MAP[product.availability] ?? "https://schema.org/InStock";

      if (product.pricingType === "fixed_price" && product.priceInCents) {
        offer = {
          "@type": "Offer",
          price: (product.priceInCents / 100).toFixed(2),
          priceCurrency: "USD",
          availability,
        };
      } else if (
        product.pricingType === "price_range" &&
        product.priceMinInCents &&
        product.priceMaxInCents
      ) {
        offer = {
          "@type": "AggregateOffer",
          lowPrice: (product.priceMinInCents / 100).toFixed(2),
          highPrice: (product.priceMaxInCents / 100).toFixed(2),
          priceCurrency: "USD",
          availability,
        };
      } else if (product.pricingType === "starting_at" && product.priceMinInCents) {
        offer = {
          "@type": "Offer",
          price: (product.priceMinInCents / 100).toFixed(2),
          priceCurrency: "USD",
          availability,
        };
      }

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.title,
          url: `${BASE_URL}/shop/${product.slug}`,
          ...(product.description && { description: product.description }),
          ...(product.imageUrl && { image: product.imageUrl }),
          ...(product.tags.length > 0 && { keywords: product.tags.join(", ") }),
          brand: { "@type": "Brand", name: "T Creative Studio" },
          ...(offer && { offers: offer }),
        },
      };
    }),
  };
}

export default async function Page() {
  const [products, { business }] = await Promise.all([getPublishedProducts(), getSiteData()]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildShopJsonLd(products)) }}
      />
      <PublicShopPage
        products={products}
        businessName={business.businessName}
        location={business.location}
      />
    </>
  );
}
