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

import dynamic from "next/dynamic";
import { and, avg, count, countDistinct, desc, eq, gte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { CallToAction } from "@/components/landing/CallToAction";
import { Events } from "@/components/landing/Events";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
import { Stats } from "@/components/landing/Stats";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { StudioDiorama } from "@/components/landing/StudioDiorama";
import { TrustBar } from "@/components/landing/TrustBar";

function SectionSkeleton() {
  return <div className="w-full animate-pulse bg-warm-cream/40" style={{ minHeight: "20rem" }} />;
}

const EditorialPortfolio = dynamic(
  () => import("@/components/landing/EditorialPortfolio").then((m) => m.EditorialPortfolio),
  { loading: () => <SectionSkeleton /> },
);
const InstagramFeed = dynamic(
  () => import("@/components/landing/InstagramFeed").then((m) => m.InstagramFeed),
  { loading: () => <SectionSkeleton /> },
);
const Testimonials = dynamic(
  () => import("@/components/landing/Testimonials").then((m) => m.Testimonials),
  { loading: () => <SectionSkeleton /> },
);
const TrainingTeaser = dynamic(
  () => import("@/components/landing/TrainingTeaser").then((m) => m.TrainingTeaser),
  { loading: () => <SectionSkeleton /> },
);
const FeaturedProducts = dynamic(
  () => import("@/components/landing/FeaturedProducts").then((m) => m.FeaturedProducts),
  { loading: () => <SectionSkeleton /> },
);
import { db } from "@/db";
import { bookings, instagramPosts, profiles, reviews, services } from "@/db/schema";
import { getFeaturedReviews } from "@/lib/public-reviews";
import { SITE_URL } from "@/lib/site-config";
import { getSiteData } from "@/lib/site-data";

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
      url: SITE_URL,
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

function buildEventServicesJsonLd(bizName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${bizName} Event Services`,
    url: `${SITE_URL}/#events`,
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
          provider: { "@type": "LocalBusiness", name: bizName, url: SITE_URL },
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
          provider: { "@type": "LocalBusiness", name: bizName, url: SITE_URL },
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
          provider: { "@type": "LocalBusiness", name: bizName, url: SITE_URL },
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
          provider: { "@type": "LocalBusiness", name: bizName, url: SITE_URL },
          audience: { "@type": "Audience", audienceType: "Groups of 10 or more" },
          areaServed: { "@type": "State", name: "California" },
        },
      },
    ],
  };
}

async function computeLiveStats() {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [clientCountResult, ratingResult, servicesCountResult, rebookingResult] = await Promise.all(
    [
      // Total clients
      db.select({ count: count() }).from(profiles).where(eq(profiles.role, "client")),

      // Average rating across approved reviews
      db
        .select({ avg: avg(reviews.rating) })
        .from(reviews)
        .where(eq(reviews.status, "approved")),

      // Active service count
      db.select({ count: count() }).from(services).where(eq(services.isActive, true)),

      // Rebooking rate: % of clients with 2+ completed bookings in the last 90 days.
      // Two queries: total unique clients who booked, and those who booked 2+.
      Promise.all([
        db
          .select({ count: countDistinct(bookings.clientId) })
          .from(bookings)
          .where(and(eq(bookings.status, "completed"), gte(bookings.startsAt, ninetyDaysAgo))),
        db
          .select({ clientId: bookings.clientId })
          .from(bookings)
          .where(and(eq(bookings.status, "completed"), gte(bookings.startsAt, ninetyDaysAgo)))
          .groupBy(bookings.clientId)
          .having(sql`count(*) >= 2`),
      ]),
    ],
  );

  const clientCount = clientCountResult[0]?.count ?? 0;
  const avgRatingRaw = ratingResult[0]?.avg;
  const servicesCount = servicesCountResult[0]?.count ?? 0;

  const [totalClientsResult, rebookersResult] = rebookingResult;
  const totalClients = totalClientsResult[0]?.count ?? 0;
  const rebookers = rebookersResult.length;
  const rebookingPct = totalClients > 0 ? Math.round((rebookers / totalClients) * 100) : 0;

  const avgRating = avgRatingRaw != null ? Number(Number(avgRatingRaw).toFixed(1)) : null;

  return {
    clientsServed: String(clientCount),
    averageRating: avgRating != null ? String(avgRating) : null,
    rebookingRate: `${rebookingPct}%`,
    servicesCount: String(servicesCount),
  };
}

export default async function Home() {
  const [{ business, content, policies }, featuredReviews, liveStats] = await Promise.all([
    getSiteData(),
    getFeaturedReviews(),
    computeLiveStats().catch(() => null),
  ]);

  const statsOverrides = content.statsOverrides ?? {};
  const statsProps = {
    clientsServed: statsOverrides.clientsServed ?? liveStats?.clientsServed ?? "500+",
    averageRating: statsOverrides.averageRating ?? liveStats?.averageRating ?? "4.9",
    rebookingRate: statsOverrides.rebookingRate ?? liveStats?.rebookingRate ?? "98%",
    servicesCount: statsOverrides.servicesCount ?? liveStats?.servicesCount ?? "4",
  };

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
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildEventServicesJsonLd(business.businessName)),
        }}
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
        <Stats {...statsProps} />
        <EditorialPortfolio />
        <Events eventDescriptions={content.eventDescriptions} />
        <TrainingTeaser />
        <FeaturedProducts />
        <InstagramFeed posts={igPostsSerialized} />
        <Testimonials reviews={featuredReviews} />
        <FAQ entries={content.faqEntries} policies={policies} />
        <CallToAction />
        <Footer
          businessName={business.businessName}
          location={business.location}
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
