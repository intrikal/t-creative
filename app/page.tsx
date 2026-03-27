/**
 * Home — Landing page for T Creative Studio.
 *
 * Page structure:
 *   Hero             — Headline, tagline, dual CTAs, founder photo
 *   TrustBar         — Social proof strip (location, clients, rating)
 *   Services         — Four service zones with pricing and CTAs
 *   HowItWorks       — Three-step booking process
 *   StudioDiorama    — Interactive isometric 3D studio (drag to rotate)
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
import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { CallToAction } from "@/components/landing/CallToAction";
import { Events } from "@/components/landing/Events";
import { FAQ } from "@/components/landing/FAQ";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
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
import { bookings, instagramPosts, products, profiles, reviews, services } from "@/db/schema";
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

export default async function Home() {
  const [{ business, content, policies }, featuredReviews, featuredProductRows] = await Promise.all(
    [
      getSiteData(),
      getFeaturedReviews(),
      db
        .select({
          name: products.title,
          description: products.description,
          price_in_cents: products.priceInCents,
        })
        .from(products)
        .where(eq(products.isPublished, true))
        .orderBy(asc(products.sortOrder))
        .limit(5)
        .catch(() => []),
    ],
  );

  const featuredProducts =
    featuredProductRows.length > 0
      ? featuredProductRows.map((p) => ({
          name: p.name,
          desc: p.description ?? "",
          price: p.price_in_cents != null ? `$${(p.price_in_cents / 100).toFixed(0)}` : "",
        }))
      : undefined;

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
        <TrustBar location={business.location} />
        <Services />
        <HowItWorks />
        <StudioDiorama />
        <EditorialPortfolio />
        <Events eventDescriptions={content.eventDescriptions} />
        <TrainingTeaser />
        <FeaturedProducts products={featuredProducts} />
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
