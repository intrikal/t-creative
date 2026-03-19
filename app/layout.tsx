/**
 * RootLayout — Application shell shared across all routes.
 *
 * Responsibilities:
 * - Global metadata and OpenGraph defaults
 * - Font loading: Geist Sans (body) + Cormorant Garamond (display)
 * - Smooth scroll provider (Lenis)
 *- Skip link for keyboard accessibility (WCAG 2.4.1)
 * - Global navigation bar
 * - Server Component — no "use client" directive
 */

import { Geist, Cormorant_Garamond } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { ConditionalNavbar } from "@/components/ConditionalNavbar";
import { NavbarWrapper } from "@/components/NavbarWrapper";
import { PostHogProvider } from "@/components/providers/PostHogProvider";
import { ServiceWorkerRegistration } from "@/components/providers/ServiceWorkerRegistration";
import { WebVitals } from "@/components/providers/WebVitals";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { GrainOverlay } from "@/components/ui/GrainOverlay";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScrollProgress } from "@/components/ui/ScrollProgress";
import { getSiteData } from "@/lib/site-data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Cormorant Garamond — editorial display serif for headlines, quotes,
 * and large-format type. Used via the `font-display` Tailwind utility.
 */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const BASE_URL = "https://tcreativestudio.com";

export const viewport: Viewport = {
  themeColor: "#2c2420",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const { business, content } = await getSiteData();
  return {
    metadataBase: new URL(BASE_URL),
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: {
      canonical: "/",
    },
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: business.businessName,
    },
    openGraph: {
      title: business.businessName,
      description: content.seoDescription,
      type: "website",
      siteName: business.businessName,
    },
    twitter: {
      card: "summary_large_image",
      title: business.businessName,
      description: content.seoDescription,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { business, content } = await getSiteData();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.businessName,
    description: content.seoDescription,
    url: BASE_URL,
    email: business.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: business.location.split(",")[0]?.trim() ?? "San Jose",
      addressRegion: business.location.split(",")[1]?.trim() ?? "CA",
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
    sameAs: content.socialLinks.map((s) => s.url),
  };

  return (
    <html lang="en" className={`${geistSans.variable} ${cormorant.variable}`}>
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
        <ServiceWorkerRegistration />
        <WebVitals />
        <PostHogProvider>
          <LoadingScreen />
          <GrainOverlay />
          <ScrollProgress />
          <ConditionalNavbar>
            <NavbarWrapper />
          </ConditionalNavbar>
          <SmoothScroll>{children}</SmoothScroll>
        </PostHogProvider>
      </body>
    </html>
  );
}
