/**
 * Privacy Policy — Server Component route wrapper with metadata.
 *
 * Fetches the current published privacy policy from the database so
 * Trini can update the content from the admin dashboard without a
 * code deploy. Falls back to empty state if no published document exists.
 */
import type { Metadata } from "next";
import { getLegalDocument } from "@/lib/legal-queries";
import { PrivacyPage } from "./PrivacyPage";

const BASE_URL = "https://tcreativestudio.com";

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Privacy Policy | T Creative Studio",
  url: `${BASE_URL}/privacy`,
  description:
    "Privacy Policy for T Creative Studio. Learn how we collect, use, and protect your personal information.",
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Privacy Policy", item: `${BASE_URL}/privacy` },
    ],
  },
};

export const metadata: Metadata = {
  title: "Privacy Policy | T Creative Studio",
  description:
    "Privacy Policy for T Creative Studio. Learn how we collect, use, and protect your personal information in compliance with CCPA and applicable California law.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | T Creative Studio",
    description:
      "Privacy Policy for T Creative Studio. Learn how we collect, use, and protect your personal information.",
  },
  twitter: {
    card: "summary",
    title: "Privacy Policy | T Creative Studio",
    description:
      "Privacy Policy for T Creative Studio. Learn how we collect, use, and protect your personal information.",
  },
};

export default async function Page() {
  const doc = await getLegalDocument("privacy_policy");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <PrivacyPage
        effectiveDate={doc?.effectiveDate ?? null}
        intro={doc?.intro ?? null}
        sections={doc?.sections ?? []}
      />
    </>
  );
}
