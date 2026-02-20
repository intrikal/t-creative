/**
 * LandingContent — Composes the full landing page from section components.
 *
 * Client Component — reads studio mode from Zustand to show/hide landing content.
 */
"use client";

import { motion } from "framer-motion";
import { useStudioStore } from "@/stores/useStudioStore";
import { CallToAction } from "./CallToAction";
import { Footer } from "./Footer";
import { Portfolio } from "./Portfolio";
import { Services } from "./Services";
import { Testimonials } from "./Testimonials";
import { Training } from "./Training";
import { TrustBar } from "./TrustBar";

export function LandingContent() {
  const mode = useStudioStore((s) => s.mode);
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
      <Testimonials />
      <Training />
      <CallToAction />
      <Footer />
    </motion.div>
  );
}
