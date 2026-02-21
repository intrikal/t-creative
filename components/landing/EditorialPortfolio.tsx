/**
 * EditorialPortfolio — Asymmetric 3-column portfolio grid. Act V.
 *
 * Layout philosophy:
 * - Three columns with deliberately different vertical offsets break the
 *   uniform grid template feeling.
 * - The centre column drifts upward as the user scrolls (subtle parallax),
 *   creating a sense of depth and motion.
 * - Images are 4:5 portrait ratio — editorial, not product thumbnail.
 * - Captions are hidden by default; they slide up on hover so the work
 *   speaks first.
 * - The section sits on a dark background (foreground colour) to echo
 *   the original Portfolio.tsx and visually punctuate the page rhythm.
 *
 * Client Component — Framer Motion scroll parallax + hover animations.
 */
"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";

const WORK = [
  { caption: "Volume Set — Special Event", color: "#C4907A", category: "Lash" },
  { caption: "Permanent Bracelet — Gold Chain", color: "#D4A574", category: "Jewelry" },
  { caption: "Custom Crochet — Commissioned Piece", color: "#7BA3A3", category: "Crochet" },
  { caption: "Cat Eye Lash Transformation", color: "#C4907A", category: "Lash" },
  { caption: "Welded Anklet — Sterling Silver", color: "#D4A574", category: "Jewelry" },
  { caption: "Handmade Crochet Blanket", color: "#7BA3A3", category: "Crochet" },
  { caption: "Strategy Session Frameworks", color: "#5B8A8A", category: "Consulting" },
  { caption: "Classic Full Set", color: "#C4907A", category: "Lash" },
  { caption: "Permanent Necklace — Rose Gold", color: "#D4A574", category: "Jewelry" },
];

// Distribute items into 3 columns: [0,3,6], [1,4,7], [2,5,8]
const col1 = WORK.filter((_, i) => i % 3 === 0);
const col2 = WORK.filter((_, i) => i % 3 === 1);
const col3 = WORK.filter((_, i) => i % 3 === 2);

function WorkItem({ item, delay = 0 }: { item: (typeof WORK)[0]; delay?: number }) {
  return (
    <motion.div
      className="group relative overflow-hidden"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Image placeholder — replace src with real <Image> when assets are ready */}
      <div
        className="aspect-[4/5] w-full transition-transform duration-700 ease-out group-hover:scale-[1.03]"
        style={{
          background: `linear-gradient(160deg, ${item.color}44 0%, ${item.color}18 60%, ${item.color}28 100%)`,
        }}
      />

      {/* Caption — hidden, slides up on hover */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-400 ease-out">
        <span className="text-[10px] tracking-[0.2em] uppercase text-white/60 mb-1">
          {item.category}
        </span>
        <p className="text-sm font-light text-white leading-snug">{item.caption}</p>
      </div>
    </motion.div>
  );
}

export function EditorialPortfolio() {
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Centre column drifts upward slightly as the section passes through viewport
  const centreY = useTransform(scrollYProgress, [0, 1], ["0px", "-48px"]);

  return (
    <section
      ref={sectionRef}
      className="bg-foreground text-background py-28 md:py-40 px-6 overflow-hidden"
      aria-label="Portfolio"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          className="mb-20 md:mb-28"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-accent mb-5 block">
            The Work
          </span>
          <h2 className="font-display text-4xl md:text-6xl font-light tracking-tight text-background leading-[1.1]">
            Each piece tells a story.
          </h2>
        </motion.div>

        {/* Asymmetric 3-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {/* Column 1 — standard vertical offset */}
          <div className="flex flex-col gap-3 md:gap-4">
            {col1.map((item, i) => (
              <WorkItem key={item.caption} item={item} delay={i * 0.08} />
            ))}
          </div>

          {/* Column 2 — offset down + scroll parallax (hidden on mobile as col) */}
          <motion.div style={{ y: centreY }} className="flex flex-col gap-3 md:gap-4 md:mt-16">
            {col2.map((item, i) => (
              <WorkItem key={item.caption} item={item} delay={0.1 + i * 0.08} />
            ))}
          </motion.div>

          {/* Column 3 — half-step offset (hidden on mobile, merged into col1) */}
          <div className="hidden md:flex flex-col gap-4 mt-8">
            {col3.map((item, i) => (
              <WorkItem key={item.caption} item={item} delay={0.05 + i * 0.08} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          className="mt-16 md:mt-20"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Link
            href="/portfolio"
            className="text-xs tracking-[0.25em] uppercase text-accent hover:text-background transition-colors duration-300 nav-link-reveal pb-px"
          >
            View Full Portfolio →
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
