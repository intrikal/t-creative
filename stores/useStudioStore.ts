/**
 * useStudioStore — Zustand store managing the 3D studio state machine.
 *
 * State machine transitions:
 *   landing → entering → exploring ⇄ focused → exiting → landing
 *
 * The `isTransitioning` flag gates interactions while the camera lerps
 * to its next target. `completeTransition` is called from StudioCamera's
 * useFrame once the camera arrives within ARRIVAL_THRESHOLD.
 */
import { create } from "zustand";
import { type ZoneId, ZONE_ORDER } from "@/lib/zones";

export type StudioMode = "landing" | "entering" | "exploring" | "focused" | "exiting";

interface StudioState {
  mode: StudioMode;
  activeZone: ZoneId | null;
  targetZone: ZoneId | null;
  isTransitioning: boolean;
  hoveredZone: ZoneId | null;

  enterStudio: () => void;
  exitStudio: () => void;
  focusZone: (id: ZoneId) => void;
  unfocusZone: () => void;
  completeTransition: () => void;
  setHoveredZone: (id: ZoneId | null) => void;
  nextZone: () => void;
  prevZone: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  mode: "landing",
  activeZone: null,
  targetZone: null,
  isTransitioning: false,
  hoveredZone: null,

  enterStudio: () => {
    set({
      mode: "entering",
      isTransitioning: true,
      activeZone: null,
      targetZone: null,
    });
  },

  exitStudio: () => {
    set({
      mode: "exiting",
      isTransitioning: true,
      activeZone: null,
      targetZone: null,
    });
  },

  focusZone: (id: ZoneId) => {
    const { isTransitioning, activeZone } = get();
    if (isTransitioning || activeZone === id) return;
    set({
      targetZone: id,
      isTransitioning: true,
    });
  },

  unfocusZone: () => {
    const { isTransitioning } = get();
    if (isTransitioning) return;
    set({
      activeZone: null,
      targetZone: null,
      isTransitioning: true,
      mode: "exploring",
    });
  },

  completeTransition: () => {
    const { mode, targetZone } = get();

    if (mode === "entering") {
      set({
        mode: "exploring",
        isTransitioning: false,
      });
    } else if (mode === "exiting") {
      set({
        mode: "landing",
        activeZone: null,
        targetZone: null,
        isTransitioning: false,
      });
    } else if (targetZone) {
      // Arrived at a zone
      set({
        mode: "focused",
        activeZone: targetZone,
        targetZone: null,
        isTransitioning: false,
      });
    } else {
      // Returned to center
      set({
        activeZone: null,
        targetZone: null,
        isTransitioning: false,
      });
    }
  },

  setHoveredZone: (id) => set({ hoveredZone: id }),

  nextZone: () => {
    const { activeZone, isTransitioning } = get();
    if (isTransitioning) return;
    const idx = activeZone ? ZONE_ORDER.indexOf(activeZone) : -1;
    const next = ZONE_ORDER[(idx + 1) % ZONE_ORDER.length];
    get().focusZone(next);
  },

  prevZone: () => {
    const { activeZone, isTransitioning } = get();
    if (isTransitioning) return;
    const idx = activeZone ? ZONE_ORDER.indexOf(activeZone) : 0;
    const prev = ZONE_ORDER[(idx - 1 + ZONE_ORDER.length) % ZONE_ORDER.length];
    get().focusZone(prev);
  },
}));
