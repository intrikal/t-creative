/**
 * Toggle.tsx — Pill toggle switch for the client settings page.
 *
 * Intentionally thin — no "use client" needed since it's always rendered
 * inside an already-client parent. Click events are forwarded via `onChange`.
 */

import { cn } from "@/lib/utils";

/**
 * Toggle — accessible pill switch used across settings sections.
 *
 * @param enabled  - Current on/off state.
 * @param onChange - Called when the user clicks the pill (no argument — caller flips state).
 */
export function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative w-10 rounded-full transition-colors shrink-0",
        enabled ? "bg-accent" : "bg-foreground/15",
      )}
      style={{ height: "22px", minWidth: "40px" }}
    >
      <span
        className={cn(
          "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
          enabled ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
