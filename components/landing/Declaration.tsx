/**
 * Declaration — Brand identity statement in monumental display type. Act II.
 *
 * Three words scroll into view sequentially. After the third word settles,
 * a thesis statement types itself character-by-character, followed by a
 * signature horizontal rule that grows from center outward.
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

/** Typewriter — reveals text character-by-character driven by scroll progress */
function TypewriterText({
  text,
  progress,
  className,
}: {
  text: string;
  progress: MotionValue<number>;
  className?: string;
}) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, i) => {
        const charStart = i / text.length;
        const charEnd = (i + 0.5) / text.length;
        return (
          <TypewriterChar key={i} char={char} progress={progress} start={charStart} end={charEnd} />
        );
      })}
    </span>
  );
}

function TypewriterChar({
  char,
  progress,
  start,
  end,
}: {
  char: string;
  progress: MotionValue<number>;
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0, 1]);
  return (
    <motion.span style={{ opacity }} className="inline" aria-hidden>
      {char}
    </motion.span>
  );
}

export function Declaration() {
  const ref = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Word 1 — "Precision."
  const op1 = useTransform(scrollYProgress, [0, 0.08, 0.16, 0.28], [0, 1, 1, 0]);
  const y1 = useTransform(scrollYProgress, [0, 0.28], ["6%", "-6%"]);
  const line1 = useTransform(scrollYProgress, [0.08, 0.18], ["0%", "100%"]);

  // Word 2 — "Craft."
  const op2 = useTransform(scrollYProgress, [0.24, 0.34, 0.44, 0.56], [0, 1, 1, 0]);
  const y2 = useTransform(scrollYProgress, [0.24, 0.56], ["6%", "-6%"]);
  const line2 = useTransform(scrollYProgress, [0.34, 0.46], ["0%", "100%"]);

  // Word 3 — "Transform." — stays visible
  const op3 = useTransform(scrollYProgress, [0.52, 0.64, 1], [0, 1, 1]);
  const y3 = useTransform(scrollYProgress, [0.52, 1], ["6%", "0%"]);
  const line3 = useTransform(scrollYProgress, [0.64, 0.76], ["0%", "100%"]);

  // Thesis typewriter — types after word 3 settles
  const typewriterProgress = useTransform(scrollYProgress, [0.76, 0.92], [0, 1]);

  // Signature rule — grows from center after typewriter completes
  const ruleWidth = useTransform(scrollYProgress, [0.9, 1], ["0%", "40%"]);
  const ruleOpacity = useTransform(scrollYProgress, [0.88, 0.93], [0, 1]);

  return (
    <section ref={ref} className="relative h-[200vh] bg-background" aria-label="Brand declaration">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Word stack — all three occupy the same space, each absolutely positioned */}
        <div className="relative h-full">
          <WordReveal word="Precision." opacity={op1} y={y1} lineWidth={line1} />
          <WordReveal word="Craft." opacity={op2} y={y2} lineWidth={line2} />
          <WordReveal word="Transform." opacity={op3} y={y3} lineWidth={line3} />

          {/* Brand thesis — typewriter effect after word 3 */}
          <motion.div
            style={{ opacity: useTransform(scrollYProgress, [0.74, 0.78], [0, 1]) }}
            className="absolute bottom-20 md:bottom-28 left-0 right-0 flex flex-col items-center gap-5 px-6"
          >
            <TypewriterText
              text="Every material has a structure waiting inside it."
              progress={typewriterProgress}
              className="font-display text-lg md:text-xl text-foreground/70 max-w-md text-center leading-relaxed italic tracking-wide"
            />

            {/* Signature rule — grows from center */}
            <motion.div
              style={{ width: ruleWidth, opacity: ruleOpacity }}
              className="h-px bg-foreground/15 mx-auto"
            />

            <motion.p
              style={{ opacity: useTransform(scrollYProgress, [0.92, 1], [0, 1]) }}
              className="text-[10px] tracking-[0.3em] uppercase text-muted"
            >
              San Jose · Bay Area
            </motion.p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
