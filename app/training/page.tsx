/**
 * Training — Server Component route wrapper with metadata and ISR.
 */
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { getPublishedPrograms } from "./actions";
import { TrainingPage } from "./TrainingPage";

export const metadata: Metadata = {
  title: "Training Programs | Lash & Permanent Jewelry Certification | T Creative Studio",
  description:
    "Comprehensive lash extension and permanent jewelry certification programs. Learn from an expert in San Jose. In-person training starting at $1,200.",
  alternates: {
    canonical: "/training",
  },
  openGraph: {
    title: "Training Programs | Lash & Permanent Jewelry Certification | T Creative Studio",
    description:
      "Comprehensive lash extension and permanent jewelry certification programs. Learn from an expert in San Jose. In-person training starting at $1,200.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Training Programs | Lash & Permanent Jewelry Certification | T Creative Studio",
    description:
      "Comprehensive lash extension and permanent jewelry certification programs. Learn from an expert in San Jose. In-person training starting at $1,200.",
  },
};

const BASE_URL = SITE_URL;

const FORMAT_MODE: Record<string, string> = {
  in_person: "onsite",
  online: "online",
  hybrid: "blended",
};

function buildTrainingJsonLd(
  programs: Awaited<ReturnType<typeof getPublishedPrograms>>,
  bizName: string,
  ownerName: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${bizName} Training Programs`,
    url: `${BASE_URL}/training`,
    itemListElement: programs.map((program, index) => {
      const courseInstance: Record<string, unknown> = {
        "@type": "CourseInstance",
        courseMode: FORMAT_MODE[program.format] ?? "onsite",
        inLanguage: "en",
        instructor: {
          "@type": "Person",
          name: ownerName,
          worksFor: { "@type": "Organization", name: bizName },
        },
        ...(program.maxStudents && { maximumAttendeeCapacity: program.maxStudents }),
        ...(program.nextSession && {
          startDate: program.nextSession.startsAt,
          location: program.nextSession.location
            ? { "@type": "Place", name: program.nextSession.location }
            : {
                "@type": "Place",
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "San Jose",
                  addressRegion: "CA",
                  addressCountry: "US",
                },
              },
        }),
      };

      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Course",
          name: program.name,
          url: `${BASE_URL}/training#${program.slug}`,
          ...(program.description && { description: program.description }),
          provider: { "@type": "Organization", name: bizName, url: BASE_URL },
          ...(program.certificationProvided && {
            educationalCredentialAwarded: "Certificate of Completion",
          }),
          ...(program.curriculum.length > 0 && {
            syllabusSections: program.curriculum.map((item) => ({
              "@type": "Syllabus",
              name: item,
            })),
          }),
          ...(program.durationHours && { timeRequired: `PT${program.durationHours}H` }),
          ...(program.durationDays &&
            !program.durationHours && { timeRequired: `P${program.durationDays}D` }),
          ...(program.priceInCents && {
            offers: {
              "@type": "Offer",
              price: (program.priceInCents / 100).toFixed(2),
              priceCurrency: "USD",
              availability: "https://schema.org/InStock",
              url: `${BASE_URL}/training#${program.slug}`,
            },
          }),
          hasCourseInstance: courseInstance,
        },
      };
    }),
  };
}

export default async function Page() {
  const [programs, { business, content }] = await Promise.all([
    getPublishedPrograms(),
    getSiteData(),
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildTrainingJsonLd(programs, business.businessName, business.owner),
          ),
        }}
      />
      <TrainingPage
        programs={programs}
        businessName={business.businessName}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
