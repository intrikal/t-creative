/**
 * @file DayColumn.tsx
 * @description Single day column with hour slots, availability overlays, and events.
 *              Used by WeekView, DayView, and StaffView.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { HOUR_H, DAY_START, DAY_END, TOTAL_HOURS, GRID_H, GRID_TOP_PAD } from "./constants";
import { EventBlock } from "./EventBlock";
import { timeToMin, layoutDay } from "./helpers";
import type { CalEvent, DayAvailability } from "./types";

export function DayColumn({
  events,
  onSelect,
  onSlotClick,
  availability,
  isToday,
}: {
  events: CalEvent[];
  onSelect: (e: CalEvent) => void;
  onSlotClick?: (h: number) => void;
  availability?: DayAvailability;
  isToday?: boolean;
}) {
  const laid = useMemo(() => layoutDay(events), [events]);

  // Compute overlay blocks for unavailable time
  const overlays = useMemo(() => {
    if (!availability) return [];
    const blocks: { top: number; height: number; label?: string; type: "closed" | "lunch" }[] = [];

    if (!availability.isOpen) {
      // Whole day closed / blocked
      blocks.push({
        top: GRID_TOP_PAD,
        height: TOTAL_HOURS * HOUR_H,
        label: availability.isBlocked ? availability.blockLabel : "Closed",
        type: "closed",
      });
      return blocks;
    }

    // Before opening
    if (availability.opensAt) {
      const openMin = timeToMin(availability.opensAt);
      const startMin = DAY_START * 60;
      if (openMin > startMin) {
        const h = ((openMin - startMin) / 60) * HOUR_H;
        blocks.push({ top: GRID_TOP_PAD, height: h, type: "closed" });
      }
    }

    // After closing
    if (availability.closesAt) {
      const closeMin = timeToMin(availability.closesAt);
      const endMin = DAY_END * 60;
      if (closeMin < endMin) {
        const topPx = ((closeMin - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
        const h = ((endMin - closeMin) / 60) * HOUR_H;
        blocks.push({ top: topPx, height: h, type: "closed" });
      }
    }

    // Lunch break
    if (availability.lunchStart && availability.lunchEnd) {
      const lunchStartMin = timeToMin(availability.lunchStart);
      const lunchEndMin = timeToMin(availability.lunchEnd);
      if (lunchStartMin >= DAY_START * 60 && lunchEndMin <= DAY_END * 60) {
        const topPx = ((lunchStartMin - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
        const h = ((lunchEndMin - lunchStartMin) / 60) * HOUR_H;
        blocks.push({ top: topPx, height: h, label: "Lunch", type: "lunch" });
      }
    }

    return blocks;
  }, [availability]);

  // Current time indicator — updates every 60s, only rendered for today
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, [isToday]);

  const nowInRange = isToday && nowMin >= DAY_START * 60 && nowMin < DAY_END * 60;
  const nowTop = ((nowMin - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;

  return (
    <div
      className="relative flex-1 min-w-0 border-r border-border/30 last:border-r-0"
      style={{ height: `${GRID_H}px` }}
    >
      {/* Availability overlays */}
      {overlays.map((block, i) => (
        <div
          key={i}
          className={cn(
            "absolute left-0 right-0 pointer-events-none z-[1]",
            block.type === "closed" ? "bg-foreground/[0.04]" : "bg-foreground/[0.03]",
          )}
          style={{
            top: `${block.top}px`,
            height: `${block.height}px`,
            ...(block.type === "lunch"
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)",
                }
              : {}),
          }}
        >
          {block.label && block.height > 20 && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted/60 uppercase tracking-wide select-none">
              {block.label}
            </span>
          )}
        </div>
      ))}
      {/* Clickable hour slots */}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i).map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 hover:bg-foreground/[0.025] cursor-pointer transition-colors"
          style={{ top: `${(h - DAY_START) * HOUR_H + GRID_TOP_PAD}px`, height: `${HOUR_H}px` }}
          onClick={() => onSlotClick?.(h)}
        />
      ))}
      {/* Events */}
      {laid.map((ev) => (
        <EventBlock
          key={ev.id}
          ev={ev}
          colIndex={ev.colIndex}
          totalCols={ev.totalCols}
          onSelect={onSelect}
        />
      ))}
      {/* Current time indicator */}
      {nowInRange && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: `${nowTop}px` }}
        >
          <div className="absolute -left-[5px] -top-[5px] w-[10px] h-[10px] rounded-full bg-red-500" />
          <div className="absolute left-0 right-0 h-[2px] bg-red-500" />
          <div className="absolute -left-[58px] -top-[9px] bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
            {(() => {
              const h = Math.floor(nowMin / 60);
              const m = nowMin % 60;
              const h12 = h % 12 || 12;
              const ampm = h < 12 ? "am" : "pm";
              return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
