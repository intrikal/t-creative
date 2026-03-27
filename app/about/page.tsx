/**
 * About — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";
import { AboutPage } from "./AboutPage";

export async function generateMetadata(): Promise<Metadata> {
  const { business } = await getSiteData();
  const title = `About ${business.owner} | ${business.businessName}`;
  const description = `Meet ${business.owner} — founder and creative director of ${business.businessName}. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.`;

  return {
    title,
    description,
    alternates: { canonical: "/about" },
    openGraph: { title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function Page() {
  const { business, content } = await getSiteData();

  const socialUrls = content.socialLinks.filter((l) => l.url).map((l) => l.url);

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: business.owner,
    jobTitle: "Founder & Creative Director",
    worksFor: { "@type": "Organization", name: business.businessName, url: SITE_URL },
    url: `${SITE_URL}/about`,
    knowsAbout: [
      "Lash Extensions",
      "Permanent Jewelry",
      "Custom Crochet",
      "Business Consulting",
      "HR Consulting",
    ],
    address: {
      "@type": "PostalAddress",
      addressLocality: business.location || "San Jose",
      addressRegion: "CA",
      addressCountry: "US",
    },
    ...(socialUrls.length > 0 ? { sameAs: socialUrls } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <AboutPage
        ownerName={business.owner}
        businessName={business.businessName}
        bio={content.aboutBio}
        mission={content.aboutMission}
        credentials={content.aboutCredentials}
        timeline={content.aboutTimeline}
        certifications={content.aboutCertifications}
        testimonials={content.aboutTestimonials}
        location={business.location}
        email={business.email}
        footerTagline={content.footerTagline}
        socialLinks={content.socialLinks}
      />
    </>
  );
}
