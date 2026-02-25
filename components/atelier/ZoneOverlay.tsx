/**
 * ZoneOverlay — Slide-in detail panel for focused studio zones.
 *
 * Displays zone heading, description, and CTA when a zone is focused.
 * Manages focus trapping and Escape key dismissal.
 * Client Component — uses Framer Motion for slide animation.
 */
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ZONES } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

export function ZoneOverlay() {
  const { mode, activeZone, unfocusZone } = useStudioStore();
  const closeRef = useRef<HTMLButtonElement>(null);

  const zone = activeZone ? ZONES[activeZone] : null;
  const isVisible = mode === "focused" && zone !== null;

  // Focus management — move focus to panel when it opens
  useEffect(() => {
    if (isVisible && closeRef.current) {
      closeRef.current.focus();
    }
  }, [isVisible]);

  // Close on Escape (secondary handler — StudioNav also handles this)
  useEffect(() => {
    if (!isVisible) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        unfocusZone();
      }
    };
    window.addEventListener("keydown", handleKey, { capture: true });
    return () => window.removeEventListener("keydown", handleKey, { capture: true });
  }, [isVisible, unfocusZone]);

  return (
    <AnimatePresence>
      {isVisible && zone && (
        <motion.div
          className="fixed right-0 top-0 bottom-0 z-[70] w-full max-w-md pointer-events-auto"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 35, stiffness: 300 }}
        >
          <div className="h-full bg-background/95 backdrop-blur-lg p-10 md:p-12 flex flex-col justify-center border-l border-foreground/5">
            {/* Close */}
            <button
              ref={closeRef}
              className="absolute top-8 right-8 text-xs tracking-widest uppercase text-muted hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onClick={unfocusZone}
              aria-label="Close panel"
            >
              Close
            </button>

            {/* Zone accent line */}
            <div className="w-8 h-px mb-8" style={{ backgroundColor: zone.color }} />

            {/* Label */}
            <motion.p
              className="text-[10px] tracking-[0.3em] uppercase text-muted mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              {zone.label}
            </motion.p>

            {/* Heading */}
            <motion.h3
              className="text-3xl md:text-4xl font-light tracking-tight text-foreground mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {zone.heading}
            </motion.h3>

            {/* Subtitle */}
            <motion.p
              className="text-sm italic text-muted/70 mb-6"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {zone.subtitle}
            </motion.p>

            {/* Description */}
            <motion.p
              className="text-base leading-relaxed text-muted mb-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {zone.description}
            </motion.p>

            {/* CTA */}
            <motion.div
              className="flex gap-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Button asChild>
                <Link href={zone.cta.href}>{zone.cta.label}</Link>
              </Button>
              <Button variant="secondary" onClick={unfocusZone}>
                Back
              </Button>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
