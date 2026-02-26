/**
 * ScrollProgress — Vertical progress indicator on the right edge of viewport.
 *
 * Fills with zone colors as you scroll through each section act,
 * communicating both progress and which discipline you're currently in.
 *
 * Client Component — Framer Motion useScroll.
 */
"use client";

import { motion, useScroll, useTransform } from "framer-motion";

/** Zone color segments mapped to approximate scroll positions */
const SEGMENTS = [
  { start: 0, end: 0.15, color: "#2c2420", label: "Arrival" },
  { start: 0.15, end: 0.28, color: "#6b5d52", label: "Declaration" },
  { start: 0.28, end: 0.38, color: "#96604a", label: "Founder" },
  { start: 0.38, end: 0.52, color: "#5B8A8A", label: "Studio" },
  { start: 0.52, end: 0.62, color: "#C4907A", label: "Lash" },
  { start: 0.62, end: 0.68, color: "#D4A574", label: "Jewelry" },
  { start: 0.68, end: 0.74, color: "#7BA3A3", label: "Craft" },
  { start: 0.74, end: 0.8, color: "#5B8A8A", label: "Consulting" },
  { start: 0.8, end: 0.9, color: "#2c2420", label: "Portfolio" },
  { start: 0.9, end: 1.0, color: "#96604a", label: "Invitation" },
];

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const height = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Determine current segment color
  const backgroundColor = useTransform(scrollYProgress, (v) => {
    const segment = SEGMENTS.find((s) => v >= s.start && v < s.end);
    return segment?.color ?? "#6b5d52";
  });

  return (
    <div className="fixed right-0 top-0 h-full w-[3px] z-[50] hidden md:block" aria-hidden>
      {/* Track */}
      <div className="absolute inset-0 bg-foreground/[0.04]" />

      {/* Fill */}
      <motion.div
        className="absolute top-0 left-0 right-0 origin-top"
        style={{ height, backgroundColor }}
      />
    </div>
  );
}
