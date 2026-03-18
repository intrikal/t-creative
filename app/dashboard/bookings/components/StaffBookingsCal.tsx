"use client";

import { useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MONTH_NAMES, DAY_NAMES, fmtISO, todayISO, getMonthGrid } from "./client-helpers";

const CAT_COLORS: Record<string, string> = {
  lash: "#c4907a",
  jewelry: "#d4a574",
  crochet: "#7ba3a3",
  consulting: "#8b7bb5",
  training: "#9b7ec8",
  "3d_printing": "#6b8fa3",
  aesthetics: "#c4907a",
};

export function StaffBookingsCal({
  entries,
  selected,
  onSelect,
}: {
  entries: { dateISO: string; category: string }[];
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
    const map: Record<string, Set<string>> = {};
    for (const e of entries) {
      if (!map[e.dateISO]) map[e.dateISO] = new Set();
      map[e.dateISO].add(e.category);
    }
    return map;
  }, [entries]);

  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of entries) cats.add(e.category);
    return cats;
  }, [entries]);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Calendar</CardTitle>
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
            const cats = byDate[ds] ? Array.from(byDate[ds]) : [];
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
                      style={{ background: CAT_COLORS[cat] ?? "#999" }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-4 mt-3 pt-3 border-t border-border/40 flex-wrap">
          {Array.from(activeCategories).map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1.5 text-[10px] text-muted capitalize"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: CAT_COLORS[cat] ?? "#999" }}
              />
              {cat.replace("_", " ")}
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
