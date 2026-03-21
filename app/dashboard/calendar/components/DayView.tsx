/**
 * @file DayView.tsx
 * @description Single-day time-grid view with availability overlay.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT, GRID_H } from "./constants";
import { DayColumn } from "./DayColumn";
import { fmtDate, isToday, getDayAvailability } from "./helpers";
import { ScrollGrid } from "./ScrollGrid";
import { TimeRuler, HourLines } from "./TimeRuler";
import type { CalEvent, BusinessHourRow, TimeOffRow, LunchBreak } from "./types";

export function DayView({
  cursor,
  events,
  onEventClick,
  onSlotClick,
  businessHours,
  timeOff,
  lunchBreak,
}: {
  cursor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (date: string, h: number) => void;
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
}) {
  const ds = fmtDate(cursor);
  const dayEvents = useMemo(() => events.filter((ev) => ev.date === ds), [events, ds]);
  const today = isToday(ds);
  const avail = useMemo(
    () => getDayAvailability(cursor, businessHours, timeOff, lunchBreak),
    [cursor, businessHours, timeOff, lunchBreak],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex shrink-0 border-b border-border">
        <div className="w-14 shrink-0" />
        <div
          className={cn(
            "flex-1 py-3 text-center border-l border-border/30",
            !avail.isOpen && "bg-surface/50",
          )}
        >
          <p className="text-xs text-muted">{DAY_NAMES_SHORT[cursor.getDay()]}</p>
          <p
            className={cn(
              "text-xl font-semibold mt-0.5 w-10 h-10 flex items-center justify-center rounded-full mx-auto",
              today ? "bg-accent text-white" : "text-foreground",
            )}
          >
            {cursor.getDate()}
          </p>
          {!avail.isOpen && (
            <p className="text-[10px] text-muted/60 mt-1">{avail.blockLabel || "Closed"}</p>
          )}
        </div>
      </div>
      <ScrollGrid>
        <div className="flex" style={{ height: `${GRID_H}px` }}>
          <TimeRuler />
          <div className="flex flex-1 relative">
            <HourLines />
            <DayColumn
              events={dayEvents}
              onSelect={onEventClick}
              onSlotClick={(h) => onSlotClick(ds, h)}
              availability={avail}
              isToday={today}
            />
          </div>
        </div>
      </ScrollGrid>
    </div>
  );
}
