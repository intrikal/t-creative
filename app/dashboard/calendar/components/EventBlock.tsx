/**
 * @file EventBlock.tsx
 * @description Positioned event chip used in all time-grid views (week, day, staff).
 */

import { TYPE_C, HOUR_H, DAY_START, GRID_TOP_PAD } from "./constants";
import { timeToMin, fmt12 } from "./helpers";
import type { CalEvent } from "./types";

export function EventBlock({
  ev,
  colIndex,
  totalCols,
  onSelect,
}: {
  ev: CalEvent;
  colIndex: number;
  totalCols: number;
  onSelect: (e: CalEvent) => void;
}) {
  const c = TYPE_C[ev.type];
  // Convert start time to pixel offset from grid top (minutes-since-day-start / 60 * px-per-hour)
  const top = ((timeToMin(ev.startTime) - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
  // Convert duration to height, with a 2px gap between adjacent blocks and 20px minimum
  const height = Math.max((ev.durationMin / 60) * HOUR_H - 2, 20);
  // Divide available width equally among overlapping columns
  const wPct = 100 / totalCols;
  const lPct = colIndex * wPct;

  return (
    <div
      onClick={() => onSelect(ev)}
      className="absolute rounded-md cursor-pointer overflow-hidden hover:brightness-95 transition-all z-10"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${lPct}% + 2px)`,
        width: `calc(${wPct}% - 4px)`,
        backgroundColor: c.bg,
        borderLeft: `2.5px solid ${c.border}`,
        outline: `1px solid ${c.border}40`,
      }}
    >
      <div className="px-1.5 py-1">
        <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: c.text }}>
          {ev.title}
        </p>
        {height > 36 && (
          <p
            className="text-[10px] leading-tight truncate mt-0.5 opacity-80"
            style={{ color: c.text }}
          >
            {fmt12(ev.startTime)}
            {ev.client ? ` · ${ev.client}` : ev.staff ? ` · ${ev.staff}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
