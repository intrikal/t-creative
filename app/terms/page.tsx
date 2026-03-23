/**
 * Terms of Service — Server Component route wrapper with metadata.
 *
 * Fetches the current published terms of service from the database so
 * Trini can update the content from the admin dashboard without a
 * code deploy. Falls back to empty state if no published document exists.
 */
import type { Metadata } from "next";
import { getLegalDocument } from "@/lib/legal-queries";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { TermsPage } from "./TermsPage";

const BASE_URL = SITE_URL;

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Terms of Service | T Creative Studio",
  url: `${BASE_URL}/terms`,
  description:
    "Terms of Service for T Creative Studio. Read our booking policies, service terms, and client agreement.",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Terms of Service", item: `${BASE_URL}/terms` },
    ],
  },
};

export const metadata: Metadata = {
  title: "Terms of Service | T Creative Studio",
  description:
    "Terms of Service for T Creative Studio. Read our booking policies, cancellation policy, health disclosures, payment terms, and client agreement.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | T Creative Studio",
    description:
      "Terms of Service for T Creative Studio. Read our booking policies, service terms, and client agreement.",
  },
  twitter: {
    card: "summary",
    title: "Terms of Service | T Creative Studio",
    description:
      "Terms of Service for T Creative Studio. Read our booking policies, service terms, and client agreement.",
  },
};

export default async function Page() {
  const [doc, { business, content }] = await Promise.all([
    getLegalDocument("terms_of_service"),
    getSiteData(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <TermsPage
        effectiveDate={doc?.effectiveDate ?? null}
        intro={doc?.intro ?? null}
        sections={doc?.sections ?? []}
        businessName={business.businessName}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
