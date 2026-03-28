/**
 * SectionTransition — Gradient bleed strips between landing page sections.
 *
 * Enterprise SaaS pattern: instead of hard background-color cuts between
 * sections, render a gradient strip that fades from one bg to the next.
 * This breaks the "stacked PowerPoint slides" feel.
 *
 * Usage: <SectionTransition from="background" to="foreground" />
 *        placed between two sections in the page layout.
 */

const COLOR_MAP: Record<string, string> = {
  background: "var(--color-background)",
  surface: "var(--color-surface)",
  foreground: "var(--color-foreground)",
};

export function SectionTransition({
  from,
  to,
  height = "8rem",
  className = "",
}: {
  from: keyof typeof COLOR_MAP;
  to: keyof typeof COLOR_MAP;
  height?: string;
  className?: string;
}) {
  return (
    <div
      className={`w-full pointer-events-none ${className}`}
      style={{
        height,
        background: `linear-gradient(to bottom, ${COLOR_MAP[from]}, ${COLOR_MAP[to]})`,
      }}
      aria-hidden="true"
    />
  );
}
