/**
 * StudioDiorama — Isometric 3D studio scene embedded as a landing page section.
 *
 * Renders the full studio room with service zones in an isometric view.
 * Users can rotate the scene by dragging (OrbitControls). No scroll-jacking.
 * Clicking a zone opens a sidesheet overlay anchored inside the canvas area.
 *
 * Client Component — dynamic import (SSR disabled) for Three.js canvas.
 */
"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ZONES } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

function DioramaLoadingSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#FAF6F1]">
      <div className="text-center">
        <div className="w-6 h-6 border border-foreground/15 border-t-foreground/40 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[10px] tracking-[0.2em] uppercase text-muted/40">Loading</p>
      </div>
    </div>
  );
}

const DioramaCanvas = dynamic(
  () => import("./StudioDioramaCanvas").then((mod) => mod.StudioDioramaCanvas),
  {
    ssr: false,
    loading: () => <DioramaLoadingSkeleton />,
  },
);

export function StudioDiorama() {
  const activeZone = useStudioStore((s) => s.activeZone);
  const unfocusZone = useStudioStore((s) => s.unfocusZone);
  const zone = activeZone ? ZONES[activeZone] : null;

  // Close on Escape
  useEffect(() => {
    if (!zone) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        unfocusZone();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [zone, unfocusZone]);

  return (
    <section className="py-28 md:py-40 px-6 bg-background" aria-label="3D Studio">
      <div className="mx-auto max-w-7xl">
        <motion.div
          className="mb-12 md:mb-16 text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
            The Studio
          </span>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground mb-4">
            Step inside.
          </h2>
          <p className="text-muted text-base max-w-lg mx-auto">
            Explore the studio in 3D. Drag to rotate. Click a zone to learn more.
          </p>
        </motion.div>

        {/* Canvas wrapper — position:relative so the sidesheet is anchored here */}
        <motion.div
          className="relative w-full aspect-[16/10] md:aspect-[16/9] rounded-lg overflow-hidden border border-foreground/8 bg-[#FAF6F1]"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <Suspense fallback={<DioramaLoadingSkeleton />}>
            <DioramaCanvas />
          </Suspense>

          {/* Drag hint — hidden when a zone is focused */}
          {!activeZone && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase text-muted/50 pointer-events-none select-none">
              Drag to rotate · Click a zone to explore
            </div>
          )}

          {/* Sidesheet overlay — slides in from right, anchored inside the canvas */}
          <AnimatePresence mode="wait">
            {zone && (
              <motion.div
                key={zone.id}
                className="absolute right-0 top-0 bottom-0 w-full max-w-sm z-10 pointer-events-auto"
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
              >
                <div className="h-full bg-background/95 backdrop-blur-lg p-8 md:p-10 flex flex-col justify-center border-l border-foreground/5 overflow-y-auto">
                  {/* Close button */}
                  <button
                    className="absolute top-5 right-5 text-[10px] tracking-widest uppercase text-muted hover:text-foreground transition-colors"
                    onClick={unfocusZone}
                    aria-label="Close panel"
                  >
                    Close
                  </button>

                  {/* Accent line */}
                  <div className="w-8 h-px mb-6" style={{ backgroundColor: zone.color }} />

                  {/* Label */}
                  <p className="text-[10px] tracking-[0.3em] uppercase text-muted mb-3">
                    {zone.label}
                  </p>

                  {/* Heading */}
                  <motion.h3
                    className="text-2xl md:text-3xl font-light tracking-tight text-foreground mb-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    {zone.heading}
                  </motion.h3>

                  {/* Subtitle */}
                  <motion.p
                    className="text-sm italic text-muted/70 mb-5"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                  >
                    {zone.subtitle}
                  </motion.p>

                  {/* Description */}
                  <motion.p
                    className="text-sm leading-relaxed text-muted mb-8"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    {zone.description}
                  </motion.p>

                  {/* CTA */}
                  <motion.div
                    className="flex flex-col gap-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
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
        </motion.div>
      </div>
    </section>
  );
}
