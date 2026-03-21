/**
 * Home — Landing page for T Creative Studio.
 *
 * Page structure:
 *   Hero             — Headline, tagline, dual CTAs, founder photo
 *   TrustBar         — Social proof strip (location, clients, rating)
 *   Services         — Four service zones with pricing and CTAs
 *   HowItWorks       — Three-step booking process
 *   StudioDiorama    — Interactive isometric 3D studio (drag to rotate)
 *   Stats            — Key metrics (clients, rating, rebooking, services)
 *   Portfolio        — Filterable work gallery with loupe interaction
 *   Events           — Private parties, pop-ups, bridal, corporate
 *   TrainingTeaser   — Certification programs preview
 *   FeaturedProducts — Shop entry strip
 *   Testimonials     — Client review carousel
 *   FAQ              — Common questions accordion
 *   CallToAction     — Final conversion CTA
 *   Footer
 *
 * Server Component — all sections are client components imported here.
 */

import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { CallToAction } from "@/components/landing/CallToAction";
import { EditorialPortfolio } from "@/components/landing/EditorialPortfolio";
import { Events } from "@/components/landing/Events";
import { FAQ } from "@/components/landing/FAQ";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { InstagramFeed } from "@/components/landing/InstagramFeed";
import { Services } from "@/components/landing/Services";
import { Stats } from "@/components/landing/Stats";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { StudioDiorama } from "@/components/landing/StudioDiorama";
import { Testimonials } from "@/components/landing/Testimonials";
import { TrainingTeaser } from "@/components/landing/TrainingTeaser";
import { TrustBar } from "@/components/landing/TrustBar";
import { db } from "@/db";
import { instagramPosts } from "@/db/schema";
import { getFeaturedReviews } from "@/lib/public-reviews";
import { getSiteData } from "@/lib/site-data";

const BASE_URL = "https://tcreativestudio.com";

export async function generateMetadata(): Promise<Metadata> {
  const { business, content } = await getSiteData();
  return {
    title: business.businessName,
    description: content.seoDescription,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      title: business.businessName,
      description: content.seoDescription,
      url: BASE_URL,
      siteName: business.businessName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: business.businessName,
      description: content.seoDescription,
    },
  };
}

const eventServicesJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "T Creative Studio Event Services",
  url: `${BASE_URL}/#events`,
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      item: {
        "@type": "Service",
        name: "Private Lash Parties",
        description:
          "Book the studio for you and your group. Everyone gets lashed while you celebrate — birthdays, bachelorettes, girls' night.",
        serviceType: "Private Event",
        provider: { "@type": "LocalBusiness", name: "T Creative Studio", url: BASE_URL },
        areaServed: {
          "@type": "City",
          name: "San Jose",
          containedInPlace: { "@type": "State", name: "California" },
        },
        audience: { "@type": "Audience", audienceType: "Groups up to 6 guests" },
      },
    },
    {
      "@type": "ListItem",
      position: 2,
      item: {
        "@type": "Service",
        name: "Pop-Up Events",
        description:
          "Permanent jewelry welding at your venue, market, or storefront. Full setup provided — we bring the studio to you.",
        serviceType: "Pop-Up Event",
        provider: { "@type": "LocalBusiness", name: "T Creative Studio", url: BASE_URL },
        areaServed: { "@type": "State", name: "California" },
      },
    },
    {
      "@type": "ListItem",
      position: 3,
      item: {
        "@type": "Service",
        name: "Bridal & Wedding Services",
        description:
          "Day-of lash services and permanent jewelry for the bridal party. Coordinated scheduling so everyone is ready on time.",
        serviceType: "Bridal Event",
        provider: { "@type": "LocalBusiness", name: "T Creative Studio", url: BASE_URL },
        areaServed: {
          "@type": "City",
          name: "San Jose",
          containedInPlace: { "@type": "State", name: "California" },
        },
      },
    },
    {
      "@type": "ListItem",
      position: 4,
      item: {
        "@type": "Service",
        name: "Corporate & Team Events",
        description:
          "Team bonding with permanent jewelry or beauty services. Great for offsites, retreats, and company milestones.",
        serviceType: "Corporate Event",
        provider: { "@type": "LocalBusiness", name: "T Creative Studio", url: BASE_URL },
        audience: { "@type": "Audience", audienceType: "Groups of 10 or more" },
        areaServed: { "@type": "State", name: "California" },
      },
    },
  ],
};

export default async function Home() {
  const [{ business, content, policies }, featuredReviews] = await Promise.all([
    getSiteData(),
    getFeaturedReviews(),
  ]);

  // Fetch cached Instagram posts (non-blocking — empty array if table is empty)
  const igPosts = await db
    .select({
      id: instagramPosts.id,
      igMediaId: instagramPosts.igMediaId,
      igUsername: instagramPosts.igUsername,
      mediaType: instagramPosts.mediaType,
      mediaUrl: instagramPosts.mediaUrl,
      thumbnailUrl: instagramPosts.thumbnailUrl,
      permalink: instagramPosts.permalink,
      caption: instagramPosts.caption,
      postedAt: instagramPosts.postedAt,
    })
    .from(instagramPosts)
    .where(eq(instagramPosts.isVisible, true))
    .orderBy(desc(instagramPosts.postedAt))
    .limit(8)
    .catch(() => []);

  const igPostsSerialized = igPosts.map((p) => ({
    ...p,
    postedAt: p.postedAt.toISOString(),
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventServicesJsonLd) }}
      />
      <main id="main-content">
        <Hero
          headline={content.heroHeadline}
          subheadline={content.heroSubheadline}
          ctaText={content.heroCtaText}
        />
        <TrustBar />
        <Services />
        <HowItWorks />
        <StudioDiorama />
        <Stats />
        <EditorialPortfolio />
        <Events eventDescriptions={content.eventDescriptions} />
        <TrainingTeaser />
        <FeaturedProducts />
        <InstagramFeed posts={igPostsSerialized} />
        <Testimonials reviews={featuredReviews} />
        <FAQ entries={content.faqEntries} policies={policies} />
        <CallToAction />
        <Footer
          email={business.email}
          tagline={content.footerTagline}
          socialLinks={content.socialLinks}
        />

        {/* Sticky mobile booking CTA */}
        <StickyMobileCTA />
        <ChatWidgetLoader />
      </main>
    </>
  );
}
