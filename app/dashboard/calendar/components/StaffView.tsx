/**
 * @file StaffView.tsx
 * @description Resource view with one time-grid column per staff member.
 */

"use client";

import { useMemo } from "react";
import { GRID_H } from "./constants";
import { DayColumn } from "./DayColumn";
import { fmtDate, isToday, getDayAvailability } from "./helpers";
import { ScrollGrid } from "./ScrollGrid";
import { TimeRuler, HourLines } from "./TimeRuler";
import type { CalEvent, BusinessHourRow, TimeOffRow, LunchBreak } from "./types";

export function StaffView({
  cursor,
  events,
  staffMembers,
  onEventClick,
  onSlotClick,
  businessHours,
  timeOff,
  lunchBreak,
}: {
  cursor: Date;
  events: CalEvent[];
  staffMembers: string[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (date: string, h: number, staff: string) => void;
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
}) {
  const ds = fmtDate(cursor);

  const byStaff = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const s of staffMembers) map[s] = [];
    for (const ev of events) {
      if (ev.date === ds && ev.staff && map[ev.staff]) {
        map[ev.staff].push(ev);
      }
    }
    return map;
  }, [events, ds, staffMembers]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Staff column headers */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-14 shrink-0" />
        {staffMembers.map((s) => (
          <div key={s} className="flex-1 py-2 text-center border-l border-border/30">
            <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-semibold text-foreground mx-auto mb-0.5">
              {s[0]}
            </div>
            <p className="text-xs font-medium text-foreground">{s}</p>
            <p className="text-[10px] text-muted mt-0.5">
              {byStaff[s].length} appt{byStaff[s].length !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
      {/* Scrollable grid */}
      <ScrollGrid>
        <div className="flex" style={{ height: `${GRID_H}px` }}>
          <TimeRuler />
          <div className="flex flex-1 relative">
            <HourLines />
            {staffMembers.map((s) => (
              <DayColumn
                key={s}
                events={byStaff[s]}
                onSelect={onEventClick}
                onSlotClick={(h) => onSlotClick(ds, h, s)}
                availability={getDayAvailability(cursor, businessHours, timeOff, lunchBreak)}
                isToday={isToday(ds)}
              />
            ))}
          </div>
        </div>
      </ScrollGrid>
    </div>
  );
}
