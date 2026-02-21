/**
 * SmoothScroll — Lenis smooth-scroll provider.
 *
 * Currently a pass-through wrapper. To enable Lenis:
 *   1. npm install lenis
 *   2. Uncomment the implementation below.
 *
 * Lenis is the recommended way to get buttery scroll inertia that makes
 * the page feel like a physical object moving through space rather than
 * a webpage snapping between scroll positions.
 */
"use client";

/* -- Lenis implementation (uncomment when ready) --

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => lenis.destroy();
  }, []);

  return <>{children}</>;
}

*/

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
