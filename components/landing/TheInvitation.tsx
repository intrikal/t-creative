/**
 * TheInvitation — The final moment. Act VII.
 *
 * One headline. Two paths. Nothing else.
 *
 * The brand name sits behind the headline as an enormous watermark —
 * low opacity, display serif, so it reads as texture rather than text.
 * The blush background (#F0E0D6) is warm and final without being loud.
 *
 * Client Component — Framer Motion scroll-triggered entrance.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function TheInvitation() {
  return (
    <section
      id="booking"
      className="relative overflow-hidden bg-hover min-h-screen flex items-center justify-center px-6 py-32"
      aria-label="Book a session"
    >
      {/* Watermark — brand name as background texture */}
      <p
        className="absolute inset-0 flex items-center justify-center font-display text-[120px] sm:text-[180px] md:text-[240px] lg:text-[300px] font-light text-foreground/[0.04] leading-none select-none whitespace-nowrap pointer-events-none tracking-tight"
        aria-hidden
      >
        T Creative
      </p>

      <motion.div
        className="relative z-10 mx-auto max-w-2xl text-center"
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-8 block">Ready?</span>

        <h2 className="font-display text-5xl sm:text-6xl md:text-7xl font-light tracking-tight text-foreground mb-8 leading-[1.05]">
          The studio is open.
        </h2>

        <p className="text-sm text-muted leading-relaxed mb-14 max-w-md mx-auto">
          Whether you&apos;re booking your first appointment or building your next business system —
          there is a place here, already made for you.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-[0.2em] uppercase bg-foreground text-background hover:bg-foreground/85 transition-colors duration-300"
          >
            Book a Session
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center justify-center px-8 py-3.5 text-xs tracking-[0.2em] uppercase border border-foreground/20 text-foreground hover:border-foreground/50 transition-colors duration-300"
          >
            Explore the Ecosystem
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
