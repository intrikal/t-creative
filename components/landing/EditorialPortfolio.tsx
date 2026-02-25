/**
 * EditorialPortfolio — Asymmetric 3-column portfolio grid with category filters. Act V.
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
 * - Category filter pills allow browsing by service type with layout
 *   animations via AnimatePresence.
 *
 * Client Component — Framer Motion scroll parallax + hover + layout animations.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, AnimatePresence, LayoutGroup } from "framer-motion";

type Category = "All" | "Lash" | "Skin" | "Jewelry" | "Craft";

interface WorkItem {
  id: string;
  caption: string;
  color: string;
  category: Exclude<Category, "All">;
}

const WORK: WorkItem[] = [
  { id: "w1", caption: "Volume Set — Special Event", color: "#C4907A", category: "Lash" },
  { id: "w2", caption: "Permanent Bracelet — Gold Chain", color: "#D4A574", category: "Jewelry" },
  { id: "w3", caption: "Custom 3D-Printed Pendant", color: "#7BA3A3", category: "Craft" },
  { id: "w4", caption: "Cat Eye Lash Transformation", color: "#C4907A", category: "Lash" },
  { id: "w5", caption: "Welded Anklet — Sterling Silver", color: "#D4A574", category: "Jewelry" },
  { id: "w6", caption: "Handmade Crochet Market Bag", color: "#7BA3A3", category: "Craft" },
  { id: "w7", caption: "Skin Treatment — Glow Facial", color: "#C4907A", category: "Skin" },
  { id: "w8", caption: "Classic Full Set", color: "#C4907A", category: "Lash" },
  { id: "w9", caption: "Permanent Necklace — Rose Gold", color: "#D4A574", category: "Jewelry" },
];

const CATEGORIES: Category[] = ["All", "Lash", "Skin", "Jewelry", "Craft"];

function WorkCard({ item, delay = 0 }: { item: WorkItem; delay?: number }) {
  return (
    <motion.div
      layout
      className="group relative overflow-hidden"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
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
  const [activeCategory, setActiveCategory] = useState<Category>("All");

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Centre column drifts upward slightly as the section passes through viewport
  const centreY = useTransform(scrollYProgress, [0, 1], ["0px", "-48px"]);

  const filtered =
    activeCategory === "All" ? WORK : WORK.filter((w) => w.category === activeCategory);

  // Distribute items into 3 columns
  const col1 = filtered.filter((_, i) => i % 3 === 0);
  const col2 = filtered.filter((_, i) => i % 3 === 1);
  const col3 = filtered.filter((_, i) => i % 3 === 2);

  return (
    <section
      ref={sectionRef}
      className="bg-foreground text-background py-28 md:py-40 px-6 overflow-hidden"
      aria-label="Portfolio"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          className="mb-12 md:mb-16"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-accent mb-5 block">
            The Work
          </span>
          <h2 className="font-display text-4xl md:text-6xl font-light tracking-tight text-background leading-[1.1]">
            The work speaks first.
          </h2>
        </motion.div>

        {/* Category filter pills */}
        <motion.div
          className="flex flex-wrap gap-2 mb-16 md:mb-24"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-[10px] tracking-[0.2em] uppercase transition-all duration-300 border ${
                activeCategory === cat
                  ? "border-background/60 text-background bg-background/10"
                  : "border-background/15 text-background/40 hover:text-background/70 hover:border-background/30"
              }`}
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Asymmetric 3-column grid */}
        <LayoutGroup>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {/* Column 1 — standard vertical offset */}
            <div className="flex flex-col gap-3 md:gap-4">
              <AnimatePresence mode="popLayout">
                {col1.map((item, i) => (
                  <WorkCard key={item.id} item={item} delay={i * 0.06} />
                ))}
              </AnimatePresence>
            </div>

            {/* Column 2 — offset down + scroll parallax */}
            <motion.div style={{ y: centreY }} className="flex flex-col gap-3 md:gap-4 md:mt-16">
              <AnimatePresence mode="popLayout">
                {col2.map((item, i) => (
                  <WorkCard key={item.id} item={item} delay={0.08 + i * 0.06} />
                ))}
              </AnimatePresence>
            </motion.div>

            {/* Column 3 — half-step offset (hidden on mobile) */}
            <div className="hidden md:flex flex-col gap-4 mt-8">
              <AnimatePresence mode="popLayout">
                {col3.map((item, i) => (
                  <WorkCard key={item.id} item={item} delay={0.04 + i * 0.06} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </LayoutGroup>

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
