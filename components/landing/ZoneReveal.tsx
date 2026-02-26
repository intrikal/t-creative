/**
 * ZoneReveal — Four business verticals as transformation-arc bands. Act IV.
 *
 * Each vertical follows the arc: Raw Material → Applied Structure → Transformed Outcome.
 * Bands are scroll-pinned horizontally — the three states slide left as the user
 * scrolls down, creating a sense of progression through a pipeline.
 *
 * Motion contrast: Raw→Process uses a mechanical spring (hard overshoot),
 * Process→Result uses an organic ease (slow settle). This contrast IS the brand:
 * mechanical precision producing organic beauty.
 *
 * Client Component — Framer Motion scroll-driven animations.
 */
"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ZONES, type ZoneId } from "@/lib/zones";

interface TransformationArc {
  id: ZoneId;
  raw: { label: string; text: string };
  process: { label: string; text: string };
  result: { label: string; text: string };
  stat: { value: string; label: string };
}

const ARCS: TransformationArc[] = [
  {
    id: "lash",
    raw: {
      label: "The Raw",
      text: "Natural lashes. Uneven. Sparse in places. Beautiful in potential.",
    },
    process: {
      label: "The Process",
      text: "Mapped. Isolated. Each extension placed at the exact angle for maximum retention and lift.",
    },
    result: {
      label: "The Result",
      text: "A gaze that doesn\u2019t need explanation.",
    },
    stat: { value: "500+", label: "lash sets completed" },
  },
  {
    id: "jewelry",
    raw: {
      label: "The Raw",
      text: "A spool of chain. 14k gold-filled or sterling silver. Cold metal, full of promise.",
    },
    process: {
      label: "The Process",
      text: "Measured to your wrist. Cut to size. Welded with a single, precise arc. No clasp. No removal.",
    },
    result: {
      label: "The Result",
      text: "Permanence on skin. A gesture that stays.",
    },
    stat: { value: "1,000+", label: "chains welded" },
  },
  {
    id: "crochet",
    raw: {
      label: "The Raw",
      text: "A spool of yarn. A reel of filament. Natural hair, ready for transformation.",
    },
    process: {
      label: "The Process",
      text: "Braided, looped, knotted. Or modeled, sliced, printed layer by layer. Box braids, goddess locs, bags, accessories \u2014 geometry made real.",
    },
    result: {
      label: "The Result",
      text: "Looks that turn heads. Objects that didn\u2019t exist before. All one-of-a-kind.",
    },
    stat: { value: "200+", label: "custom commissions" },
  },
  {
    id: "consulting",
    raw: {
      label: "The Raw",
      text: "A business running on memory and goodwill. Processes in someone\u2019s head. Nothing written down.",
    },
    process: {
      label: "The Process",
      text: "Documented. Systematized. Every process given a home. Every role given clarity.",
    },
    result: {
      label: "The Result",
      text: "A company that runs \u2014 even when you\u2019re not in the room.",
    },
    stat: { value: "50+", label: "businesses transformed" },
  },
];

function TransformationBand({ arc }: { arc: TransformationArc }) {
  const ref = useRef<HTMLDivElement>(null);
  const zone = ZONES[arc.id];

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Horizontal slide: 0% = Raw visible, 50% = Process, 100% = Result
  const slideX = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    ["0%", "-33.33%", "-66.66%", "-66.66%"],
  );

  // Phase opacities — each state fades in/out
  const rawOpacity = useTransform(scrollYProgress, [0, 0.1, 0.3, 0.4], [0.3, 1, 1, 0.2]);
  const processOpacity = useTransform(scrollYProgress, [0.25, 0.4, 0.6, 0.7], [0.2, 1, 1, 0.2]);
  const resultOpacity = useTransform(scrollYProgress, [0.55, 0.7, 1], [0.2, 1, 1]);

  // Progress bar for the transformation
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <div ref={ref} className="relative h-[250vh]">
      <div className="sticky top-0 h-screen overflow-hidden flex flex-col">
        {/* Zone header — fixed at top */}
        <div className="px-8 md:px-16 pt-8 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
            <span className="text-[10px] tracking-[0.3em] uppercase" style={{ color: zone.color }}>
              {zone.label}
            </span>
          </div>
          <span className="text-[10px] tracking-[0.2em] uppercase text-muted">
            {arc.stat.value} {arc.stat.label}
          </span>
        </div>

        {/* Transformation progress bar */}
        <div className="mx-8 md:mx-16 h-px bg-foreground/5 relative">
          <motion.div
            className="absolute inset-y-0 left-0 h-full"
            style={{ width: progressWidth, backgroundColor: zone.color, opacity: 0.4 }}
          />
        </div>

        {/* Sliding panels — three states side by side */}
        <motion.div className="flex-1 flex min-w-0" style={{ x: slideX }}>
          {/* Raw */}
          <motion.div
            className="w-screen shrink-0 flex items-center justify-center px-8 md:px-16 lg:px-24"
            style={{ opacity: rawOpacity }}
          >
            <div className="max-w-2xl w-full flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="shrink-0">
                <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-4 block">
                  {arc.raw.label}
                </span>
                <div
                  className="w-20 h-20 md:w-28 md:h-28 border-2 border-dashed flex items-center justify-center"
                  style={{ borderColor: `${zone.color}40` }}
                >
                  <div className="w-3 h-3 rounded-full bg-foreground/10" />
                </div>
              </div>
              <div>
                <h3 className="font-display text-3xl md:text-4xl lg:text-5xl font-light text-foreground leading-[1.15] mb-4 tracking-tight">
                  {zone.heading}
                </h3>
                <p className="text-base md:text-lg text-muted leading-relaxed max-w-md">
                  {arc.raw.text}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Process */}
          <motion.div
            className="w-screen shrink-0 flex items-center justify-center px-8 md:px-16 lg:px-24"
            style={{ opacity: processOpacity }}
          >
            <div className="max-w-2xl w-full flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="shrink-0">
                <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-4 block">
                  {arc.process.label}
                </span>
                <div
                  className="w-20 h-20 md:w-28 md:h-28 border-2 flex items-center justify-center relative"
                  style={{ borderColor: `${zone.color}60` }}
                >
                  {/* Grid lines — structure being applied */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <div key={i} className="border border-foreground/[0.04]" />
                    ))}
                  </div>
                  <div
                    className="w-3 h-3 rounded-full relative z-10"
                    style={{ backgroundColor: zone.color, opacity: 0.5 }}
                  />
                </div>
              </div>
              <div>
                <p className="text-base md:text-lg text-foreground/80 leading-relaxed max-w-md font-light">
                  {arc.process.text}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Result */}
          <motion.div
            className="w-screen shrink-0 flex items-center justify-center px-8 md:px-16 lg:px-24"
            style={{ opacity: resultOpacity }}
          >
            <div className="max-w-2xl w-full flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="shrink-0">
                <span className="text-[10px] tracking-[0.3em] uppercase text-muted mb-4 block">
                  {arc.result.label}
                </span>
                <div
                  className="w-20 h-20 md:w-28 md:h-28 flex items-center justify-center"
                  style={{ backgroundColor: `${zone.color}12` }}
                >
                  <div className="w-6 h-6 rounded-full" style={{ backgroundColor: zone.color }} />
                </div>
              </div>
              <div>
                <p className="font-display text-2xl md:text-3xl text-foreground italic leading-relaxed max-w-md">
                  {arc.result.text}
                </p>
                <Link
                  href={zone.cta.href}
                  className="inline-flex items-center gap-3 text-xs tracking-[0.2em] uppercase text-foreground group w-fit mt-8"
                >
                  <span className="nav-link-reveal pb-px">{zone.cta.label}</span>
                  <span className="transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

export function ZoneReveal() {
  return (
    <section aria-label="Services">
      {ARCS.map((arc) => (
        <TransformationBand key={arc.id} arc={arc} />
      ))}
    </section>
  );
}
