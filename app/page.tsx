/**
 * Home — Landing page for T Creative Studio.
 *
 * Page structure:
 *   Hero             — Headline, tagline, dual CTAs, founder photo
 *   TrustBar         — Social proof strip (location, clients, rating)
 *   Services         — Four service zones with pricing and CTAs
 *   HowItWorks       — Three-step booking process
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
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { SectionTransition } from "@/components/landing/SectionTransition";
import { Services } from "@/components/landing/Services";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";

// All below-fold sections are dynamically imported to keep the Hero fast.
// SectionSkeleton gives height so the page doesn't reflow when sections mount.
function SectionSkeleton() {
  return (
    <div className="w-full animate-pulse bg-foreground/[0.02]" style={{ minHeight: "20rem" }} />
  );
}

// Tall skeleton for pinned sections (Diorama = 400vh, Testimonials = variable)
function TallSkeleton() {
  return (
    <div className="w-full animate-pulse bg-foreground/[0.02]" style={{ minHeight: "100vh" }} />
  );
}

const StudioDiorama = dynamic(
  () => import("@/components/landing/StudioDiorama").then((m) => m.StudioDiorama),
  { loading: () => <TallSkeleton /> },
);
const EditorialPortfolio = dynamic(
  () => import("@/components/landing/EditorialPortfolio").then((m) => m.EditorialPortfolio),
  { loading: () => <TallSkeleton /> },
);
const Testimonials = dynamic(
  () => import("@/components/landing/Testimonials").then((m) => m.Testimonials),
  { loading: () => <SectionSkeleton /> },
);
const HowItWorks = dynamic(
  () => import("@/components/landing/HowItWorks").then((m) => m.HowItWorks),
  { loading: () => <SectionSkeleton /> },
);
const Events = dynamic(() => import("@/components/landing/Events").then((m) => m.Events), {
  loading: () => <SectionSkeleton />,
});
const FAQ = dynamic(() => import("@/components/landing/FAQ").then((m) => m.FAQ), {
  loading: () => <SectionSkeleton />,
});
const TrainingTeaser = dynamic(
  () => import("@/components/landing/TrainingTeaser").then((m) => m.TrainingTeaser),
  { loading: () => <SectionSkeleton /> },
);
const FeaturedProducts = dynamic(
  () => import("@/components/landing/FeaturedProducts").then((m) => m.FeaturedProducts),
  { loading: () => <SectionSkeleton /> },
);
const InstagramFeed = dynamic(
  () => import("@/components/landing/InstagramFeed").then((m) => m.InstagramFeed),
  { loading: () => <SectionSkeleton /> },
);
const CallToAction = dynamic(
  () => import("@/components/landing/CallToAction").then((m) => m.CallToAction),
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
        {/* ── Act I: Hero — above fold, renders immediately ── */}
        <Hero
          headline={content.heroHeadline}
          subheadline={content.heroSubheadline}
          ctaText={content.heroCtaText}
        />

        {/* ── Act II: Services — 2×2 grid cards, bleeds into Diorama ── */}
        <Services />

        {/* ── Act III: Diorama — pinned 3D studio tour (overlaps up into Services) ── */}
        <StudioDiorama />

        {/* background → dark: gradient transition */}
        <SectionTransition from="background" to="foreground" />

        {/* ── Act IV: Portfolio — dark horizontal scrub ── */}
        <EditorialPortfolio />

        {/* dark → light: gradient transition */}
        <SectionTransition from="foreground" to="background" />

        {/* ── Act V: Testimonials — dual-row marquee ── */}
        <Testimonials reviews={featuredReviews} />

        {/* ── Act VI: Book CTA ── */}
        <CallToAction />

        {/* ── Supporting sections ── */}
        <HowItWorks />

        {/* background → dark: gradient transition */}
        <SectionTransition from="background" to="foreground" />
        <Events eventDescriptions={content.eventDescriptions} />

        {/* dark → light: gradient transition */}
        <SectionTransition from="foreground" to="surface" />
        <TrainingTeaser />
        <FeaturedProducts products={featuredProducts} />
        <InstagramFeed posts={igPostsSerialized} />
        <FAQ entries={content.faqEntries} policies={policies} />

        <Footer
          businessName={business.businessName}
          location={business.location}
          email={business.email}
          tagline={content.footerTagline}
          socialLinks={content.socialLinks}
        />

        <StickyMobileCTA />
        <ChatWidgetLoader />
      </main>
    </>
  );
}
