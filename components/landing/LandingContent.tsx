/**
 * LandingContent — Composes the full landing page from section components.
 *
 * Orchestrator component rendered by the landing page. When the user enters the 3D studio
 * (mode !== "landing"), the entire content area fades out and becomes non-interactive,
 * allowing the 3D scene to take over the viewport.
 * Client Component — reads studio mode from Zustand to show/hide landing content.
 *
 * No props — section composition and order are fixed.
 */
"use client";

import { motion } from "framer-motion";
import { useStudioStore } from "@/stores/useStudioStore";
import { CallToAction } from "./CallToAction";
import { FeaturedProducts } from "./FeaturedProducts";
import { Footer } from "./Footer";
import { Portfolio } from "./Portfolio";
import { Services } from "./Services";
import { Testimonials } from "./Testimonials";
import { Training } from "./Training";
import { TrustBar } from "./TrustBar";

export function LandingContent() {
  // Selector reads only the mode field from the Zustand store — avoids re-renders
  // when other store fields (activeZone, isTransitioning) change.
  const mode = useStudioStore((s) => s.mode);

  // Derived boolean: when the user has entered the 3D studio, all landing sections
  // should be invisible and non-interactive to avoid competing with the 3D overlay.
  const isHidden = mode !== "landing";

  return (
    <motion.div
      animate={{
        opacity: isHidden ? 0 : 1,
        pointerEvents: isHidden ? "none" : "auto",
      }}
      transition={{ duration: 0.5 }}
      aria-hidden={isHidden}
    >
      <TrustBar />
      <Services />
      <Portfolio />
      <FeaturedProducts />
      <Testimonials />
      <Training />
      <CallToAction />
      <Footer />
    </motion.div>
  );
}
