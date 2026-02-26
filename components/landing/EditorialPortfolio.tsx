/**
 * EditorialPortfolio — Asymmetric 3-column portfolio grid with loupe interaction. Act V.
 *
 * Layout: three columns with staggered vertical offsets. Centre column drifts
 * upward on scroll. On hover, images scale within a circular mask that follows
 * the cursor — like a jeweler's loupe — reinforcing "precision" and "craft."
 *
 * Category filters use a shared layoutId underline that slides between options.
 *
 * Client Component — Framer Motion scroll parallax + hover + layout animations.
 */
"use client";

import { useRef, useState, useCallback } from "react";
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

/** Loupe interaction — circular magnification follows cursor on hover */
function WorkCard({ item, delay = 0 }: { item: WorkItem; delay?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [loupePos, setLoupePos] = useState({ x: 50, y: 50 });
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLoupePos({ x, y });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      layout
      className="group relative overflow-hidden cursor-crosshair"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseMove={handleMouseMove}
    >
      {/* Base image */}
      <div
        className="aspect-[4/5] w-full"
        style={{
          background: `linear-gradient(160deg, ${item.color}44 0%, ${item.color}18 60%, ${item.color}28 100%)`,
        }}
      />

      {/* Loupe effect — circular magnified area following cursor */}
      {isHovering && (
        <div
          className="absolute pointer-events-none transition-opacity duration-200"
          style={{
            left: `${loupePos.x}%`,
            top: `${loupePos.y}%`,
            transform: "translate(-50%, -50%)",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.3)",
            overflow: "hidden",
            boxShadow: "0 0 24px rgba(0,0,0,0.15)",
          }}
        >
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(160deg, ${item.color}88 0%, ${item.color}44 60%, ${item.color}58 100%)`,
              transform: "scale(1.5)",
            }}
          />
        </div>
      )}

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

  const centreY = useTransform(scrollYProgress, [0, 1], ["0px", "-48px"]);

  const filtered =
    activeCategory === "All" ? WORK : WORK.filter((w) => w.category === activeCategory);

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

        {/* Category filters with sliding underline */}
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
              className={`relative px-4 py-2 text-[10px] tracking-[0.2em] uppercase transition-colors duration-300 ${
                activeCategory === cat
                  ? "text-background"
                  : "text-background/40 hover:text-background/70"
              }`}
            >
              {cat}
              {activeCategory === cat && (
                <motion.div
                  layoutId="portfolio-filter-underline"
                  className="absolute bottom-0 left-0 right-0 h-px bg-accent"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          ))}
        </motion.div>

        {/* Asymmetric 3-column grid */}
        <LayoutGroup>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div className="flex flex-col gap-3 md:gap-4">
              <AnimatePresence mode="popLayout">
                {col1.map((item, i) => (
                  <WorkCard key={item.id} item={item} delay={i * 0.06} />
                ))}
              </AnimatePresence>
            </div>

            <motion.div style={{ y: centreY }} className="flex flex-col gap-3 md:gap-4 md:mt-16">
              <AnimatePresence mode="popLayout">
                {col2.map((item, i) => (
                  <WorkCard key={item.id} item={item} delay={0.08 + i * 0.06} />
                ))}
              </AnimatePresence>
            </motion.div>

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
