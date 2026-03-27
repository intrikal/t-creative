/**
 * Contact — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { ContactPage } from "./ContactPage";

export const metadata: Metadata = {
  title: "Contact | T Creative Studio",
  description:
    "Get in touch with T Creative Studio. Book an appointment, request a consultation, or ask about our services in San Jose and the Bay Area.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact | T Creative Studio",
    description:
      "Get in touch with T Creative Studio. Book an appointment, request a consultation, or ask about our services in San Jose and the Bay Area.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | T Creative Studio",
    description:
      "Get in touch with T Creative Studio. Book an appointment, request a consultation, or ask about our services in San Jose and the Bay Area.",
  },
};

function buildContactJsonLd(business: {
  businessName: string;
  email: string;
  phone: string;
  location: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `Contact ${business.businessName}`,
    url: `${SITE_URL}/contact`,
    mainEntity: {
      "@type": "LocalBusiness",
      name: business.businessName,
      url: SITE_URL,
      ...(business.email && { email: business.email }),
      ...(business.phone && { telephone: business.phone }),
      ...(business.location && {
        address: {
          "@type": "PostalAddress",
          addressLocality: business.location,
          addressRegion: "CA",
          addressCountry: "US",
        },
      }),
    },
  };
}

export default async function Page() {
  const { business, content } = await getSiteData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildContactJsonLd(business)),
        }}
      />
      <ContactPage
        businessName={business.businessName}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
        interests={content.contactInterests}
        faqEntries={content.contactFaqEntries}
      />
    </>
  );
}
