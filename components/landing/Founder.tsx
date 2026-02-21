/**
 * Founder — Trini's editorial introduction. Between Acts II and III.
 *
 * After the Declaration establishes brand values, this section grounds them
 * in a person. Two-column layout: portrait left, identity right.
 *
 * The photo uses a rectangular editorial crop (not circular) so it reads
 * as a portrait sitting, not a profile badge. On mobile the portrait leads
 * and the text follows below.
 *
 * Copy is intentionally minimal — the Declaration already did the heavy
 * lifting. This is just: who she is, in a single breath.
 *
 * Client Component — Framer Motion whileInView entrance.
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export function Founder() {
  return (
    <section className="bg-background overflow-hidden" aria-label="Meet Trini">
      <div className="mx-auto max-w-6xl flex flex-col md:flex-row min-h-[80vh]">
        {/* Portrait — editorial rectangle, full column height */}
        <motion.div
          className="relative w-full md:w-[48%] min-h-[50vh] md:min-h-full overflow-hidden bg-surface"
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Image
            src="/images/trini.jpg"
            alt="Trini Lam — founder of T Creative Studio"
            fill
            className="object-cover object-top"
            sizes="(max-width: 768px) 100vw, 48vw"
          />
          {/* Subtle gradient at bottom for copy legibility on mobile overlap */}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/10 via-transparent to-transparent pointer-events-none" />
        </motion.div>

        {/* Identity copy */}
        <motion.div
          className="w-full md:w-[52%] flex flex-col justify-center px-8 md:px-16 lg:px-20 py-16 md:py-0"
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-6 block">
            The Founder
          </span>

          <h2 className="font-display text-5xl md:text-6xl lg:text-7xl font-light tracking-tight text-foreground leading-[1.05] mb-6">
            Trini Lam.
          </h2>

          {/* Thin rule */}
          <motion.div
            className="h-px bg-foreground/10 mb-8 origin-left"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />

          <p className="text-base text-muted leading-relaxed max-w-sm mb-4">
            Lash artist. Jeweler. Maker. Consultant.
          </p>
          <p className="text-sm text-muted leading-relaxed max-w-sm mb-10">
            Based in San Jose, Trini built T Creative Studio around a single idea: that precision
            and care — whether in lash placement or business infrastructure — produce work worth
            keeping.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground w-fit group"
            >
              <span className="nav-link-reveal pb-px">Book an Appointment</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-muted hover:text-foreground transition-colors duration-200 w-fit"
            >
              About Trini
            </Link>
          </div>

          {/* Trust proof — small, unobtrusive */}
          <div className="flex gap-6 mt-14 pt-8 border-t border-foreground/8">
            {["500+ Clients", "5-Star Rated", "San Jose & Bay Area"].map((point) => (
              <span key={point} className="text-[10px] tracking-[0.15em] uppercase text-muted/60">
                {point}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
