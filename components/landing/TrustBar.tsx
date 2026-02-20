/**
 * TrustBar — Horizontal bar of social-proof points (location, client count, rating).
 *
 * Client Component — uses Framer Motion for staggered fade-in of each proof point.
 */
"use client";

import { motion } from "framer-motion";

const proofPoints = ["San Jose & Bay Area", "500+ Clients", "5-Star Rated", "By Appointment Only"];

export function TrustBar() {
  return (
    <motion.div
      className="py-6 px-6 bg-surface"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay: 0.2 }}
    >
      <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-center gap-x-8 gap-y-2">
        {proofPoints.map((point, i) => (
          <motion.span
            key={point}
            className="text-xs tracking-widest uppercase text-muted"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
          >
            {i > 0 && (
              <span className="mr-8 text-accent hidden sm:inline" aria-hidden>
                ·
              </span>
            )}
            {point}
          </motion.span>
        ))}
      </div>
    </motion.div>
  );
}
