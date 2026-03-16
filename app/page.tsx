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

import { ChatWidgetLoader } from "@/components/chat/ChatWidgetLoader";
import { CallToAction } from "@/components/landing/CallToAction";
import { EditorialPortfolio } from "@/components/landing/EditorialPortfolio";
import { Events } from "@/components/landing/Events";
import { FAQ } from "@/components/landing/FAQ";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Services } from "@/components/landing/Services";
import { Stats } from "@/components/landing/Stats";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { StudioDiorama } from "@/components/landing/StudioDiorama";
import { Testimonials } from "@/components/landing/Testimonials";
import { TrainingTeaser } from "@/components/landing/TrainingTeaser";
import { TrustBar } from "@/components/landing/TrustBar";

const BASE_URL = "https://tcreativestudio.com";

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

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventServicesJsonLd) }}
      />
      <main id="main-content">
        <Hero />
        <TrustBar />
        <Services />
        <HowItWorks />
        <StudioDiorama />
        <Stats />
        <EditorialPortfolio />
        <Events />
        <TrainingTeaser />
        <FeaturedProducts />
        <Testimonials />
        <FAQ />
        <CallToAction />
        <Footer />

        {/* Sticky mobile booking CTA */}
        <StickyMobileCTA />
        <ChatWidgetLoader />
      </main>
    </>
  );
}
