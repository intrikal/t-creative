/**
 * Arrival — Full-viewport cinematic opening moment. Act I.
 *
 * The page opens in near-silence: deep espresso background, a single word.
 * As the user scrolls, the background warms from dark to ivory while the
 * word dissolves — creating an atmospheric transition into the brand world.
 *
 * Scroll behaviour:
 *   0 → 5%   background #2c2420, word fades in on mount
 *   5 → 55%  word fully visible
 *   55 → 85% word fades out + drifts upward
 *   70 → 100% background transitions to #faf6f1 (brand ivory)
 *
 * Client Component — uses Framer Motion scroll-driven transforms.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export function Arrival() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Background fades from espresso to ivory in the latter half of scroll
  const bg = useTransform(scrollYProgress, [0, 0.65, 1], ["#2c2420", "#2c2420", "#faf6f1"]);

  // Word visible through most of scroll, exits gracefully near the end
  const textOpacity = useTransform(scrollYProgress, [0.55, 0.88], [1, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);

  return (
    <motion.section
      ref={ref}
      style={{ backgroundColor: bg }}
      className="relative h-[180vh]"
      aria-label="Studio arrival"
    >
      {/* Visually hidden h1 — SEO brand name, not the decorative "Studio." */}
      <h1 className="sr-only">
        T Creative Studio — Lash Extensions, Permanent Jewelry, Custom Crochet &amp; Business
        Consulting in San Jose
      </h1>

      <div className="sticky top-0 h-screen flex items-center justify-center overflow-hidden">
        <motion.p
          style={{ opacity: textOpacity, y: textY }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="font-display text-[72px] sm:text-[100px] md:text-[132px] lg:text-[160px] font-light tracking-[0.05em] text-[#faf6f1] select-none leading-none"
          aria-hidden
        >
          Studio.
        </motion.p>
      </div>
    </motion.section>
  );
}
