/**
 * TrainingTeaser — Certification programs teaser. Between HowItWorks and Portfolio.
 *
 * Showcases Trini as an educator, not just a practitioner. This section adds
 * authority and reveals a major revenue stream (training programs $450–$2,200).
 *
 * Client Component — Framer Motion whileInView entrance.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const PROGRAMS = [
  {
    title: "Classic Lash Certification",
    duration: "2 weekends · 16 hours",
    price: "From $1,800",
    color: "#C4907A",
  },
  {
    title: "Volume Lash Certification",
    duration: "3 weekends · 24 hours",
    price: "From $2,200",
    color: "#C4907A",
  },
  {
    title: "Permanent Jewelry Certification",
    duration: "1 day · 8 hours",
    price: "From $1,200",
    color: "#D4A574",
  },
  {
    title: "Beauty Business Bootcamp",
    duration: "3 sessions · 18 hours",
    price: "From $450",
    color: "#5B8A8A",
  },
];

export function TrainingTeaser() {
  return (
    <section className="bg-surface py-28 md:py-40 px-6" aria-label="Training programs">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          className="mb-16 md:mb-20"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-5 block">
            Education
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground leading-[1.1] mb-4">
            She teaches it too.
          </h2>
          <p className="text-sm text-muted leading-relaxed max-w-lg">
            Certification programs for lash artists, jewelry welders, and beauty entrepreneurs. The
            same precision Trini applies to her work — now available as structured curriculum.
          </p>
        </motion.div>

        {/* Program cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {PROGRAMS.map((program, i) => (
            <motion.div
              key={program.title}
              className="border border-foreground/8 p-6 md:p-8 hover:border-foreground/20 transition-all duration-300 group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: program.color }} />
                <span className="text-[10px] tracking-[0.2em] uppercase text-muted">
                  {program.duration}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground mb-2 group-hover:text-accent transition-colors duration-200">
                {program.title}
              </h3>
              <p className="text-sm text-accent font-medium">{program.price}</p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/training"
            className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground group"
          >
            <span className="nav-link-reveal pb-px">View All Programs</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
