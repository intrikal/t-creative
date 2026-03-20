/**
 * @file WeekView.tsx
 * @description Seven-column time-grid view showing one week of events.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT, GRID_H } from "./constants";
import { DayColumn } from "./DayColumn";
import { fmtDate, getWeekDays, isToday, getDayAvailability } from "./helpers";
import { ScrollGrid } from "./ScrollGrid";
import { TimeRuler, HourLines } from "./TimeRuler";
import type { CalEvent, BusinessHourRow, TimeOffRow, LunchBreak } from "./types";

export function WeekView({
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
  const days = useMemo(() => getWeekDays(cursor), [cursor]);

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Column headers */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const ds = fmtDate(day);
          const today = isToday(ds);
          const avail = getDayAvailability(day, businessHours, timeOff, lunchBreak);
          return (
            <div
              key={ds}
              className={cn(
                "flex-1 py-2 text-center border-l border-border/30",
                !avail.isOpen && "bg-surface/50",
              )}
            >
              <p className="text-[11px] text-muted">{DAY_NAMES_SHORT[day.getDay()]}</p>
              <p
                className={cn(
                  "text-sm font-semibold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full mx-auto",
                  today ? "bg-accent text-white" : "text-foreground",
                )}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>
      {/* Scrollable grid */}
      <ScrollGrid>
        <div className="flex" style={{ height: `${GRID_H}px` }}>
          <TimeRuler />
          <div className="flex flex-1 relative">
            <HourLines />
            {days.map((day) => {
              const ds = fmtDate(day);
              return (
                <DayColumn
                  key={ds}
                  events={byDate[ds] || []}
                  onSelect={onEventClick}
                  onSlotClick={(h) => onSlotClick(ds, h)}
                  availability={getDayAvailability(day, businessHours, timeOff, lunchBreak)}
                  isToday={isToday(ds)}
                />
              );
            })}
          </div>
        </div>
      </ScrollGrid>
    </div>
  );
}
