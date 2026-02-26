/**
 * StudioPortal — Scroll-pinned 3D studio section. Act III.
 *
 * The studio scene is pinned for ~300vh of scroll. As the user scrolls,
 * the camera dollies through the studio and zone overlay text appears
 * for each area. Users can also click "Enter the Studio" for free
 * exploration mode.
 *
 * Scroll choreography:
 *   0  → 8%   Canvas fades in; intro text visible
 *   8  → 30%  Camera approaches through doorway; intro fades
 *   30 → 50%  Camera settles center; zone lights come up sequentially
 *   50 → 62%  Camera orbits to Lash zone; overlay text appears
 *   62 → 75%  Camera to Jewelry zone
 *   75 → 87%  Camera to Crochet/3D zone
 *   87 → 100% Camera to Consulting zone; canvas fades out
 *
 * Client Component — dynamic import (SSR disabled) + Framer Motion.
 */
"use client";

import { startTransition, Suspense, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useScroll, useTransform, useMotionValueEvent } from "framer-motion";
import { HeroFallback } from "@/components/three/HeroFallback";
import { Button } from "@/components/ui/Button";
import { ZONES } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

const ScrollQuietRoom = dynamic(
  () => import("@/components/three/ScrollQuietRoom").then((mod) => mod.ScrollQuietRoom),
  {
    ssr: false,
    loading: () => <HeroFallback />,
  },
);

/** Zone overlay data — minimal text that appears when camera focuses each zone */
const ZONE_OVERLAYS = [
  {
    id: "lash" as const,
    name: "Lash & Skin",
    line: "Precision placed. Naturally elevated.",
    cta: { label: "Book Appointment", href: "/book/tcreativestudio" },
    enterFrom: "right" as const,
  },
  {
    id: "jewelry" as const,
    name: "Permanent Jewelry",
    line: "Welded once. Worn forever.",
    cta: { label: "Book Session", href: "/book/tcreativestudio" },
    enterFrom: "left" as const,
  },
  {
    id: "crochet" as const,
    name: "Crochet & 3D",
    line: "From filament to form.",
    cta: { label: "Browse Collection", href: "/shop" },
    enterFrom: "right" as const,
  },
  {
    id: "consulting" as const,
    name: "Business Consulting",
    line: "Structure that scales.",
    cta: { label: "Request Consultation", href: "/contact" },
    enterFrom: "left" as const,
  },
];

export function StudioPortal() {
  const ref = useRef<HTMLElement>(null);
  const [use3D, setUse3D] = useState(false);
  const [scrollValue, setScrollValue] = useState(0);
  const { mode, enterStudio } = useStudioStore();
  const isInStudio = mode !== "landing";

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Track scroll value for passing to 3D scene
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setScrollValue(v);
  });

  // Canvas fades in at start, fades out at end of pin section
  const canvasOpacity = useTransform(scrollYProgress, [0, 0.06, 0.9, 1], [0, 1, 1, 0]);

  // Intro overlay fades in then exits
  const introOpacity = useTransform(scrollYProgress, [0, 0.06, 0.16, 0.28], [0, 1, 1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.28], ["0%", "-8%"]);

  // Determine which zone overlay to show based on scroll
  const activeZoneIndex =
    scrollValue < 0.5
      ? -1
      : scrollValue < 0.625
        ? 0
        : scrollValue < 0.75
          ? 1
          : scrollValue < 0.875
            ? 2
            : 3;

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
        {/* 3D canvas */}
        {use3D ? (
          <motion.div style={{ opacity: canvasOpacity }} className="absolute inset-0">
            <Suspense fallback={<HeroFallback />}>
              <ScrollQuietRoom scrollProgress={scrollValue} />
            </Suspense>
          </motion.div>
        ) : (
          <motion.div style={{ opacity: canvasOpacity }} className="absolute inset-0">
            <HeroFallback />
          </motion.div>
        )}

        {/* Intro overlay — fades out as camera enters */}
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

        {/* Zone overlay text — appears when camera focuses each zone */}
        {!isInStudio && activeZoneIndex >= 0 && (
          <ZoneOverlayText
            key={ZONE_OVERLAYS[activeZoneIndex].id}
            overlay={ZONE_OVERLAYS[activeZoneIndex]}
          />
        )}

        {/* Scroll indicator */}
        <motion.div
          style={{
            opacity: useTransform(scrollYProgress, [0.3, 0.38, 0.48, 0.52], [0, 1, 1, 0]),
          }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-10"
        >
          <span className="text-[9px] tracking-[0.3em] uppercase text-foreground/30">
            Scroll to explore
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

/** Fixed overlay text for a zone — enters from opposite side of camera movement */
function ZoneOverlayText({ overlay }: { overlay: (typeof ZONE_OVERLAYS)[number] }) {
  const zone = ZONES[overlay.id];
  const isLeft = overlay.enterFrom === "left";

  return (
    <motion.div
      className={`absolute z-20 ${
        isLeft ? "left-8 md:left-16" : "right-8 md:right-16"
      } top-1/2 -translate-y-1/2 max-w-sm`}
      initial={{
        opacity: 0,
        clipPath: isLeft ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)",
      }}
      animate={{
        opacity: 1,
        clipPath: "inset(0 0% 0 0%)",
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="w-2 h-2 rounded-full mb-4" style={{ backgroundColor: zone.color }} />
      <p className="text-[10px] tracking-[0.3em] uppercase mb-3" style={{ color: zone.color }}>
        {overlay.name}
      </p>
      <h3 className="font-display text-3xl md:text-4xl font-light text-foreground leading-[1.15] mb-4 tracking-tight">
        {overlay.line}
      </h3>
      <a
        href={overlay.cta.href}
        className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase text-foreground group"
      >
        <span className="nav-link-reveal pb-px">{overlay.cta.label}</span>
        <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
      </a>
    </motion.div>
  );
}
