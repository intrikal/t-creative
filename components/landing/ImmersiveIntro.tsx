/**
 * ImmersiveIntro — Scroll-driven narrative section revealing the studio philosophy phrase by phrase.
 *
 * Used on the landing page between the hero and feature sections. Explains why the studio
 * is built as a unified platform rather than separate tools.
 * Client Component — uses Framer Motion scroll progress to animate background opacity and text reveals.
 *
 * No props — narrative content is static brand copy.
 */
"use client";

import { useRef } from "react";
import { m, useScroll, useTransform } from "framer-motion";

// Brand philosophy broken into sequential phrases — each reveals independently on scroll.
// Array structure enables the .map() below to apply per-phrase stagger delays.
const phrases = [
  "Most studios separate the craft from the business.",
  "The appointment from the invoice. The portfolio from the product.",
  "The experience from the system that supports it.",
  "We refused.",
  "T Creative Studio is a single, continuous space —",
  "where beauty work, client relationships, scheduling, payments,",
  "messaging, and creative output live under one roof.",
  "Not bolted together. Designed together.",
];

export function ImmersiveIntro() {
  // useRef tracks the section DOM element so Framer Motion can measure its scroll position.
  const containerRef = useRef<HTMLDivElement>(null);

  // useScroll tracks how far this section has scrolled through the viewport.
  // offset: ["start end", "end start"] means progress goes 0→1 from when the section's
  // top enters the viewport bottom to when the section's bottom exits the viewport top.
  // This must run in an effect (via Framer internals) because it reads scroll position from the DOM.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // useTransform derives a reactive value from scrollYProgress: background fades in to 40%
  // opacity at midpoint, then fades back out — creating a subtle color wash while scrolling.
  const bgOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.4, 0]);

  return (
    <section ref={containerRef} className="relative py-32 md:py-48 px-6">
      {/* Background blend */}
      <m.div className="absolute inset-0 bg-accent-geo" style={{ opacity: bgOpacity }} />

      <div className="relative mx-auto max-w-3xl">
        {/* .map() over phrases to render each as a scroll-triggered paragraph.
            Stagger delay (i * 0.08) creates a cascading read-along effect.
            Ternary on phrase content applies bold styling to key emphasis lines
            ("We refused." and "Not bolted together.") to create narrative punctuation. */}
        {phrases.map((phrase, i) => (
          <m.p
            key={i}
            className={`text-xl md:text-2xl lg:text-3xl leading-relaxed mb-4 ${
              phrase === "We refused." || phrase === "Not bolted together. Designed together."
                ? "font-medium text-foreground mt-8"
                : "text-muted"
            }`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              duration: 0.7,
              delay: i * 0.08,
              ease: "easeOut",
            }}
          >
            {phrase}
          </m.p>
        ))}
      </div>
    </section>
  );
}
