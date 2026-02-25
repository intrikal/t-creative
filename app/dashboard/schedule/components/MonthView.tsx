"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "../actions";
import { fmtDate, getMonthGrid, DAY_NAMES_SHORT, CATEGORY_COLORS, fmt12 } from "./helpers";

export function MonthView({
  cursor,
  todayKey,
  appointments,
  onApptClick,
  onDayClick,
}: {
  cursor: Date;
  todayKey: string;
  appointments: AppointmentRow[];
  onApptClick: (a: AppointmentRow) => void;
  onDayClick: (d: Date) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, AppointmentRow[]> = {};
    for (const a of appointments) {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    }
    return map;
  }, [appointments]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted">
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1 divide-x divide-y divide-border/50 overflow-auto"
        style={{ gridAutoRows: "minmax(90px, 1fr)" }}
      >
        {grid.map((day) => {
          const ds = fmtDate(day);
          const dayAppts = byDate[ds] || [];
          const isCurrentMonth = day.getMonth() === month;
          const today = ds === todayKey;
          const MAX = 3;
          return (
            <div
              key={ds}
              className={cn(
                "p-1.5 cursor-pointer hover:bg-foreground/[0.02] transition-colors overflow-hidden",
                !isCurrentMonth && "bg-surface/50",
              )}
              onClick={() => onDayClick(day)}
            >
              <span
                className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1",
                  today
                    ? "bg-accent text-white font-semibold"
                    : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted/40",
                )}
              >
                {day.getDate()}
              </span>
              <div className="space-y-0.5">
                {dayAppts.slice(0, MAX).map((a) => {
                  const c = CATEGORY_COLORS[a.category];
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onApptClick(a);
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
                      <span className="truncate">
                        {fmt12(a.startTime24)} {a.client}
                      </span>
                    </div>
                  );
                })}
                {dayAppts.length > MAX && (
                  <p className="text-[10px] text-muted pl-1">+{dayAppts.length - MAX} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
