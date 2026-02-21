/**
 * Training — Live certification programs with upcoming dates and CTAs.
 *
 * Client Component — links to the full /training page.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";

const programs = [
  {
    title: "Classic Lash Certification",
    color: "#C4907A",
    format: "In Person",
    nextDate: "Mar 15, 2026",
    price: "Starting at $1,800",
    description:
      "Master classic lash application, lash mapping, and client consultation. Includes hands-on practice and a take-home kit.",
  },
  {
    title: "Volume Lash Certification",
    color: "#b07d6a",
    format: "In Person",
    nextDate: "Apr 5, 2026",
    price: "Starting at $2,200",
    description:
      "Advanced volume and mega-volume techniques built on a solid classic foundation. 2D–6D fan construction, retention, and business fundamentals.",
  },
  {
    title: "Permanent Jewelry Certification",
    color: "#D4A574",
    format: "In Person",
    nextDate: "Mar 8, 2026",
    price: "Starting at $1,200",
    description:
      "Learn welding technique, chain selection, sizing, and application. Perfect for those adding permanent jewelry to their service menu.",
  },
  {
    title: "Beauty Business Bootcamp",
    color: "#5B8A8A",
    format: "Hybrid",
    nextDate: "Mar 29, 2026",
    price: "Starting at $450",
    description:
      "Pricing, client systems, social media, and the operational side of running a beauty business — from someone who built one.",
  },
];

export function Training() {
  return (
    <SectionWrapper id="training" className="py-32 md:py-48 px-6 bg-surface">
      <div className="mx-auto max-w-5xl">
        <motion.div
          className="mb-16 md:mb-20 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
            Training Programs
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground">
            Learn from an expert.
          </h2>
          <p className="mt-4 text-muted text-base max-w-lg mx-auto">
            Certification-based programs taught with the same rigor they&apos;re practiced.
            Studio-standard. Not a course — a professional formation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programs.map((program, i) => (
            <motion.div
              key={program.title}
              className="border border-foreground/8 p-6 flex flex-col gap-3 hover:border-foreground/20 transition-colors duration-200"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: program.color }}
                />
                <h3 className="text-sm font-medium text-foreground">{program.title}</h3>
              </div>
              <p className="text-xs text-muted leading-relaxed flex-1">{program.description}</p>
              <div className="flex items-center justify-between pt-3 border-t border-foreground/5 flex-wrap gap-2">
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{program.nextDate}</span>
                  <span className="opacity-40">·</span>
                  <span>{program.format}</span>
                </div>
                <span className="text-xs font-medium text-accent">{program.price}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-10 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/training"
            className="text-sm tracking-widest uppercase text-accent hover:text-foreground transition-colors duration-300 border-b border-accent/40 pb-1"
          >
            View All Programs & Enroll
          </Link>
        </motion.div>
      </div>
    </SectionWrapper>
  );
}
