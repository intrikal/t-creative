/**
 * TCLogo — Branded SVG mark for T Creative Studio.
 *
 * Design concept: "TC Flow"
 * - Flowing 'TC' letters that merge into each other
 * - Lash accent near the T top
 * - Gem at the join where T meets C
 * - Hook curl at the T tail (crochet)
 * - Earring dot at the C end
 * - Warm, classy, represents Trini and all her services
 *
 * Used in: Navbar, AuthBrandingPanel, PanelName, PanelAdminWelcome,
 *          PanelAdminStudio, PanelSummary, PanelAssistantSummary, opengraph-image
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
      viewBox="0 0 64 64"
      fill="none"
      aria-label="T Creative Studio"
      className={className}
    >
      {/* T — flowing crossbar */}
      <path
        d="M6 14 Q14 8 30 12 Q36 14 40 18"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* T — flowing stem */}
      <path
        d="M22 12 Q18 28 16 42 Q14 52 10 56"
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* C — flowing into it */}
      <path
        d="M56 16 Q46 10 40 18 Q34 28 36 40 Q38 50 46 54 Q52 56 58 52"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.65"
      />

      {/* ── Product accents ── */}
      {/* Lash near T top */}
      <path
        d="M28 8 Q30 4 32 8"
        stroke="currentColor"
        strokeWidth="0.9"
        fill="none"
        opacity="0.35"
      />
      {/* Gem at the join */}
      <path
        d="M38 20 L40 16 L42 20 L40 24 Z"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
        opacity="0.35"
      />
      {/* Hook curl at T bottom (crochet) */}
      <path
        d="M10 56 Q6 58 6 54 Q6 50 10 50"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      {/* Earring dot at C end */}
      <circle cx="58" cy="52" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
