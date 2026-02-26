/**
 * Home — Landing page as a cinematic, narrative-driven experience.
 *
 * Page structure (Acts):
 *   I    Arrival            — Atmospheric dark opener; single word, scroll to warm
 *   II   Declaration        — Three words + typewriter thesis; brand identity
 *   II.5 Founder            — Trini's editorial portrait and introduction
 *        ─── SectionDivider (grid → organic morph)
 *   III  StudioPortal       — Scroll-pinned 3D interactive studio (300vh)
 *   IV   ZoneReveal         — Four transformation arcs (Raw → Process → Result)
 *   IV.5 HowItWorks         — Three-step booking process with animated connectors
 *   IV.6 TrainingTeaser     — Certification programs preview
 *        ─── SectionDivider
 *   V    EditorialPortfolio  — Asymmetric 3-column grid with loupe interaction
 *   V.5  FeaturedProducts    — Shop entry strip
 *   VI   Testimonials        — Full-bleed typographic with word-stagger transitions
 *   VII  TheInvitation       — Final CTA; ambient gradient, magnetic button
 *        Footer
 *
 * Server Component — all sections are client components imported here.
 */

import { Arrival } from "@/components/landing/Arrival";
import { Declaration } from "@/components/landing/Declaration";
import { EditorialPortfolio } from "@/components/landing/EditorialPortfolio";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { Footer } from "@/components/landing/Footer";
import { Founder } from "@/components/landing/Founder";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { StickyMobileCTA } from "@/components/landing/StickyMobileCTA";
import { StudioOverlays } from "@/components/landing/StudioOverlays";
import { StudioPortal } from "@/components/landing/StudioPortal";
import { Testimonials } from "@/components/landing/Testimonials";
import { TheInvitation } from "@/components/landing/TheInvitation";
import { TrainingTeaser } from "@/components/landing/TrainingTeaser";
import { ZoneReveal } from "@/components/landing/ZoneReveal";
import { SectionDivider } from "@/components/ui/SectionDivider";

export default function Home() {
  return (
    <main id="main-content">
      <Arrival />
      <Declaration />
      <Founder />

      {/* Grid-to-organic morphing transition — structure becoming beauty */}
      <SectionDivider className="bg-background" color="#6b5d52" />

      <StudioPortal />
      <ZoneReveal />
      <HowItWorks />
      <TrainingTeaser />

      {/* Second divider before the dark portfolio section */}
      <SectionDivider className="bg-background" color="#96604a" />

      <EditorialPortfolio />
      <FeaturedProducts />
      <Testimonials />
      <TheInvitation />
      <Footer />

      {/* Studio overlays — rendered outside all scroll containers */}
      <StudioOverlays />

      {/* Sticky mobile booking CTA */}
      <StickyMobileCTA />
    </main>
  );
}
