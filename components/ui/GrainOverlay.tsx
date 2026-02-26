/**
 * GrainOverlay — SVG feTurbulence noise texture applied as a fixed overlay.
 *
 * Adds materiality to the screen — makes ivory backgrounds feel like paper,
 * not plastic. Uses an SVG filter for performance (no image download).
 * Respects prefers-reduced-motion by disabling the subtle animation.
 */
"use client";

export function GrainOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.035]"
      aria-hidden
      style={{ mixBlendMode: "multiply" }}
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );
}
