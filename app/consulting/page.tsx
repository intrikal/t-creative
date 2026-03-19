/**
 * Consulting — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteData } from "@/lib/site-data";
import { ConsultingPage } from "./ConsultingPage";

export const revalidate = 86400;

const BASE_URL = "https://tcreativestudio.com";

const consultingJsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "T Creative Studio — HR & Business Consulting",
  url: `${BASE_URL}/consulting`,
  description:
    "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available.",
  serviceType: "Business Consulting",
  provider: {
    "@type": "Person",
    name: "Trini Lam",
    worksFor: { "@type": "Organization", name: "T Creative Studio", url: BASE_URL },
  },
  areaServed: { "@type": "Country", name: "United States" },
  availableChannel: {
    "@type": "ServiceChannel",
    serviceUrl: `${BASE_URL}/consulting`,
    availableLanguage: "en",
    serviceLocation: {
      "@type": "VirtualLocation",
      url: `${BASE_URL}/consulting`,
    },
  },
};

export const metadata: Metadata = {
  title: "HR & Business Consulting | Remote Consulting | T Creative Studio",
  description:
    "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available. Build better teams and scale your business.",
  alternates: {
    canonical: "/consulting",
  },
  openGraph: {
    title: "HR & Business Consulting | Remote Consulting | T Creative Studio",
    description:
      "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available. Build better teams and scale your business.",
  },
  twitter: {
    card: "summary_large_image",
    title: "HR & Business Consulting | Remote Consulting | T Creative Studio",
    description:
      "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available. Build better teams and scale your business.",
  },
};

export default async function Page() {
  const { business, content } = await getSiteData();

  if (!content.showConsultingPage) notFound();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(consultingJsonLd) }}
      />
      <ConsultingPage
        services={content.consultingServices}
        benefits={content.consultingBenefits}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
