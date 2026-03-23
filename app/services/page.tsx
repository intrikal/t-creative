/**
 * Services — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { getPublishedServices } from "./actions";
import { ServicesPage } from "./ServicesPage";

export const metadata: Metadata = {
  title: "Services | Lash Extensions, Permanent Jewelry & More | T Creative Studio",
  description:
    "Handcrafted services in San Jose. Lash extensions starting at $150, permanent jewelry starting at $65, custom crochet commissions, and business consulting.",
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title: "Services | Lash Extensions, Permanent Jewelry & More | T Creative Studio",
    description:
      "Handcrafted services in San Jose. Lash extensions starting at $150, permanent jewelry starting at $65, custom crochet commissions, and business consulting.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Services | Lash Extensions, Permanent Jewelry & More | T Creative Studio",
    description:
      "Handcrafted services in San Jose. Lash extensions starting at $150, permanent jewelry starting at $65, custom crochet commissions, and business consulting.",
  },
};

function buildServicesJsonLd(
  services: Awaited<ReturnType<typeof getPublishedServices>>,
  bizName: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${bizName} Services`,
    url: `${SITE_URL}/services`,
    itemListElement: services.map((service, index) => {
      let priceSpec: Record<string, unknown> | undefined;
      if (service.priceInCents) {
        priceSpec = {
          "@type": "PriceSpecification",
          price: service.priceInCents / 100,
          priceCurrency: "USD",
        };
      } else if (service.priceMinInCents && service.priceMaxInCents) {
        priceSpec = {
          "@type": "PriceSpecification",
          minPrice: service.priceMinInCents / 100,
          maxPrice: service.priceMaxInCents / 100,
          priceCurrency: "USD",
        };
      } else if (service.priceMinInCents) {
        priceSpec = {
          "@type": "PriceSpecification",
          minPrice: service.priceMinInCents / 100,
          priceCurrency: "USD",
        };
      }

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Service",
          name: service.name,
          ...(service.description && { description: service.description }),
          serviceType: service.category,
          provider: { "@type": "LocalBusiness", name: bizName, url: SITE_URL },
          areaServed: {
            "@type": "City",
            name: "San Jose",
            containedInPlace: { "@type": "State", name: "California" },
          },
          ...(priceSpec && { offers: { "@type": "Offer", priceSpecification: priceSpec } }),
          ...(service.durationMinutes && { duration: `PT${service.durationMinutes}M` }),
        },
      };
    }),
  };
}

export default async function Page() {
  const [services, { business, content }] = await Promise.all([
    getPublishedServices(),
    getSiteData(),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildServicesJsonLd(services, business.businessName)),
        }}
      />
      <ServicesPage
        services={services}
        businessName={business.businessName}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
