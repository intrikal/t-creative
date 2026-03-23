import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { GiftCardPurchasePage } from "./GiftCardPurchasePage";

export const metadata: Metadata = {
  title: "Gift Cards — T Creative Studio",
  description:
    "Give the gift of lash extensions, permanent jewelry, crochet, or consulting. Gift cards valid for any service or product at T Creative Studio.",
  alternates: { canonical: "/shop/gift-cards" },
};

function buildGiftCardJsonLd(bizName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${bizName} Gift Card`,
    description:
      "Digital gift card redeemable for any service or product. Available in amounts from $25 to $500.",
    url: `${SITE_URL}/shop/gift-cards`,
    brand: { "@type": "Brand", name: bizName },
    category: "Gift Cards",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "25.00",
      highPrice: "500.00",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/shop/gift-cards`,
    },
  };
}

export default async function Page() {
  const { business } = await getSiteData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildGiftCardJsonLd(business.businessName)),
        }}
      />
      <GiftCardPurchasePage />
    </>
  );
}
