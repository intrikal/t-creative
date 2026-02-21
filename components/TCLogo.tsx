/**
 * TCLogo — Branded SVG mark for T Creative Studio.
 *
 * Design concept:
 * - The T letterform is the foundation (brand initial)
 * - The crossbar doubles as a lash line, with five curved strokes
 *   extending upward — representing lash extensions
 * - A small 4-pointed gem sparkle in the upper-right represents
 *   permanent jewelry and the creative/beauty aesthetic
 * - Clean, minimal, luxury — matches the studio's visual identity
 *
 * Used in: PanelName (welcome panel), PanelSummary, PanelAssistantSummary
 */

interface TCLogoProps {
  className?: string;
  /** Size in pixels — used for both width and height. Default 48. */
  size?: number;
}

export function TCLogo({ className, size = 48 }: TCLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-label="T Creative Studio"
      className={className}
    >
      {/* ── Lash strokes extending upward from the crossbar ── */}
      {/* Far-left lash */}
      <path
        d="M13 20 Q11 14 10 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* Left-center lash */}
      <path
        d="M18 18 Q17 12 16 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Center lash — tallest */}
      <path
        d="M24 17 L24 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* Right-center lash */}
      <path
        d="M30 18 Q31 12 32 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.65"
      />
      {/* Far-right lash */}
      <path
        d="M35 20 Q37 14 38 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* ── T letterform ── */}
      {/* Crossbar — also the lash line */}
      <path d="M9 21 H39" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      {/* Stem */}
      <path d="M24 21 V43" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />

      {/* ── Gem sparkle — permanent jewelry accent ── */}
      {/* 4-pointed star, upper right */}
      <path
        d="M41 10 L42.2 7.5 L43.4 10 L46 11.2 L43.4 12.4 L42.2 14.8 L41 12.4 L38.4 11.2 Z"
        fill="currentColor"
        opacity="0.55"
      />
    </svg>
  );
}
