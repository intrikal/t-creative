/**
 * StudioPortal — Scroll-pinned 3D studio section. Act III.
 *
 * The studio scene is pinned to the viewport for ~300vh of scroll space,
 * making it the narrative spine of the page rather than an appended widget.
 *
 * Scroll choreography:
 *   0  → 8%   Canvas fades in from background colour; intro text visible
 *   8  → 30%  Intro text fades out; studio fully visible + interactive
 *   30 → 88%  Pure 3D experience — user can click zones and explore
 *   88 → 100% Canvas fades to ivory, handing off to the next section
 *
 * The 3D canvas is always contained within the sticky 100vh element.
 * The existing StudioSection full-screen mode is not used here — the zone
 * exploration happens within the pinned viewport. StudioNav and ZoneOverlay
 * are rendered at the page root (StudioOverlays.tsx) to avoid fixed-position
 * stacking-context issues with the canvas opacity wrapper.
 *
 * Degradation:
 * - Mobile / reduced-motion / no-WebGL: shows HeroFallback parallax instead.
 *
 * Client Component — dynamic import (SSR disabled) + Framer Motion.
 */
"use client";

import { startTransition, Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";
import { HeroFallback } from "@/components/three/HeroFallback";
import { Button } from "@/components/ui/Button";
import { useStudioStore } from "@/stores/useStudioStore";

const QuietRoom = dynamic(
  () => import("@/components/three/QuietRoom").then((mod) => mod.QuietRoom),
  {
    ssr: false,
    loading: () => <HeroFallback />,
  },
);

export function StudioPortal() {
  const ref = useRef<HTMLElement>(null);
  const [use3D, setUse3D] = useState(false);
  const { mode, enterStudio } = useStudioStore();
  const isInStudio = mode !== "landing";

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Canvas fades in at start, fades out at end of pin section
  const canvasOpacity = useTransform(scrollYProgress, [0, 0.06, 0.86, 1], [0, 1, 1, 0]);

  // Intro overlay (label + headline + button) fades in then exits
  const introOpacity = useTransform(scrollYProgress, [0, 0.06, 0.18, 0.32], [0, 1, 1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.32], ["0%", "-8%"]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;
    let hasWebGL = false;
    try {
      const canvas = document.createElement("canvas");
      hasWebGL = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
    } catch {
      hasWebGL = false;
    }
    startTransition(() => {
      setUse3D(!prefersReducedMotion && !isMobile && hasWebGL);
    });
  }, []);

  return (
    <section ref={ref} id="studio" className="relative h-[300vh]" aria-label="Interactive studio">
      <div className="sticky top-0 h-screen overflow-hidden bg-[#faf6f1]">
        {/* 3D canvas — contained, never full-screen in portal mode */}
        {use3D ? (
          <motion.div style={{ opacity: canvasOpacity }} className="absolute inset-0">
            <Suspense fallback={<HeroFallback />}>
              <QuietRoom />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div style={{ opacity: canvasOpacity }} className="absolute inset-0">
            <HeroFallback />
          </motion.div>
        )}

        {/* Intro overlay — fades out as user scrolls into the studio */}
        {!isInStudio && (
          <motion.div
            style={{ opacity: introOpacity, y: introY }}
            className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none"
          >
            <motion.span
              className="text-[10px] tracking-[0.3em] uppercase text-foreground/50 mb-6 block"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              The Studio
            </motion.span>
            <motion.h2
              className="font-display text-5xl md:text-7xl font-light text-foreground/90 text-center leading-[1.1] mb-10"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              Step inside.
            </motion.h2>

            {use3D ? (
              <motion.div
                className="pointer-events-auto"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                <Button onClick={enterStudio}>Enter the Studio</Button>
              </motion.div>
            ) : (
              <motion.p
                className="text-xs text-foreground/40 tracking-wide"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                3D studio available on desktop with motion enabled.
              </motion.p>
            )}
          </motion.div>
        )}

        {/* Scroll indicator — appears after intro, disappears near exit */}
        <motion.div
          style={{
            opacity: useTransform(scrollYProgress, [0.35, 0.42, 0.82, 0.9], [0, 1, 1, 0]),
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase text-foreground/30">
            Scroll to continue
          </span>
          <motion.div
            className="w-px h-8 bg-foreground/20"
            animate={{ scaleY: [1, 0.4, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: "top" }}
          />
        </motion.div>
      </div>
    </section>
  );
}
