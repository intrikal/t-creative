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
import { m, useScroll, useTransform } from "framer-motion";

export function Arrival() {
  // useRef tracks the section element so Framer Motion can measure its scroll position.
  const ref = useRef<HTMLElement>(null);

  // useScroll provides 0→1 progress from when the section's top hits the viewport top
  // to when the section's bottom reaches the viewport top. offset: ["start start", "end start"]
  // means the animation is scoped to the section pinning range. Cannot run during render
  // because it subscribes to DOM scroll events.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // useTransform: background color holds dark (#2c2420) for the first 65% of scroll,
  // then transitions to ivory (#faf6f1) — creating the atmosphere-to-brand-world transition.
  const bg = useTransform(scrollYProgress, [0, 0.65, 1], ["#2c2420", "#2c2420", "#faf6f1"]);

  // useTransform: the "Studio." word stays visible through 55% of scroll, then fades out
  // by 88% — giving the user time to absorb it before the next section.
  const textOpacity = useTransform(scrollYProgress, [0.55, 0.88], [1, 0]);
  // Subtle upward drift (-10%) as the user scrolls, adding a sense of departure.
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);

  return (
    <m.section
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
        <m.p
          style={{ opacity: textOpacity, y: textY }}
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: [1, 1.015, 1] }}
          transition={{
            opacity: { duration: 1.4, ease: [0.16, 1, 0.3, 1] },
            scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          }}
          className="font-display text-[72px] sm:text-[100px] md:text-[132px] lg:text-[160px] font-light tracking-[0.05em] text-[#faf6f1] select-none leading-none"
          aria-hidden
        >
          Studio.
        </m.p>
      </div>
    </m.section>
  );
}
