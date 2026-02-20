/**
 * StudioNav — HUD overlay for 3D studio navigation.
 *
 * Renders zone dots, exit/back buttons, and zone labels.
 * Handles keyboard navigation (Arrow keys, Escape).
 * Client Component — uses Framer Motion and Zustand store.
 */
"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ZONES, ZONE_ORDER } from "@/lib/zones";
import { useStudioStore } from "@/stores/useStudioStore";

export function StudioNav() {
  const {
    mode,
    activeZone,
    isTransitioning,
    focusZone,
    unfocusZone,
    exitStudio,
    nextZone,
    prevZone,
  } = useStudioStore();

  const isVisible = mode === "exploring" || mode === "focused" || mode === "entering";

  // Keyboard navigation
  useEffect(() => {
    if (mode !== "exploring" && mode !== "focused") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          nextZone();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevZone();
          break;
        case "Escape":
          e.preventDefault();
          if (activeZone) {
            unfocusZone();
          } else {
            exitStudio();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, activeZone, nextZone, prevZone, unfocusZone, exitStudio]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[60] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, delay: mode === "entering" ? 0.6 : 0 }}
        >
          {/* Zone label — top left */}
          <AnimatePresence mode="wait">
            {activeZone && (
              <motion.div
                key={activeZone}
                className="absolute top-8 left-8 pointer-events-auto"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-xs tracking-[0.25em] uppercase text-muted mb-1">
                  {ZONES[activeZone].label}
                </p>
                <p className="text-sm text-muted max-w-xs">{ZONES[activeZone].subtitle}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Exit / Back button — top right */}
          <motion.div
            className="absolute top-8 right-8 pointer-events-auto flex gap-3"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {activeZone && (
              <button
                className="text-xs tracking-widest uppercase text-muted hover:text-foreground transition-colors px-4 py-2 border border-foreground/10 hover:border-foreground/25 bg-background/60 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                onClick={unfocusZone}
                aria-label="Return to overview"
              >
                Back
              </button>
            )}
            <button
              className="text-xs tracking-widest uppercase text-muted hover:text-foreground transition-colors px-4 py-2 border border-foreground/10 hover:border-foreground/25 bg-background/60 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              onClick={exitStudio}
              aria-label="Exit studio"
            >
              Exit
            </button>
          </motion.div>

          {/* Zone navigation dots — bottom center */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-5 pointer-events-auto">
            {ZONE_ORDER.map((zoneId) => {
              const isActive = activeZone === zoneId;
              return (
                <button
                  key={zoneId}
                  onClick={() => focusZone(zoneId)}
                  disabled={isTransitioning}
                  className="group relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-full p-2"
                  aria-label={`View ${ZONES[zoneId].label}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span
                    className={`block rounded-full transition-all duration-300 ${
                      isActive
                        ? "w-2.5 h-2.5 bg-foreground"
                        : "w-1.5 h-1.5 bg-foreground/25 group-hover:bg-foreground/50"
                    }`}
                  />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-[9px] tracking-[0.2em] uppercase text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {ZONES[zoneId].label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Screen reader live region */}
          <div aria-live="polite" className="sr-only">
            {activeZone ? `Now viewing: ${ZONES[activeZone].label}` : "Studio overview"}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
