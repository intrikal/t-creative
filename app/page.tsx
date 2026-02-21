/**
 * Home — Landing page as a cinematic, narrative-driven experience.
 *
 * Page structure (Acts):
 *   I   Arrival           — Atmospheric dark opener; single word, scroll to warm
 *   II  Declaration       — Three words revealed sequentially; brand identity
 *   II.5 Founder          — Trini's editorial portrait and introduction
 *   III StudioPortal      — Scroll-pinned 3D interactive studio (300vh)
 *   IV  ZoneReveal        — Four business verticals as full-bleed editorial bands
 *   V   EditorialPortfolio — Asymmetric 3-column parallax grid
 *   V.5 FeaturedProducts  — Shop entry strip
 *   VI  Testimonials      — Single featured review with dot navigation
 *   VII TheInvitation     — Final CTA; full viewport, one headline
 *       Footer
 *
 * Studio overlays (StudioNav + ZoneOverlay) are rendered at root level so their
 * fixed positioning is never affected by a transform-based stacking context.
 *
 * Server Component — all sections are client components imported here.
 */

import { Arrival } from "@/components/landing/Arrival";
import { Declaration } from "@/components/landing/Declaration";
import { EditorialPortfolio } from "@/components/landing/EditorialPortfolio";
import { FeaturedProducts } from "@/components/landing/FeaturedProducts";
import { Footer } from "@/components/landing/Footer";
import { Founder } from "@/components/landing/Founder";
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
    </main>
  );
}
