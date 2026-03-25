"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT, getMonthGrid, fmtDate } from "./helpers";

/**
 * MiniCalendar — compact month grid for navigating dates.
 *
 * Highlights today, the selected date, and days with appointments (dots).
 * Clicking a date calls `onSelect`. Prev/next arrows navigate months.
 */
export function MiniCalendar({
  cursor,
  onCursorChange,
  selectedDate,
  onSelect,
  appointmentDays,
  todayKey,
}: {
  cursor: Date;
  onCursorChange: (d: Date) => void;
  selectedDate: string | null;
  onSelect: (dateKey: string) => void;
  /** Set of "YYYY-MM-DD" strings that have at least one appointment */
  appointmentDays: Set<string>;
  todayKey: string;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = getMonthGrid(year, month);

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function prev() {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - 1);
    onCursorChange(d);
  }

  function next() {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + 1);
    onCursorChange(d);
  }

  return (
    <div className="w-full">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prev}
          className="p-1 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        <button
          onClick={next}
          className="p-1 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-muted/60 py-1">
            {d.charAt(0)}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7">
        {grid.map((date) => {
          const key = fmtDate(date);
          const isCurrentMonth = date.getMonth() === month;
          const isToday = key === todayKey;
          const isSelected = key === selectedDate;
          const hasAppts = appointmentDays.has(key);

          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={cn(
                "relative flex flex-col items-center justify-center py-1.5 text-xs rounded-lg transition-colors",
                !isCurrentMonth && "text-muted/30",
                isCurrentMonth &&
                  !isSelected &&
                  !isToday &&
                  "text-foreground hover:bg-foreground/5",
                isToday && !isSelected && "text-accent font-bold",
                isSelected && "bg-foreground text-background font-semibold",
              )}
            >
              {date.getDate()}
              {hasAppts && !isSelected && (
                <span
                  className={cn(
                    "absolute bottom-0.5 w-1 h-1 rounded-full",
                    isToday ? "bg-accent" : "bg-[#c4907a]",
                  )}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Today shortcut */}
      <button
        onClick={() => {
          onCursorChange(new Date());
          onSelect(todayKey);
        }}
        className="w-full mt-3 text-xs font-medium text-accent hover:underline text-center py-1"
      >
        Go to today
      </button>
    </div>
  );
}
