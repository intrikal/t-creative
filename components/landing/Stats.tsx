/**
 * Stats — Key metrics strip for social proof.
 *
 * Client Component — uses Framer Motion for staggered number reveals.
 */
"use client";

import { motion } from "framer-motion";

const STATS = [
  { value: "500+", label: "Clients Served" },
  { value: "4.9", label: "Average Rating" },
  { value: "98%", label: "Rebooking Rate" },
  { value: "4", label: "Services Under One Roof" },
];

export function Stats() {
  return (
    <section className="py-20 md:py-28 px-6 bg-surface">
      <div className="mx-auto max-w-5xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
            >
              <p className="text-4xl md:text-5xl font-light tracking-tight text-accent mb-2">
                {stat.value}
              </p>
              <p className="text-xs tracking-widest uppercase text-muted">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
