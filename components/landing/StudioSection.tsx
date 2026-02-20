/**
 * StudioSection — Interactive 3D studio entry point with fallback for mobile/reduced-motion.
 *
 * Client Component — dynamically loads the Three.js scene and manages studio mode via Zustand.
 */
"use client";

import { startTransition, Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { StudioNav } from "@/components/atelier/StudioNav";
import { ZoneOverlay } from "@/components/atelier/ZoneOverlay";
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

export function StudioSection() {
  const [use3D, setUse3D] = useState(false);
  const { mode, enterStudio, exitStudio } = useStudioStore();

  const isInStudio = mode !== "landing";

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
        {/* Intro text — visible when not in studio mode */}
        {!isInStudio && (
          <div className="py-24 md:py-32 px-6 text-center">
            <motion.div
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
              {use3D ? (
                <Button onClick={handleEnterStudio}>Enter the Studio</Button>
              ) : (
                <p className="text-sm text-muted">
                  3D studio available on desktop with motion enabled.
                </p>
              )}
            </motion.div>
          </div>
        )}

        {/* 3D viewport — expands to full screen when in studio mode */}
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
