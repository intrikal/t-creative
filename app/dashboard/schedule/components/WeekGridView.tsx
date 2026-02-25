"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "../actions";
import {
  fmtDate,
  getWeekDays,
  timeToMin,
  fmt12,
  hourLabel,
  DAY_NAMES_SHORT,
  DAY_START,
  HOUR_H,
  GRID_H,
  GRID_TOP_PAD,
  HOURS,
  CATEGORY_COLORS,
} from "./helpers";

export function WeekGridView({
  cursor,
  todayKey,
  appointments,
  onApptClick,
}: {
  cursor: Date;
  todayKey: string;
  appointments: AppointmentRow[];
  onApptClick: (a: AppointmentRow) => void;
}) {
  const days = useMemo(() => getWeekDays(cursor), [cursor]);

  const byDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const a of appointments) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [appointments]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Column headers */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const ds = fmtDate(day);
          const today = ds === todayKey;
          return (
            <div key={ds} className="flex-1 py-2 text-center border-l border-border/30">
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
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: `${GRID_H}px` }}>
          {/* Time ruler */}
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
          {/* Day columns */}
          <div className="flex flex-1 relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-border/40 pointer-events-none z-0"
                style={{ top: `${(h - DAY_START) * HOUR_H + GRID_TOP_PAD}px` }}
              />
            ))}
            {days.map((day) => {
              const ds = fmtDate(day);
              const dayAppts = byDate[ds] || [];
              return (
                <div
                  key={ds}
                  className="relative flex-1 min-w-0 border-r border-border/30 last:border-r-0"
                  style={{ height: `${GRID_H}px` }}
                >
                  {dayAppts.map((a) => {
                    const c = CATEGORY_COLORS[a.category];
                    const top =
                      ((timeToMin(a.startTime24) - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
                    const height = Math.max((a.durationMin / 60) * HOUR_H - 2, 20);
                    return (
                      <div
                        key={a.id}
                        onClick={() => onApptClick(a)}
                        className="absolute rounded-md cursor-pointer overflow-hidden hover:brightness-95 transition-all z-10 left-0.5 right-0.5"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          backgroundColor: c.bg,
                          borderLeft: `2.5px solid ${c.border}`,
                          outline: `1px solid ${c.border}40`,
                        }}
                      >
                        <div className="px-1.5 py-1">
                          <p
                            className="text-[11px] font-semibold leading-tight truncate"
                            style={{ color: c.text }}
                          >
                            {a.client}
                          </p>
                          {height > 36 && (
                            <p
                              className="text-[10px] leading-tight truncate mt-0.5 opacity-80"
                              style={{ color: c.text }}
                            >
                              {fmt12(a.startTime24)} · {a.service}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
