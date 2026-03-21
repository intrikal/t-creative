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

// Dynamic import with ssr:false — Three.js/R3F requires WebGL which only exists in the browser.
// .then((mod) => mod.ScrollQuietRoom) extracts the named export for next/dynamic.
const ScrollQuietRoom = dynamic(
  () => import("@/components/three/ScrollQuietRoom").then((mod) => mod.ScrollQuietRoom),
  {
    ssr: false,
    loading: () => <HeroFallback />,
  },
);

// Zone overlay definitions — each maps to a camera position in the 3D scene.
// enterFrom controls which side the text slides in from, alternating left/right
// to create visual rhythm as the camera pans through zones.
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
  // useRef tracks the 300vh section for scroll progress measurement.
  const ref = useRef<HTMLElement>(null);
  // use3D: whether device supports WebGL + is desktop + allows motion.
  // Starts false; set in useEffect after capability detection.
  const [use3D, setUse3D] = useState(false);
  // scrollValue: numeric 0→1 mirror of scrollYProgress, needed to pass as a plain
  // number prop to the 3D scene component (which can't consume MotionValues directly).
  const [scrollValue, setScrollValue] = useState(0);
  // Destructuring Zustand store — mode for view state, enterStudio for the CTA action.
  const { mode, enterStudio } = useStudioStore();
  // Derived boolean for conditional rendering of overlays.
  const isInStudio = mode !== "landing";

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // useMotionValueEvent subscribes to MotionValue changes and syncs to React state.
  // This bridge is needed because the 3D scene (ScrollQuietRoom) accepts a plain number
  // prop, not a MotionValue. Cannot use useTransform because R3F components re-render
  // on prop changes, not on MotionValue changes.
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setScrollValue(v);
  });

  // Canvas fades in at start, fades out at end of pin section
  const canvasOpacity = useTransform(scrollYProgress, [0, 0.06, 0.9, 1], [0, 1, 1, 0]);

  // Intro overlay fades in then exits
  const introOpacity = useTransform(scrollYProgress, [0, 0.06, 0.16, 0.28], [0, 1, 1, 0]);
  const introY = useTransform(scrollYProgress, [0, 0.28], ["0%", "-8%"]);

  // Nested ternary maps scroll progress to the active zone index (0–3) or -1 (no zone).
  // The scroll range 0.5→1.0 is divided into 4 equal segments (each ~12.5% of scroll).
  // Ternary chain chosen over an if/else or lookup table because it's a simple linear
  // partition — each threshold maps to exactly one zone in sequence.
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

  // useEffect runs once on mount to detect device capabilities (motion preference, screen
  // width, WebGL support). Cannot run during render because it accesses browser-only APIs.
  // startTransition wraps the state update so the fallback renders immediately while
  // 3D capability is resolved as a non-urgent update.
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
        {/* Conditional render: 3D canvas vs. static fallback based on device capability.
            Ternary rather than && because both branches need the same opacity wrapper. */}
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

        {/* Conditional render: zone overlay text only shows when NOT in free-explore studio mode
            AND when scroll has progressed past the 50% threshold (activeZoneIndex >= 0).
            key={...id} forces AnimatePresence to animate between zone transitions. */}
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

/**
 * ZoneOverlayText — Fixed-position text card for a service zone during scroll exploration.
 *
 * Props:
 * - overlay: zone overlay data including id, name, tagline, CTA, and entrance direction
 *
 * Enters with a clip-path reveal from the specified side (left or right), creating a
 * wipe-in effect that matches the camera's movement direction in the 3D scene.
 */
function ZoneOverlayText({ overlay }: { overlay: (typeof ZONE_OVERLAYS)[number] }) {
  // Look up full zone config (color, heading, etc.) from the shared ZONES registry.
  const zone = ZONES[overlay.id];
  // Boolean to control which side the clip-path wipe originates from.
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
