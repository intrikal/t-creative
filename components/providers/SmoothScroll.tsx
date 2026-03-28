"use client";

/**
 * SmoothScroll — intentionally a passthrough.
 *
 * ScrollSmoother was removed because:
 *   1. It hijacks native scroll — violating the "user always in control" constraint.
 *   2. It requires position:fixed or overflow:hidden wrappers that break iOS Safari,
 *      anchor links, and pinned ScrollTrigger sections fighting each other.
 *   3. data-speed parallax attributes caused SSR hydration mismatches.
 *
 * All GSAP animations use ScrollTrigger with start:"top 80%" triggers instead —
 * scroll is a trigger, not a controller.
 *
 * If buttery scroll inertia is needed in future, use Lenis (not ScrollSmoother)
 * with ScrollTrigger.scrollerProxy() to keep native scroll intact.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
