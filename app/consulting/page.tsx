/**
 * Consulting — Server Component route wrapper with metadata.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { ConsultingPage } from "./ConsultingPage";

function buildConsultingJsonLd(bizName: string, ownerName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: `${bizName} — HR & Business Consulting`,
    url: `${SITE_URL}/consulting`,
    description:
      "Strategic HR and business consulting for entrepreneurs and growing companies. Remote consulting available.",
    serviceType: "Business Consulting",
    provider: {
      "@type": "Person",
      name: ownerName,
      worksFor: { "@type": "Organization", name: bizName, url: SITE_URL },
    },
    areaServed: { "@type": "Country", name: "United States" },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: `${SITE_URL}/consulting`,
      availableLanguage: "en",
      serviceLocation: {
        "@type": "VirtualLocation",
        url: `${SITE_URL}/consulting`,
      },
    },
  };
}

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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildConsultingJsonLd(business.businessName, business.owner)),
        }}
      />
      <ConsultingPage
        services={content.consultingServices}
        benefits={content.consultingBenefits}
        businessName={business.businessName}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
