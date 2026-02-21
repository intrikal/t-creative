/**
 * Cursor — Custom cursor that replaces the system cursor on pointer devices.
 *
 * Behaviour:
 * - A small 12px white circle follows the mouse with spring physics.
 * - On hover over links/buttons: expands to 36px with mix-blend-mode:difference
 *   so it inverts whatever colour is beneath it (dark on light, light on dark).
 * - Renders null on touch devices (pointer: coarse) and during SSR.
 *
 * The system cursor is hidden globally via globals.css for (hover: hover) devices.
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

// useSyncExternalStore lets us provide different server vs client snapshots,
// which avoids calling setState inside effects just to track "is mounted".
function noopSubscribe() {
  return () => {};
}

function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function useIsTouch() {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}

export function Cursor() {
  const mounted = useMounted();
  const isTouch = useIsTouch();
  const [hovered, setHovered] = useState(false);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Spring config: snappy follow, not floaty
  const springX = useSpring(mouseX, { stiffness: 600, damping: 40, mass: 0.4 });
  const springY = useSpring(mouseY, { stiffness: 600, damping: 40, mass: 0.4 });

  useEffect(() => {
    if (isTouch) return;

    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as Element;
      setHovered(!!target.closest("a, button, [role='button'], [tabindex]"));
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
    };
  }, [mouseX, mouseY, isTouch]);

  if (!mounted || isTouch) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-[9999]"
      style={{
        x: springX,
        y: springY,
        translateX: "-50%",
        translateY: "-50%",
        mixBlendMode: hovered ? "difference" : "normal",
      }}
    >
      <motion.div
        className="rounded-full bg-white"
        animate={{
          width: hovered ? 36 : 12,
          height: hovered ? 36 : 12,
          opacity: hovered ? 1 : 0.85,
        }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      />
    </motion.div>
  );
}
