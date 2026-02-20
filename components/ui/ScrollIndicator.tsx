/**
 * ScrollIndicator — Animated scroll prompt displayed at the bottom of hero sections.
 *
 * Client Component — uses Framer Motion for infinite pulse animation.
 */
"use client";

import { motion } from "framer-motion";

export function ScrollIndicator() {
  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3">
      <span className="text-xs tracking-widest uppercase text-muted">Scroll</span>
      <motion.div
        className="w-px h-12 bg-foreground/30 origin-top"
        animate={{ scaleY: [0, 1, 0] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}
