/**
 * Home — Landing page as a cinematic, narrative-driven experience.
 *
 * Page structure (Acts):
 *   I   Arrival           — Atmospheric dark opener; single word, scroll to warm
 *   II  Declaration       — Three words revealed sequentially; brand identity
 *   II.5 Founder          — Trini's editorial portrait and introduction
 *   III StudioPortal      — Scroll-pinned 3D interactive studio (300vh)
 *   IV  ZoneReveal        — Four business verticals as full-bleed editorial bands
 *   IV.5 HowItWorks       — Three-step booking process with animated connectors
 *   V   EditorialPortfolio — Asymmetric 3-column parallax grid with category filters
 *   V.5 FeaturedProducts  — Shop entry strip
 *   VI  Testimonials      — Single featured review with auto-advance + dot navigation
 *   VII TheInvitation     — Final CTA; full viewport, magnetic button
 *       Footer
 *
 * Studio overlays (StudioNav + ZoneOverlay) are rendered at root level so their
 * fixed positioning is never affected by a transform-based stacking context.
 *
 * StickyMobileCTA renders a fixed bottom bar on mobile for persistent booking access.
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
import { ZoneReveal } from "@/components/landing/ZoneReveal";

export default function Home() {
  return (
    <main id="main-content">
      <Arrival />
      <Declaration />
      <Founder />
      <StudioPortal />
      <ZoneReveal />
      <HowItWorks />
      <EditorialPortfolio />
      <FeaturedProducts />
      <Testimonials />
      <TheInvitation />
      <Footer />

      {/*
       * Studio overlays — rendered outside all scroll containers.
       * StudioNav and ZoneOverlay are fixed-positioned and self-hide via
       * Zustand when mode === "landing".
       */}
      <StudioOverlays />

      {/* Sticky mobile booking CTA — appears after scroll, hides at final CTA */}
      <StickyMobileCTA />
    </main>
  );
}
