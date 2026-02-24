"use client";

/**
 * Toggle.tsx — Minimal boolean toggle switch for the Services dashboard.
 *
 * A lightweight alternative to a third-party Switch component. Renders a
 * pill-shaped track with a sliding thumb. The accent colour (defined in
 * tailwind.config) is used for the "on" state so the toggle stays consistent
 * with the rest of the admin UI without importing any colour constants.
 *
 * ## Accessibility note
 * The button emits a native click event and stops propagation so parent
 * list items (e.g. ServiceCard) don't accidentally open an edit dialog
 * when the user only intended to toggle the active state.
 */

import { cn } from "@/lib/utils";

/**
 * Toggle — pill-shaped boolean switch.
 *
 * @param on       - Current state. `true` = on (accent colour), `false` = off (muted).
 * @param onChange - Called with the new value on click.
 */
export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={cn(
        "relative w-9 h-5 rounded-full overflow-hidden transition-colors shrink-0 focus:outline-none",
        on ? "bg-accent" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          on ? "translate-x-[19px]" : "translate-x-[2px]",
        )}
      />
    </button>
  );
}
