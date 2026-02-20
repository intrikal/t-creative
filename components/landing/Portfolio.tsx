/**
 * Portfolio — Grid gallery of work samples with hover overlays and captions.
 *
 * Client Component — uses Framer Motion for staggered grid item animations on scroll.
 */
"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionWrapper } from "@/components/ui/SectionWrapper";

const placeholders = [
  { caption: "Volume Set — Special Event", color: "#C4907A" },
  { caption: "Permanent Bracelet — Gold Chain", color: "#D4A574" },
  { caption: "Custom Crochet — Commissioned Piece", color: "#7BA3A3" },
  { caption: "Cat Eye Lash Transformation", color: "#C4907A" },
  { caption: "Welded Bracelet — Sterling Silver", color: "#D4A574" },
  { caption: "Handmade Crochet Blanket", color: "#7BA3A3" },
];

export function Portfolio() {
  return (
    <section className="bg-foreground text-background py-32 md:py-48 px-6">
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-16 md:mb-24"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-accent mb-6 block">The Work</span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight">
            Each piece tells a story.
          </h2>
          <p className="mt-4 text-background/60 text-base max-w-lg">
            Intention, care, and transformation.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {placeholders.map((item, i) => (
            <motion.div
              key={item.caption}
              className="group relative overflow-hidden cursor-pointer"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
            >
              <div
                className="aspect-[4/5] transition-transform duration-500 group-hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${item.color}33 0%, ${item.color}11 50%, ${item.color}22 100%)`,
                }}
              />
              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end p-4 md:p-6">
                <p className="text-sm text-white opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                  {item.caption}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-12 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Link
            href="/portfolio"
            className="text-sm tracking-widest uppercase text-accent hover:text-background transition-colors duration-300 border-b border-accent/40 pb-1"
          >
            View Full Portfolio
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
