/**
 * About — Server Component route wrapper with metadata.
 */
import type { Metadata } from "next";
import { AboutPage } from "./AboutPage";

export const revalidate = 86400;

const BASE_URL = "https://tcreativestudio.com";

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Trini Lam",
  jobTitle: "Founder & Creative Director",
  worksFor: { "@type": "Organization", name: "T Creative Studio", url: BASE_URL },
  url: `${BASE_URL}/about`,
  knowsAbout: [
    "Lash Extensions",
    "Permanent Jewelry",
    "Custom Crochet",
    "Business Consulting",
    "HR Consulting",
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "San Jose",
    addressRegion: "CA",
    addressCountry: "US",
  },
  sameAs: ["https://www.instagram.com/tcreativestudio", "https://www.tiktok.com/@tcreativestudio"],
};

export const metadata: Metadata = {
  title: "About Trini Lam | T Creative Studio",
  description:
    "Meet Trini Lam — founder and creative director of T Creative Studio. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Trini Lam | T Creative Studio",
    description:
      "Meet Trini Lam — founder and creative director of T Creative Studio. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.",
  },
  twitter: {
    card: "summary_large_image",
    title: "About Trini Lam | T Creative Studio",
    description:
      "Meet Trini Lam — founder and creative director of T Creative Studio. A creative entrepreneur passionate about lash artistry, permanent jewelry, crochet, and business consulting in San Jose.",
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <AboutPage />
    </>
  );
}
