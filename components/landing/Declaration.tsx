/**
 * Declaration — Brand identity statement in monumental display type. Act II.
 *
 * Three words scroll into view sequentially. Each word is accompanied by a
 * hairline rule that grows from left to right as the word appears, then
 * the rule stays and the word dissolves as the next word takes its place.
 * The third word and a one-sentence brand summary persist through the
 * end of the section.
 *
 * Scroll choreography (section height: 160vh):
 *   0  → 22%  "Precision."  (in: 0–12%, visible: 12–22%, out: 22–34%)
 *   28 → 55%  "Craft."      (in: 28–38%, visible: 38–55%, out: 55–68%)
 *   62 → 100% "Transform."  (in: 62–74%, stays visible, summary fades in at 80%)
 *
 * Client Component — scroll-driven via Framer Motion useScroll.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";

interface WordRevealProps {
  word: string;
  opacity: MotionValue<number>;
  y: MotionValue<string>;
  lineWidth: MotionValue<string>;
}

function WordReveal({ word, opacity, y, lineWidth }: WordRevealProps) {
  return (
    <motion.div
      style={{ opacity }}
      className="absolute inset-0 flex flex-col items-center justify-center select-none"
    >
      <motion.p
        style={{ y }}
        className="font-display text-[80px] sm:text-[112px] md:text-[144px] lg:text-[176px] font-light tracking-[0.03em] text-foreground leading-none"
      >
        {word}
      </motion.p>
      {/* Hairline rule grows from left */}
      <motion.div style={{ width: lineWidth }} className="h-px bg-foreground/20 mt-6 origin-left" />
    </motion.div>
  );
}

export function Declaration() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Word 1 — "Precision."
  const op1 = useTransform(scrollYProgress, [0, 0.1, 0.2, 0.35], [0, 1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0, 0.35], ["6%", "-6%"]);
  const line1 = useTransform(scrollYProgress, [0.1, 0.22], ["0%", "100%"]);

  // Word 2 — "Craft."
  const op2 = useTransform(scrollYProgress, [0.3, 0.42, 0.55, 0.68], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.3, 0.68], ["6%", "-6%"]);
  const line2 = useTransform(scrollYProgress, [0.42, 0.56], ["0%", "100%"]);

  // Word 3 — "Transform." — stays visible
  const op3 = useTransform(scrollYProgress, [0.62, 0.74, 1], [0, 1, 1]);
  const y3 = useTransform(scrollYProgress, [0.62, 1], ["6%", "0%"]);
  const line3 = useTransform(scrollYProgress, [0.74, 0.88], ["0%", "100%"]);

  // Summary text fades in after word 3 settles
  const summaryOp = useTransform(scrollYProgress, [0.82, 1], [0, 1]);

  return (
    <section ref={ref} className="relative h-[160vh] bg-background" aria-label="Brand declaration">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Word stack — all three occupy the same space, each absolutely positioned */}
        <div className="relative h-full">
          <WordReveal word="Precision." opacity={op1} y={y1} lineWidth={line1} />
          <WordReveal word="Craft." opacity={op2} y={y2} lineWidth={line2} />
          <WordReveal word="Transform." opacity={op3} y={y3} lineWidth={line3} />

          {/* Brand summary — appears under the third word */}
          <motion.div
            style={{ opacity: summaryOp }}
            className="absolute bottom-16 md:bottom-24 left-0 right-0 flex flex-col items-center gap-2 px-6"
          >
            <p className="text-xs tracking-[0.3em] uppercase text-muted">San Jose · Bay Area</p>
            <p className="text-sm text-muted max-w-sm text-center leading-relaxed">
              She builds systems — for lashes, for skin, for jewelry, for craft, for businesses.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
