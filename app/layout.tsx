/**
 * RootLayout — Application shell shared across all routes.
 *
 * Responsibilities:
 * - Global metadata and OpenGraph defaults
 * - Font loading (Geist Sans via next/font)
 * - Skip link for keyboard accessibility (WCAG 2.4.1)
 * - Global navigation bar
 * - Server Component — no "use client" directive
 */

import { Geist } from "next/font/google";
import type { Metadata } from "next";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const BASE_URL = "https://tcreativestudio.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "T Creative Studio — Lash Extensions, Permanent Jewelry & More in San Jose",
  description:
    "Premium lash extensions, permanent jewelry, custom crochet commissions, and business consulting. Crafted with intention and care, serving San Jose and the Bay Area.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "T Creative Studio",
    description:
      "Premium beauty and creative services in San Jose. Lash extensions, permanent jewelry, custom crochet, and business consulting.",
    type: "website",
    siteName: "T Creative Studio",
  },
  twitter: {
    card: "summary_large_image",
    title: "T Creative Studio",
    description:
      "Premium beauty and creative services in San Jose. Lash extensions, permanent jewelry, custom crochet, and business consulting.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "T Creative Studio",
  description:
    "Premium lash extensions, permanent jewelry, custom crochet commissions, and business consulting in San Jose.",
  url: BASE_URL,
  email: "hello@tcreativestudio.com",
  address: {
    "@type": "PostalAddress",
    addressLocality: "San Jose",
    addressRegion: "CA",
    addressCountry: "US",
  },
  areaServed: {
    "@type": "GeoCircle",
    geoMidpoint: {
      "@type": "GeoCoordinates",
      latitude: 37.3382,
      longitude: -121.8863,
    },
    geoRadius: "50000",
  },
  sameAs: ["https://www.instagram.com/tcreativestudio", "https://www.tiktok.com/@tcreativestudio"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body className="bg-background text-foreground font-sans antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Skip link — first focusable element for keyboard users (WCAG 2.4.1) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-foreground focus:text-background focus:text-sm focus:tracking-wide"
        >
          Skip to main content
        </a>
        <NavbarWrapper />
        {children}
      </body>
    </html>
  );
}
