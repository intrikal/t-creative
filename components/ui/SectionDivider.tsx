/**
 * SectionDivider — Grid-to-organic SVG morphing transition.
 *
 * A precise geometric grid morphs into an organic flowing form as
 * it crosses the viewport. This single animation IS the brand:
 * structure becoming beauty.
 *
 * Uses two SVG paths and interpolates between them based on scroll progress.
 *
 * Client Component — Framer Motion useScroll.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

// Grid path — structured, angular
const GRID_PATH =
  "M0,50 L10,50 L10,30 L20,30 L20,50 L30,50 L30,20 L40,20 L40,50 L50,50 L50,10 L60,10 L60,50 L70,50 L70,25 L80,25 L80,50 L90,50 L90,35 L100,35";

// Organic path — flowing, curved
const ORGANIC_PATH =
  "M0,50 C5,45 10,30 15,35 C20,40 25,20 30,25 C35,30 40,15 45,20 C50,25 55,10 60,15 C65,20 70,25 75,20 C80,15 85,30 90,25 C95,20 98,35 100,35";

interface SectionDividerProps {
  className?: string;
  color?: string;
}

export function SectionDivider({ className = "", color = "currentColor" }: SectionDividerProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // Morph progress: 0 = grid, 1 = organic
  const morphProgress = useTransform(scrollYProgress, [0.2, 0.8], [0, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 0.6, 0.6, 0]);

  // Scale the divider line drawing
  const pathLength = useTransform(scrollYProgress, [0.1, 0.5], [0, 1]);

  return (
    <div ref={ref} className={`relative py-8 overflow-hidden ${className}`} aria-hidden>
      <motion.svg
        className="w-full h-16 md:h-20"
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        fill="none"
        style={{ opacity }}
      >
        {/* Grid path — fades out */}
        <motion.path
          d={GRID_PATH}
          stroke={color}
          strokeWidth="0.3"
          strokeLinecap="round"
          fill="none"
          style={{
            pathLength,
            opacity: useTransform(morphProgress, [0, 1], [1, 0]),
          }}
        />

        {/* Organic path — fades in */}
        <motion.path
          d={ORGANIC_PATH}
          stroke={color}
          strokeWidth="0.3"
          strokeLinecap="round"
          fill="none"
          style={{
            pathLength,
            opacity: useTransform(morphProgress, [0, 1], [0, 1]),
          }}
        />
      </motion.svg>
    </div>
  );
}
