/**
 * @file TimeRuler.tsx
 * @description Left-side hour labels and horizontal grid lines for time-grid views.
 */

import { GRID_H, HOURS, HOUR_H, DAY_START, GRID_TOP_PAD } from "./constants";
import { hourLabel } from "./helpers";

/** Left-side hour labels column. */
export function TimeRuler() {
  return (
    <div className="w-14 shrink-0 relative select-none" style={{ height: `${GRID_H}px` }}>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute right-3 text-[10px] text-muted leading-none -translate-y-1/2"
          style={{ top: `${(h - DAY_START) * HOUR_H + GRID_TOP_PAD}px` }}
        >
          {hourLabel(h)}
        </div>
      ))}
    </div>
  );
}

/** Horizontal grid lines spanning across all day columns. */
export function HourLines() {
  return (
    <>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-border/40 pointer-events-none z-0"
          style={{ top: `${(h - DAY_START) * HOUR_H + GRID_TOP_PAD}px` }}
        />
      ))}
    </>
  );
}
