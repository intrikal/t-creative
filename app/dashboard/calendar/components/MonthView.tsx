/**
 * @file MonthView.tsx
 * @description Month grid calendar view showing day cells with event chips.
 */

"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT, TYPE_C } from "./constants";
import { fmtDate, getMonthGrid, isToday, getDayAvailability } from "./helpers";
import type { CalEvent, BusinessHourRow, TimeOffRow, LunchBreak } from "./types";

export function MonthView({
  cursor,
  events,
  onDayClick,
  onEventClick,
  businessHours,
  timeOff,
  lunchBreak,
}: {
  cursor: Date;
  events: CalEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalEvent) => void;
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  return (
    <div className="flex-1 overflow-auto flex flex-col">
      {/* Day name header */}
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted">
            {d}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div
        className="grid grid-cols-7 flex-1 divide-x divide-y divide-border/50"
        style={{ gridAutoRows: "minmax(100px, 1fr)" }}
      >
        {grid.map((day) => {
          const ds = fmtDate(day);
          const dayEvs = byDate[ds] || [];
          const isCurrentMonth = day.getMonth() === month;
          const today = isToday(ds);
          const avail = getDayAvailability(day, businessHours, timeOff, lunchBreak);
          const MAX = 3;
          return (
            <div
              key={ds}
              className={cn(
                "p-1.5 cursor-pointer hover:bg-foreground/[0.02] transition-colors overflow-hidden",
                !isCurrentMonth && "bg-surface/50",
                isCurrentMonth && !avail.isOpen && "bg-foreground/[0.03]",
              )}
              onClick={() => onDayClick(day)}
            >
              <div className="flex items-center gap-1 mb-1">
                <span
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    today
                      ? "bg-accent text-white font-semibold"
                      : isCurrentMonth
                        ? "text-foreground"
                        : "text-muted/40",
                  )}
                >
                  {day.getDate()}
                </span>
                {isCurrentMonth && !avail.isOpen && (
                  <span className="text-[8px] font-semibold text-muted/50 uppercase tracking-wide">
                    {avail.blockLabel || "Closed"}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {dayEvs.slice(0, MAX).map((ev) => {
                  const c = TYPE_C[ev.type];
                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer hover:brightness-95 transition-all"
                      style={{
                        backgroundColor: c.bg,
                        color: c.text,
                        outline: `1px solid ${c.border}30`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: c.dot }}
                      />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  );
                })}
                {dayEvs.length > MAX && (
                  <p className="text-[10px] text-muted pl-1">+{dayEvs.length - MAX} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
