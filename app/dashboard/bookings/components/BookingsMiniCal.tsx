/**
 * Mini calendar widget that shows booking dots per day and acts as a date filter.
 *
 * Related:
 * - app/dashboard/bookings/ClientBookingsPage.tsx (parent)
 * - ./client-helpers.ts (date & category utilities)
 */
"use client";

import { useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientBookingRow } from "../client-actions";
import {
  MONTH_NAMES,
  DAY_NAMES,
  CAT_COLOR,
  type BookingCategory,
  fmtISO,
  todayISO,
  getMonthGrid,
} from "./client-helpers";

export function BookingsMiniCal({
  bookings,
  selected,
  onSelect,
}: {
  bookings: ClientBookingRow[];
  selected: string | null;
  onSelect: (d: string | null) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);
  const today = todayISO();

  const byDate = useMemo(() => {
    const map: Record<string, BookingCategory[]> = {};
    for (const b of bookings) {
      if (!map[b.dateISO]) map[b.dateISO] = [];
      if (!map[b.dateISO].includes(b.category)) {
        map[b.dateISO].push(b.category);
      }
    }
    return map;
  }, [bookings]);

  // Determine which categories exist in the data
  const activeCategories = useMemo(() => {
    const cats = new Set<BookingCategory>();
    for (const b of bookings) cats.add(b.category);
    return cats;
  }, [bookings]);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Appointment Calendar</CardTitle>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-muted hover:bg-foreground/8 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-foreground px-1 min-w-[110px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-muted hover:bg-foreground/8 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-3">
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted/60 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const ds = fmtISO(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = ds === today;
            const isSelected = ds === selected;
            const cats = byDate[ds] || [];
            const hasBookings = cats.length > 0;

            return (
              <div
                key={ds}
                className={cn("flex flex-col items-center py-0.5", !isCurrentMonth && "invisible")}
              >
                <button
                  onClick={() => hasBookings && onSelect(isSelected ? null : ds)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isSelected && "bg-accent text-white",
                    !isSelected && isToday && "ring-1 ring-accent text-accent font-semibold",
                    !isSelected &&
                      !isToday &&
                      hasBookings &&
                      "text-foreground hover:bg-foreground/8 cursor-pointer",
                    !isSelected && !isToday && !hasBookings && "text-muted/35 cursor-default",
                  )}
                >
                  {day.getDate()}
                </button>
                <div className="flex gap-0.5 h-1.5 mt-0.5">
                  {cats.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="w-1 h-1 rounded-full"
                      style={{ background: CAT_COLOR[cat] }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-3 pt-3 border-t border-border/40">
          {(["lash", "jewelry", "crochet", "consulting"] as const)
            .filter((cat) => activeCategories.has(cat))
            .map((cat) => (
              <span
                key={cat}
                className="flex items-center gap-1.5 text-[10px] text-muted capitalize"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLOR[cat] }} />
                {cat}
              </span>
            ))}
          {selected && (
            <button
              onClick={() => onSelect(null)}
              className="ml-auto text-[10px] text-accent hover:underline"
            >
              Show all
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
