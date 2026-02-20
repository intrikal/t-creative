/**
 * HeroFallback — Parallax gradient background shown while 3D scene loads.
 *
 * Also used on mobile/reduced-motion as a static studio visual.
 * Client Component — uses Framer Motion for scroll-driven parallax.
 */
"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export function HeroFallback() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #FAF6F1 0%, #F3ECE4 40%, #F0E0D6 70%, #E8C4B8 100%)",
      }}
    >
      {/* Floating geometric shapes — parallax layers */}
      <motion.div
        className="absolute top-[15%] left-[10%] w-48 h-48 rounded-full opacity-20"
        style={{
          y: y1,
          scale,
          background: "radial-gradient(circle, #E8C4B8 0%, transparent 70%)",
        }}
      />

      <motion.div
        className="absolute top-[25%] right-[15%] w-32 h-32 opacity-15"
        style={{
          y: y2,
          background: "radial-gradient(circle, #C4907A 0%, transparent 70%)",
        }}
      />

      <motion.div
        className="absolute bottom-[20%] left-[30%] w-64 h-64 rounded-full opacity-10"
        style={{
          y: y3,
          background: "radial-gradient(circle, #F5E6D3 0%, transparent 70%)",
        }}
      />

      {/* Subtle architectural line */}
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-[60%] bg-foreground/5"
        style={{ scaleY: scale }}
      />

      {/* Horizontal line */}
      <motion.div
        className="absolute top-[45%] left-1/2 -translate-x-1/2 h-px w-[40%] bg-foreground/5"
        style={{ y: y2 }}
      />
    </div>
  );
}
