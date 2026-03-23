/**
 * StudioSection — Interactive 3D studio entry point with fallback for mobile/reduced-motion.
 *
 * Used on the landing page. Renders either a full Three.js 3D scene (QuietRoom) or a static
 * fallback depending on device capabilities. Manages studio mode transitions via Zustand store.
 * Client Component — dynamically loads the Three.js scene and manages studio mode via Zustand.
 *
 * No props — reads/writes studio state from useStudioStore.
 */
"use client";

import { startTransition, Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { m } from "framer-motion";
import { StudioNav } from "@/components/atelier/StudioNav";
import { ZoneOverlay } from "@/components/atelier/ZoneOverlay";
import { HeroFallback } from "@/components/three/HeroFallback";
import { Button } from "@/components/ui/Button";
import { useStudioStore } from "@/stores/useStudioStore";

// Dynamic import with ssr:false — Three.js requires WebGL which only exists in the browser.
// .then((mod) => mod.QuietRoom) extracts the named export from the module to satisfy
// next/dynamic's expectation of a default-like import.
const QuietRoom = dynamic(
  () => import("@/components/three/QuietRoom").then((mod) => mod.QuietRoom),
  {
    ssr: false,
    loading: () => <HeroFallback />,
  },
);

export function StudioSection() {
  // use3D: whether the device supports and should render the 3D scene.
  // Starts false (safe default) and is set to true in useEffect after capability detection.
  const [use3D, setUse3D] = useState(false);

  // Destructuring from Zustand store — mode tracks current view state,
  // enterStudio/exitStudio are actions that transition between landing and studio modes.
  const { mode, enterStudio, exitStudio } = useStudioStore();

  // Derived boolean — true when user has entered the 3D studio exploration mode.
  const isInStudio = mode !== "landing";

  // useEffect runs once on mount to detect device capabilities.
  // Cannot run during render because it accesses browser-only APIs (window, matchMedia, canvas).
  // startTransition wraps the state update to avoid blocking the initial paint — the fallback
  // renders immediately while 3D capability is resolved as a low-priority update.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.innerWidth < 768;

    // WebGL feature detection
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

  const handleEnterStudio = () => {
    if (!use3D) return;
    enterStudio();
    // Scroll to the section
    document.getElementById("studio")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <section id="studio" className="relative">
        {/* Conditional render: intro text only shows in landing mode.
            When user enters the studio, this block unmounts entirely. */}
        {!isInStudio && (
          <div className="py-24 md:py-32 px-6 text-center">
            <m.div
              className="mx-auto max-w-2xl"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <span className="text-xs tracking-widest uppercase text-muted mb-6 block">
                The Studio
              </span>
              <h2 className="text-3xl md:text-5xl font-light tracking-tight text-foreground mb-6">
                Step inside.
              </h2>
              <p className="text-base text-muted mb-10 max-w-lg mx-auto">
                Explore our virtual studio space. Click on any zone to learn more about each service
                area.
              </p>
              {/* Conditional render: if device supports 3D, show the enter button;
                  otherwise show an informational message explaining why 3D is unavailable. */}
              {use3D ? (
                <Button onClick={handleEnterStudio}>Enter the Studio</Button>
              ) : (
                <p className="text-sm text-muted">
                  3D studio available on desktop with motion enabled.
                </p>
              )}
            </m.div>
          </div>
        )}

        {/* 3D viewport — only mounts when device supports WebGL.
            Ternary on isInStudio toggles between inline preview (50–60vh) and
            fullscreen fixed overlay (z-50) — CSS transition animates the expansion. */}
        {use3D && (
          <div
            className={`transition-all duration-700 overflow-hidden ${
              isInStudio ? "fixed inset-0 z-50 h-screen" : "relative h-[50vh] md:h-[60vh]"
            }`}
          >
            <Suspense fallback={<HeroFallback />}>
              <QuietRoom />
            </Suspense>
          </div>
        )}

        {/* Conditional render: static fallback shown only when 3D is disabled AND we're
            in landing mode — provides a visual placeholder where the 3D scene would be. */}
        {!use3D && !isInStudio && (
          <div className="relative h-[40vh] overflow-hidden">
            <HeroFallback />
          </div>
        )}
      </section>

      {/* Studio overlays — only visible in studio mode */}
      <StudioNav />
      <ZoneOverlay />
    </>
  );
}
