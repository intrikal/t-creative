/**
 * PortfolioPage — Filterable portfolio gallery.
 * Driven by database with hardcoded fallback.
 */
"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Footer } from "@/components/landing/Footer";
import type { PublicMediaItem } from "./actions";

/* ------------------------------------------------------------------ */
/*  Category config                                                    */
/* ------------------------------------------------------------------ */

type Category = "all" | "lash" | "jewelry" | "crochet";

const CATEGORY_COLORS: Record<string, string> = {
  lash: "#C4907A",
  jewelry: "#D4A574",
  crochet: "#7BA3A3",
};

const filters: { label: string; value: Category }[] = [
  { label: "All", value: "all" },
  { label: "Lash Extensions", value: "lash" },
  { label: "Permanent Jewelry", value: "jewelry" },
  { label: "Custom Crochet", value: "crochet" },
];

/* ------------------------------------------------------------------ */
/*  Hardcoded fallback                                                 */
/* ------------------------------------------------------------------ */

type WorkItem = {
  caption: string;
  category: string;
  color: string;
  imageUrl: string | null;
};

const FALLBACK_WORKS: WorkItem[] = [
  { caption: "Volume Set — Special Event", category: "lash", color: "#C4907A", imageUrl: null },
  {
    caption: "Permanent Bracelet — Gold Chain",
    category: "jewelry",
    color: "#D4A574",
    imageUrl: null,
  },
  {
    caption: "Custom Crochet — Commissioned Piece",
    category: "crochet",
    color: "#7BA3A3",
    imageUrl: null,
  },
  { caption: "Cat Eye Lash Transformation", category: "lash", color: "#C4907A", imageUrl: null },
  {
    caption: "Welded Bracelet — Sterling Silver",
    category: "jewelry",
    color: "#D4A574",
    imageUrl: null,
  },
  { caption: "Handmade Crochet Blanket", category: "crochet", color: "#7BA3A3", imageUrl: null },
  {
    caption: "Mega Volume Lashes — Red Carpet",
    category: "lash",
    color: "#C4907A",
    imageUrl: null,
  },
  {
    caption: "Permanent Bracelet — Sister Bond",
    category: "jewelry",
    color: "#D4A574",
    imageUrl: null,
  },
  { caption: "Wispy Lashes — Natural Beauty", category: "lash", color: "#C4907A", imageUrl: null },
];

/* ------------------------------------------------------------------ */
/*  Transform DB media to display format                               */
/* ------------------------------------------------------------------ */

function toWorkItems(media: PublicMediaItem[]): WorkItem[] {
  return media.map((m) => ({
    caption: m.caption || m.title || "",
    category: m.category ?? "lash",
    color: CATEGORY_COLORS[m.category ?? ""] ?? "#888",
    imageUrl: m.publicUrl,
  }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function PortfolioPage({ media }: { media: PublicMediaItem[] }) {
  const [active, setActive] = useState<Category>("all");

  const works: WorkItem[] = media.length > 0 ? toWorkItems(media) : FALLBACK_WORKS;
  const filtered = active === "all" ? works : works.filter((w) => w.category === active);

  return (
    <>
      <main id="main-content" className="pt-16">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="mx-auto max-w-5xl text-center">
            <motion.span
              className="text-xs tracking-widest uppercase text-muted mb-6 block"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              Portfolio
            </motion.span>
            <motion.h1
              className="text-4xl md:text-6xl font-light tracking-tight text-foreground mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              Explore the work.
            </motion.h1>
            <motion.p
              className="text-base md:text-lg text-muted max-w-xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              Each piece tells a story of intention, care, and transformation.
            </motion.p>
          </div>
        </section>

        {/* Filter + Grid */}
        <section className="pb-32 px-6">
          <div className="mx-auto max-w-6xl">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-12 justify-center">
              {filters.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setActive(f.value)}
                  className={`text-xs tracking-widest uppercase px-5 py-2.5 border transition-colors duration-200 ${
                    active === f.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/15 text-muted hover:border-foreground/30"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filtered.map((item, i) => (
                <motion.div
                  key={item.caption}
                  className="group relative overflow-hidden cursor-pointer"
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                >
                  {item.imageUrl ? (
                    <div className="aspect-[4/5] relative">
                      <Image
                        src={item.imageUrl}
                        alt={item.caption}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div
                      className="aspect-[4/5] transition-transform duration-500 group-hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, ${item.color}33 0%, ${item.color}11 50%, ${item.color}22 100%)`,
                      }}
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end p-4 md:p-6">
                    <p className="text-sm text-white opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                      {item.caption}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {media.length === 0 && (
              <p className="text-center text-sm text-muted mt-12">
                More work coming soon — placeholder images will be replaced with real photos.
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
