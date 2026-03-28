"use client";

import { Suspense, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { m, AnimatePresence } from "framer-motion";
import { ZONES, ZONE_ORDER } from "@/lib/zones";
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
  { ssr: false, loading: () => <DioramaLoadingSkeleton /> },
);

export function StudioDiorama() {
  const activeZone = useStudioStore((s) => s.activeZone);
  const focusZone = useStudioStore((s) => s.focusZone);
  const unfocusZone = useStudioStore((s) => s.unfocusZone);
  const nextZone = useStudioStore((s) => s.nextZone);
  const prevZone = useStudioStore((s) => s.prevZone);
  const isTransitioning = useStudioStore((s) => s.isTransitioning);
  const zone = activeZone ? ZONES[activeZone] : null;

  // Escape to exit zone
  useEffect(() => {
    if (!activeZone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") unfocusZone();
      if (e.key === "ArrowRight") nextZone();
      if (e.key === "ArrowLeft") prevZone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeZone, unfocusZone, nextZone, prevZone]);

  return (
    <section
      className="relative -mt-24 pt-40 md:pt-52 pb-28 md:pb-40 px-6 bg-background"
      aria-label="3D Studio"
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="text-[10px] tracking-[0.35em] uppercase text-muted mb-4 block">
              The Studio
            </span>
            <h2 className="font-display text-3xl md:text-5xl font-light tracking-tight text-foreground">
              Step inside.
            </h2>
          </div>
          <p className="text-sm text-muted max-w-xs leading-relaxed sm:text-right">
            Move your mouse to explore. Click a zone to learn more.
          </p>
        </div>

        {/* Canvas + overlays */}
        <div className="relative w-full aspect-[16/9] md:aspect-[16/8] overflow-hidden border border-foreground/8 bg-[#FAF6F1]">
          <Suspense fallback={<DioramaLoadingSkeleton />}>
            <DioramaCanvas />
          </Suspense>

          {/* Idle hint */}
          <AnimatePresence>
            {!activeZone && (
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-widest uppercase text-muted/40 pointer-events-none select-none"
              >
                Click a zone to explore
              </m.div>
            )}
          </AnimatePresence>

          {/* ── Prev / Next arrows — visible when a zone is focused ── */}
          <AnimatePresence>
            {activeZone && (
              <>
                <m.button
                  key="prev"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.25 }}
                  onClick={prevZone}
                  disabled={isTransitioning}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center border border-background/20 bg-background/10 backdrop-blur-sm text-background hover:bg-background/20 transition-colors disabled:opacity-30"
                  aria-label="Previous zone"
                >
                  <span className="text-sm">←</span>
                </m.button>
                <m.button
                  key="next"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.25 }}
                  onClick={nextZone}
                  disabled={isTransitioning}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center border border-background/20 bg-background/10 backdrop-blur-sm text-background hover:bg-background/20 transition-colors disabled:opacity-30"
                  aria-label="Next zone"
                >
                  <span className="text-sm">→</span>
                </m.button>
              </>
            )}
          </AnimatePresence>

          {/* ── Bottom info overlay — slides up when zone is focused ── */}
          <AnimatePresence mode="wait">
            {zone && (
              <m.div
                key={zone.id}
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 36, stiffness: 320 }}
                className="absolute bottom-0 left-0 right-0 bg-foreground/90 backdrop-blur-md px-6 md:px-10 py-5 md:py-6"
              >
                <div className="flex items-center justify-between gap-6">
                  {/* Zone info */}
                  <div className="flex items-start gap-5 min-w-0">
                    {/* Color bar */}
                    <div
                      className="w-0.5 self-stretch shrink-0 rounded-full"
                      style={{ backgroundColor: zone.color }}
                    />
                    <div className="min-w-0">
                      <p
                        className="text-[10px] tracking-[0.25em] uppercase mb-1"
                        style={{ color: zone.color }}
                      >
                        {zone.label}
                      </p>
                      <h3 className="font-display text-lg md:text-2xl font-light text-background tracking-tight truncate">
                        {zone.heading}
                      </h3>
                      <p className="text-xs text-background/50 mt-0.5 hidden md:block">
                        {zone.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={zone.cta.href}
                      className="text-[10px] tracking-[0.2em] uppercase bg-background text-foreground px-5 py-2.5 hover:bg-background/90 transition-colors"
                    >
                      {zone.cta.label}
                    </Link>
                    <button
                      onClick={unfocusZone}
                      className="text-[10px] tracking-[0.2em] uppercase text-background/50 hover:text-background transition-colors px-3 py-2.5"
                      aria-label="Back to overview"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zone strip */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          {ZONE_ORDER.map((id) => {
            const z = ZONES[id];
            const isActive = activeZone === id;
            return (
              <button
                key={id}
                onClick={() => (isActive ? unfocusZone() : focusZone(id))}
                className="flex items-center gap-2 text-[10px] tracking-[0.18em] uppercase transition-colors duration-300 hover:text-foreground"
                style={{ color: isActive ? z.color : undefined }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: z.color,
                    opacity: isActive ? 1 : 0.3,
                    transform: isActive ? "scale(1.5)" : "scale(1)",
                  }}
                />
                {z.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
