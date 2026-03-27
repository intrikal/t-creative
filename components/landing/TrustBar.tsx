/**
 * TrustBar — Horizontal bar of social-proof points (location, client count, rating).
 *
 * Used on the landing page directly below the hero to establish credibility immediately.
 * Client Component — uses Framer Motion for staggered fade-in of each proof point.
 *
 * Props:
 * - location: optional city name; defaults to "San Jose" in the first proof point.
 */
"use client";

import { m } from "framer-motion";

export function TrustBar({ location }: { location?: string }) {
  // Four social-proof signals — ordered by geographic context → volume → quality → exclusivity.
  const proofPoints = [
    `${location ?? "San Jose"} & Bay Area`,
    "500+ Clients",
    "5-Star Rated",
    "By Appointment Only",
  ];
  return (
    <m.div
      className="py-6 px-6 bg-surface"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        {/* .map() renders each proof point with staggered fade-in (delay: 0.3 + i * 0.1).
            Array-driven to keep stagger timing uniform across all points. */}
        {proofPoints.map((point, i) => (
          <m.span
            key={point}
            className="text-xs tracking-widest uppercase text-muted"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
          >
            {/* Conditional render: dot separator only shown before items after the first (i > 0).
                Hidden on small screens via sm:inline since items stack vertically on mobile. */}
            {i > 0 && (
              <span className="mr-8 text-accent hidden sm:inline" aria-hidden>
                ·
              </span>
            )}
            {point}
          </m.span>
        ))}
      </div>
    </m.div>
  );
}
