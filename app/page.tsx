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

export default function Home() {
  return (
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
    </main>
  );
}
