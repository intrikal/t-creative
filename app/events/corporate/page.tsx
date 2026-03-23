/**
 * Corporate Events — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { CorporateInquiryForm } from "./CorporateInquiryForm";

export const metadata: Metadata = {
  title: "Corporate Events | T Creative Studio",
  description:
    "Elevate your next team event with T Creative Studio. We bring permanent jewelry and lash services directly to your corporate office or offsite — perfect for team bonding, celebrations, and company milestones.",
  alternates: {
    canonical: "/events/corporate",
  },
  openGraph: {
    title: "Corporate Events | T Creative Studio",
    description:
      "Elevate your next team event with T Creative Studio. We bring permanent jewelry and lash services directly to your corporate office or offsite.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Corporate Events | T Creative Studio",
    description:
      "Elevate your next team event with T Creative Studio. We bring permanent jewelry and lash services directly to your corporate office or offsite.",
  },
};

function buildCorporateEventJsonLd(bizName: string, location: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `${bizName} Corporate Events`,
    description:
      "On-site permanent jewelry and lash extension services for corporate team bonding, offsites, celebrations, and milestones.",
    url: `${SITE_URL}/events/corporate`,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: {
      "@type": "Organization",
      name: bizName,
      url: SITE_URL,
    },
    ...(location && {
      location: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: location,
          addressRegion: "CA",
          addressCountry: "US",
        },
      },
    }),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/events/corporate`,
      availability: "https://schema.org/InStock",
      category: "Corporate Events",
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
          __html: JSON.stringify(
            buildCorporateEventJsonLd(business.businessName, business.location),
          ),
        }}
      />
      <CorporateInquiryForm />
    </>
  );
}
