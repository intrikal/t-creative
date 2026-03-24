"use client";

/**
 * ShiftsContent — Weekly staff schedule grid.
 *
 * Shows a Mon–Sun week grid with one row per assistant.
 * Each cell shows a shift block if that assistant is scheduled that day.
 * Week navigation arrows move ±7 days within the loaded data window
 * (getShifts returns -7 to +14 days from now).
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShiftRow } from "@/lib/types/staff.types";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatWeekRange(start: Date) {
  const end = addDays(start, 6);
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) {
    return `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })}–${end.getDate()}`;
  }
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function statusColor(status: ShiftRow["status"]) {
  switch (status) {
    case "in_progress":
      return {
        bg: "bg-[#4e6b51]/10",
        border: "border-[#4e6b51]/25",
        text: "text-[#4e6b51]",
        dot: "bg-[#4e6b51]",
      };
    case "completed":
      return {
        bg: "bg-foreground/5",
        border: "border-foreground/10",
        text: "text-muted",
        dot: "bg-foreground/20",
      };
    case "cancelled":
      return {
        bg: "bg-destructive/8",
        border: "border-destructive/15",
        text: "text-destructive",
        dot: "bg-destructive/50",
      };
    default:
      return {
        bg: "bg-accent/8",
        border: "border-accent/20",
        text: "text-accent",
        dot: "bg-accent/60",
      };
  }
}

// Parse the raw startsAt/endsAt from ShiftRow — we need actual dates for grid placement.
// getShifts formats date as a string ("Today", "Mar 25") so we rebuild from staffId context.
// Instead we index shifts by their formatted date string against our week grid.
function buildDateKey(d: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  if (isSameDay(d, today)) return "Today";
  if (isSameDay(d, tomorrow)) return "Tomorrow";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ShiftsContent({
  shifts,
  assistantNames,
}: {
  shifts: ShiftRow[];
  assistantNames: { id: string; name: string; initials: string }[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekDayKeys = weekDays.map(buildDateKey);

  // Build lookup: staffId → dateKey → ShiftRow[]
  const shiftMap = new Map<string, Map<string, ShiftRow[]>>();
  for (const shift of shifts) {
    if (!shiftMap.has(shift.staffId)) shiftMap.set(shift.staffId, new Map());
    const inner = shiftMap.get(shift.staffId)!;
    if (!inner.has(shift.date)) inner.set(shift.date, []);
    inner.get(shift.date)!.push(shift);
  }

  // Collect unique staff from shifts + assistantNames prop
  const staffFromShifts = Array.from(
    new Map(
      shifts.map((s) => [
        s.staffId,
        { id: s.staffId, name: s.staffName, initials: s.staffInitials },
      ]),
    ).values(),
  );
  const staffFromNames = assistantNames.filter((a) => !staffFromShifts.find((s) => s.id === a.id));
  const allStaff = [...staffFromShifts, ...staffFromNames];

  // Limit prev navigation to -7 days from today
  const minWeekStart = getWeekStart(addDays(today, -7));
  const maxWeekStart = getWeekStart(addDays(today, 14));
  const canGoPrev = weekStart > minWeekStart;
  const canGoNext = weekStart < maxWeekStart;

  const isCurrentWeek = isSameDay(weekStart, getWeekStart(today));

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4 md:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold">
              Team Schedule
              {isCurrentWeek && (
                <span className="ml-2 text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                  This week
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted mt-0.5">{formatWeekRange(weekStart)}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              disabled={!canGoPrev}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors text-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => setWeekStart(getWeekStart(today))}
                className="text-[10px] font-medium text-accent hover:text-accent/80 px-2 py-1 rounded-lg hover:bg-accent/8 transition-colors"
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg hover:bg-surface transition-colors text-muted disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0 pt-3">
        {allStaff.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center mb-4">
              <CalendarDays className="w-5 h-5 text-muted" />
            </div>
            <p className="text-sm font-semibold text-foreground">No shifts scheduled</p>
            <p className="text-xs text-muted mt-1 max-w-xs">
              Upcoming team shifts will appear here once scheduled.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 640 }}>
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5 w-36">
                    Staff
                  </th>
                  {weekDays.map((d, i) => {
                    const isToday = isSameDay(d, today);
                    return (
                      <th key={i} className="pb-2.5 px-1.5 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                            {DAY_LABELS[i]}
                          </span>
                          <span
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold",
                              isToday ? "bg-accent text-white" : "text-muted",
                            )}
                          >
                            {d.getDate()}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {allStaff.map((staff) => {
                  const staffShifts = shiftMap.get(staff.id);
                  return (
                    <tr key={staff.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 md:px-5 py-3 align-top">
                        <div className="flex items-center gap-2.5">
                          <Avatar size="sm">
                            <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                              {staff.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium text-foreground truncate max-w-[80px]">
                            {staff.name}
                          </span>
                        </div>
                      </td>
                      {weekDayKeys.map((key, i) => {
                        const dayShifts = staffShifts?.get(key) ?? [];
                        const isToday = isSameDay(weekDays[i], today);
                        return (
                          <td
                            key={i}
                            className={cn("px-1.5 py-2 align-top", isToday && "bg-accent/[0.03]")}
                          >
                            {dayShifts.length === 0 ? (
                              <div className="h-8 flex items-center justify-center">
                                <span className="w-4 h-px bg-border/50 block" />
                              </div>
                            ) : (
                              <div className="space-y-1">
                                {dayShifts.map((shift) => {
                                  const c = statusColor(shift.status);
                                  return (
                                    <div
                                      key={shift.id}
                                      className={cn(
                                        "rounded-lg border px-2 py-1.5 text-left",
                                        c.bg,
                                        c.border,
                                      )}
                                    >
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <span
                                          className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.dot)}
                                        />
                                        <span
                                          className={cn(
                                            "text-[10px] font-semibold leading-tight",
                                            c.text,
                                          )}
                                        >
                                          {shift.startTime}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-0.5 text-[10px] text-muted">
                                        <Clock className="w-2.5 h-2.5 shrink-0" />
                                        <span className="tabular-nums">{shift.endTime}</span>
                                      </div>
                                      {shift.bookedSlots > 0 && (
                                        <span className="text-[9px] text-muted mt-0.5 block">
                                          {shift.bookedSlots} booked
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
