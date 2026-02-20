/**
 * ImmersiveIntro — Scroll-driven narrative section revealing the studio philosophy phrase by phrase.
 *
 * Client Component — uses Framer Motion scroll progress to animate background opacity and text reveals.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const phrases = [
  "Most studios separate the craft from the business.",
  "The appointment from the invoice. The portfolio from the product.",
  "The experience from the system that supports it.",
  "We refused.",
  "T Creative Studio is a single, continuous space —",
  "where beauty work, client relationships, scheduling, payments,",
  "messaging, and creative output live under one roof.",
  "Not bolted together. Designed together.",
];

export function ImmersiveIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const bgOpacity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 0.4, 0]);

  return (
    <section ref={containerRef} className="relative py-32 md:py-48 px-6">
      {/* Background blend */}
      <motion.div className="absolute inset-0 bg-accent-geo" style={{ opacity: bgOpacity }} />

      <div className="relative mx-auto max-w-3xl">
        {phrases.map((phrase, i) => (
          <motion.p
            key={i}
            className={`text-xl md:text-2xl lg:text-3xl leading-relaxed mb-4 ${
              phrase === "We refused." || phrase === "Not bolted together. Designed together."
                ? "font-medium text-foreground mt-8"
                : "text-muted"
            }`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
              duration: 0.7,
              delay: i * 0.08,
              ease: "easeOut",
            }}
          >
            {phrase}
          </motion.p>
        ))}
      </div>
    </section>
  );
}
