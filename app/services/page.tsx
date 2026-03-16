/**
 * Services — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { getPublishedServices } from "./actions";
import { ServicesPage } from "./ServicesPage";

export const revalidate = 3600;

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

const BASE_URL = "https://tcreativestudio.com";

function buildServicesJsonLd(services: Awaited<ReturnType<typeof getPublishedServices>>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "T Creative Studio Services",
    url: `${BASE_URL}/services`,
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
          provider: { "@type": "LocalBusiness", name: "T Creative Studio", url: BASE_URL },
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
  const services = await getPublishedServices();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildServicesJsonLd(services)) }}
      />
      <ServicesPage services={services} />
    </>
  );
}
