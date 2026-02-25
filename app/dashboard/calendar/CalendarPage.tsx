"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Clock,
  User,
  MapPin,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { createBooking, updateBooking, deleteBooking } from "../bookings/actions";
import type { BookingRow, BookingInput } from "../bookings/actions";
import type { EventRow } from "../events/actions";
import type { BusinessHourRow, LunchBreak, TimeOffRow } from "../settings/hours-actions";
import {
  saveBusinessHours,
  saveLunchBreak,
  addTimeOff,
  deleteTimeOff,
} from "../settings/hours-actions";

/* ------------------------------------------------------------------ */
/*  Availability types & helpers                                       */
/* ------------------------------------------------------------------ */

/** Resolved availability for a single calendar day. */
interface DayAvailability {
  isOpen: boolean;
  opensAt: string | null; // "HH:MM"
  closesAt: string | null; // "HH:MM"
  isBlocked: boolean;
  blockLabel?: string;
  lunchStart: string | null;
  lunchEnd: string | null;
}

/**
 * Given a JS Date, business hours (ISO weekday 1-7), time-off rows, and lunch
 * config, return the resolved availability for that day.
 */
function getDayAvailability(
  day: Date,
  businessHours: BusinessHourRow[],
  timeOffRows: TimeOffRow[],
  lunchBreak: LunchBreak | null,
): DayAvailability {
  const ds = fmtDate(day);
  // JS getDay() returns 0=Sun…6=Sat → convert to ISO 1=Mon…7=Sun
  const jsDay = day.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;

  const bh = businessHours.find((h) => h.dayOfWeek === isoDay);
  const isOpen = bh?.isOpen ?? false;

  // Check if date falls within any time-off range
  const blocked = timeOffRows.find((t) => ds >= t.startDate && ds <= t.endDate);

  return {
    isOpen: blocked ? false : isOpen,
    opensAt: isOpen ? (bh?.opensAt ?? null) : null,
    closesAt: isOpen ? (bh?.closesAt ?? null) : null,
    isBlocked: !!blocked,
    blockLabel:
      blocked?.label ??
      (blocked ? (blocked.type === "vacation" ? "Vacation" : "Day Off") : undefined),
    lunchStart: lunchBreak?.enabled ? lunchBreak.start : null,
    lunchEnd: lunchBreak?.enabled ? lunchBreak.end : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const HOUR_H = 64; // px per hour in the time grid
const DAY_START = 8; // 8 am
const DAY_END = 20; // 8 pm
const TOTAL_HOURS = DAY_END - DAY_START; // 12
const GRID_H = TOTAL_HOURS * HOUR_H + 12; // +12px top padding so first label isn't clipped
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START + i);
const GRID_TOP_PAD = 12; // px — matches the +12 above
const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type EventType = "lash" | "jewelry" | "crochet" | "training" | "event" | "blocked";
type View = "month" | "week" | "day" | "staff" | "agenda";

interface CalEvent {
  id: number;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM (24-hour)
  durationMin: number;
  staff?: string;
  client?: string;
  location?: string;
  notes?: string;
  // DB tracking — present for events loaded from bookings table
  bookingId?: number;
  clientId?: string;
  serviceId?: number;
  staffId?: string | null;
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

let _nextId = 100;
function nextId() {
  return ++_nextId;
}

function categoryToEventType(category: string): EventType {
  if (category === "lash" || category === "jewelry" || category === "crochet") return category;
  if (category === "training") return "training";
  return "event";
}

function mapBookingToCalEvent(row: BookingRow): CalEvent {
  const d = new Date(row.startsAt);
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const startTime = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const clientName = [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ");

  return {
    id: row.id,
    title: row.serviceName,
    type: categoryToEventType(row.serviceCategory),
    date,
    startTime,
    durationMin: row.durationMinutes,
    staff: row.staffFirstName ?? undefined,
    client: clientName || undefined,
    location: row.location ?? undefined,
    notes: row.clientNotes ?? undefined,
    bookingId: row.id,
    clientId: row.clientId,
    serviceId: row.serviceId,
    staffId: row.staffId,
    status: row.status,
  };
}

/* Mock data removed — calendar now uses real bookings from DB */

/* ------------------------------------------------------------------ */
/*  Colors                                                              */
/* ------------------------------------------------------------------ */

const TYPE_C: Record<EventType, { bg: string; border: string; text: string; dot: string }> = {
  lash: { bg: "#c4907a1a", border: "#c4907a", text: "#96604a", dot: "#c4907a" },
  jewelry: { bg: "#d4a5741a", border: "#d4a574", text: "#a07040", dot: "#d4a574" },
  crochet: { bg: "#7ba3a31a", border: "#7ba3a3", text: "#3a6a6a", dot: "#7ba3a3" },
  training: { bg: "#22c55e1a", border: "#22c55e", text: "#15803d", dot: "#22c55e" },
  event: { bg: "#8b5cf61a", border: "#8b5cf6", text: "#6d28d9", dot: "#8b5cf6" },
  blocked: { bg: "#e5e7eb", border: "#d1d5db", text: "#6b7280", dot: "#9ca3af" },
};

const TYPE_LABELS: Record<EventType, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  training: "Training",
  event: "Event",
  blocked: "Blocked",
};

/* ------------------------------------------------------------------ */
/*  Time / date helpers                                                 */
/* ------------------------------------------------------------------ */

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date {
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(y, mo - 1, d);
}

/** Format a Date as "YYYY-MM-DD" for DB storage. */
function fmtDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function getWeekDays(anchor: Date): Date[] {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = addDays(first, -first.getDay());
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

const TODAY = fmtDate(new Date());

function isToday(dateStr: string): boolean {
  return dateStr === TODAY;
}

function hourLabel(h: number): string {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

/* ------------------------------------------------------------------ */
/*  Overlap layout for time-grid views                                  */
/* ------------------------------------------------------------------ */

interface Placed extends CalEvent {
  colIndex: number;
  totalCols: number;
}

function layoutDay(events: CalEvent[]): Placed[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
  const colEnds: number[] = [];
  const placed: (CalEvent & { colIndex: number })[] = [];
  for (const ev of sorted) {
    const start = timeToMin(ev.startTime);
    const end = start + ev.durationMin;
    let col = colEnds.findIndex((e) => e <= start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(end);
    } else colEnds[col] = end;
    placed.push({ ...ev, colIndex: col });
  }
  const totalCols = Math.max(colEnds.length, 1);
  return placed.map((p) => ({ ...p, totalCols }));
}

/* ------------------------------------------------------------------ */
/*  EventBlock — used in all time-grid views                           */
/* ------------------------------------------------------------------ */

function EventBlock({
  ev,
  colIndex,
  totalCols,
  onSelect,
}: {
  ev: CalEvent;
  colIndex: number;
  totalCols: number;
  onSelect: (e: CalEvent) => void;
}) {
  const c = TYPE_C[ev.type];
  const top = ((timeToMin(ev.startTime) - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
  const height = Math.max((ev.durationMin / 60) * HOUR_H - 2, 20);
  const wPct = 100 / totalCols;
  const lPct = colIndex * wPct;

  return (
    <div
      onClick={() => onSelect(ev)}
      className="absolute rounded-md cursor-pointer overflow-hidden hover:brightness-95 transition-all z-10"
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${lPct}% + 2px)`,
        width: `calc(${wPct}% - 4px)`,
        backgroundColor: c.bg,
        borderLeft: `2.5px solid ${c.border}`,
        outline: `1px solid ${c.border}40`,
      }}
    >
      <div className="px-1.5 py-1">
        <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: c.text }}>
          {ev.title}
        </p>
        {height > 36 && (
          <p
            className="text-[10px] leading-tight truncate mt-0.5 opacity-80"
            style={{ color: c.text }}
          >
            {fmt12(ev.startTime)}
            {ev.client ? ` · ${ev.client}` : ev.staff ? ` · ${ev.staff}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DayColumn — renders hour slots + events for one column             */
/* ------------------------------------------------------------------ */

function DayColumn({
  events,
  onSelect,
  onSlotClick,
  availability,
}: {
  events: CalEvent[];
  onSelect: (e: CalEvent) => void;
  onSlotClick?: (h: number) => void;
  availability?: DayAvailability;
}) {
  const laid = useMemo(() => layoutDay(events), [events]);

  // Compute overlay blocks for unavailable time
  const overlays = useMemo(() => {
    if (!availability) return [];
    const blocks: { top: number; height: number; label?: string; type: "closed" | "lunch" }[] = [];

    if (!availability.isOpen) {
      // Whole day closed / blocked
      blocks.push({
        top: GRID_TOP_PAD,
        height: TOTAL_HOURS * HOUR_H,
        label: availability.isBlocked ? availability.blockLabel : "Closed",
        type: "closed",
      });
      return blocks;
    }

    // Before opening
    if (availability.opensAt) {
      const openMin = timeToMin(availability.opensAt);
      const startMin = DAY_START * 60;
      if (openMin > startMin) {
        const h = ((openMin - startMin) / 60) * HOUR_H;
        blocks.push({ top: GRID_TOP_PAD, height: h, type: "closed" });
      }
    }

    // After closing
    if (availability.closesAt) {
      const closeMin = timeToMin(availability.closesAt);
      const endMin = DAY_END * 60;
      if (closeMin < endMin) {
        const topPx = ((closeMin - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
        const h = ((endMin - closeMin) / 60) * HOUR_H;
        blocks.push({ top: topPx, height: h, type: "closed" });
      }
    }

    // Lunch break
    if (availability.lunchStart && availability.lunchEnd) {
      const lunchStartMin = timeToMin(availability.lunchStart);
      const lunchEndMin = timeToMin(availability.lunchEnd);
      if (lunchStartMin >= DAY_START * 60 && lunchEndMin <= DAY_END * 60) {
        const topPx = ((lunchStartMin - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
        const h = ((lunchEndMin - lunchStartMin) / 60) * HOUR_H;
        blocks.push({ top: topPx, height: h, label: "Lunch", type: "lunch" });
      }
    }

    return blocks;
  }, [availability]);

  return (
    <div
      className="relative flex-1 min-w-0 border-r border-border/30 last:border-r-0"
      style={{ height: `${GRID_H}px` }}
    >
      {/* Availability overlays */}
      {overlays.map((block, i) => (
        <div
          key={i}
          className={cn(
            "absolute left-0 right-0 pointer-events-none z-[1]",
            block.type === "closed" ? "bg-foreground/[0.04]" : "bg-foreground/[0.03]",
          )}
          style={{
            top: `${block.top}px`,
            height: `${block.height}px`,
            ...(block.type === "lunch"
              ? {
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(0,0,0,0.03) 4px, rgba(0,0,0,0.03) 8px)",
                }
              : {}),
          }}
        >
          {block.label && block.height > 20 && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted/60 uppercase tracking-wide select-none">
              {block.label}
            </span>
          )}
        </div>
      ))}
      {/* Clickable hour slots */}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => DAY_START + i).map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 hover:bg-foreground/[0.025] cursor-pointer transition-colors"
          style={{ top: `${(h - DAY_START) * HOUR_H + GRID_TOP_PAD}px`, height: `${HOUR_H}px` }}
          onClick={() => onSlotClick?.(h)}
        />
      ))}
      {/* Events */}
      {laid.map((ev) => (
        <EventBlock
          key={ev.id}
          ev={ev}
          colIndex={ev.colIndex}
          totalCols={ev.totalCols}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TimeRuler — left side hour labels                                  */
/* ------------------------------------------------------------------ */

function TimeRuler() {
  return (
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
  );
}

/* ------------------------------------------------------------------ */
/*  HourLines — background grid lines across all columns               */
/* ------------------------------------------------------------------ */

function HourLines() {
  return (
    <>
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-border/40 pointer-events-none z-0"
          style={{ top: `${(h - DAY_START) * HOUR_H + GRID_TOP_PAD}px` }}
        />
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  MonthView                                                           */
/* ------------------------------------------------------------------ */

function MonthView({
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

/* ------------------------------------------------------------------ */
/*  ScrollGrid — scrollable time grid wrapper                          */
/* ------------------------------------------------------------------ */

function ScrollGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-auto">{children}</div>;
}

/* ------------------------------------------------------------------ */
/*  WeekView                                                            */
/* ------------------------------------------------------------------ */

function WeekView({
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
                />
              );
            })}
          </div>
        </div>
      </ScrollGrid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DayView                                                             */
/* ------------------------------------------------------------------ */

function DayView({
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
            />
          </div>
        </div>
      </ScrollGrid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StaffView — resource view, one column per staff member             */
/* ------------------------------------------------------------------ */

function StaffView({
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
              />
            ))}
          </div>
        </div>
      </ScrollGrid>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AgendaView                                                          */
/* ------------------------------------------------------------------ */

function AgendaView({
  cursor,
  events,
  onEventClick,
}: {
  cursor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
}) {
  const fromDate = fmtDate(cursor);

  const grouped = useMemo(() => {
    const future = events
      .filter((ev) => ev.date >= fromDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const map: { date: string; events: CalEvent[] }[] = [];
    for (const ev of future) {
      const last = map[map.length - 1];
      if (last && last.date === ev.date) last.events.push(ev);
      else map.push({ date: ev.date, events: [ev] });
    }
    return map;
  }, [events, fromDate]);

  if (!grouped.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted">No upcoming events.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="space-y-8 max-w-2xl mx-auto">
        {grouped.map(({ date, events: dayEvs }) => {
          const d = parseDate(date);
          const today = isToday(date);
          return (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={cn(
                    "text-center min-w-[48px] py-1.5 px-2 rounded-xl",
                    today ? "bg-accent text-white" : "bg-surface border border-border",
                  )}
                >
                  <p
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide",
                      today ? "text-white/80" : "text-muted",
                    )}
                  >
                    {DAY_NAMES_SHORT[d.getDay()]}
                  </p>
                  <p
                    className={cn(
                      "text-lg font-bold leading-none mt-0.5",
                      today ? "text-white" : "text-foreground",
                    )}
                  >
                    {d.getDate()}
                  </p>
                </div>
                <div className="flex-1 border-t border-border" />
                <span className="text-xs text-muted font-medium">
                  {MONTH_NAMES[d.getMonth()]} {d.getFullYear()}
                </span>
              </div>
              <div className="space-y-2 pl-2">
                {dayEvs.map((ev) => {
                  const c = TYPE_C[ev.type];
                  return (
                    <div
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface cursor-pointer hover:bg-background transition-colors group"
                    >
                      <div
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ background: c.dot }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{ev.title}</p>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium shrink-0"
                            style={{ backgroundColor: c.bg, color: c.text }}
                          >
                            {TYPE_LABELS[ev.type]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmt12(ev.startTime)} · {ev.durationMin}min
                          </span>
                          {ev.staff && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <User className="w-3 h-3" /> {ev.staff}
                            </span>
                          )}
                          {ev.client && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Users className="w-3 h-3" /> {ev.client}
                            </span>
                          )}
                          {ev.location && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {ev.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EventDetailDialog                                                   */
/* ------------------------------------------------------------------ */

function EventDetailDialog({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const c = TYPE_C[event.type];
  const d = parseDate(event.date);

  return (
    <Dialog open title={event.title} onClose={onClose}>
      <div className="space-y-4">
        <span
          className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: c.bg, color: c.text, outline: `1px solid ${c.border}40` }}
        >
          {TYPE_LABELS[event.type]}
        </span>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <CalendarDays className="w-4 h-4 shrink-0" />
            <span>
              {DAY_NAMES_SHORT[d.getDay()]}, {MONTH_NAMES[d.getMonth()]} {d.getDate()}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {fmt12(event.startTime)} · {event.durationMin} min
            </span>
          </div>
          {event.staff && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <User className="w-4 h-4 shrink-0" />
              <span>{event.staff}</span>
            </div>
          )}
          {event.client && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <Users className="w-4 h-4 shrink-0" />
              <span>{event.client}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <MapPin className="w-4 h-4 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}
          {event.notes && (
            <p className="text-sm text-muted bg-surface rounded-lg p-3 border border-border">
              {event.notes}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  EventFormDialog — create / edit                                     */
/* ------------------------------------------------------------------ */

interface FormState {
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  durationMin: number;
  staff: string;
  client: string;
  location: string;
  notes: string;
  // DB IDs for server actions
  serviceId: number | "";
  clientId: string;
  staffId: string;
}

const BLANK_FORM: FormState = {
  title: "",
  type: "lash",
  date: "",
  startTime: "09:00",
  durationMin: 60,
  staff: "",
  client: "",
  location: "",
  notes: "",
  serviceId: "",
  clientId: "",
  staffId: "",
};

function EventFormDialog({
  open,
  title,
  initial,
  onClose,
  onSave,
  clients,
  serviceOptions,
  staffOptions,
}: {
  open: boolean;
  title: string;
  initial: FormState;
  onClose: () => void;
  onSave: (f: FormState) => void;
  clients: { id: string; name: string; phone: string | null }[];
  serviceOptions: {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
  }[];
  staffOptions: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function onServiceChange(serviceId: number | "") {
    if (!serviceId) {
      setForm((prev) => ({ ...prev, serviceId: "", title: "", type: "lash" as EventType }));
      return;
    }
    const svc = serviceOptions.find((s) => s.id === serviceId);
    if (svc) {
      setForm((prev) => ({
        ...prev,
        serviceId,
        title: svc.name,
        type: categoryToEventType(svc.category),
        durationMin: svc.durationMinutes,
      }));
    }
  }

  function onClientChange(clientId: string) {
    const c = clients.find((cl) => cl.id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId,
      client: c?.name ?? "",
    }));
  }

  function onStaffChange(staffId: string) {
    const s = staffOptions.find((st) => st.id === staffId);
    setForm((prev) => ({
      ...prev,
      staffId,
      staff: s?.name ?? "",
    }));
  }

  const valid = form.serviceId !== "" && form.clientId !== "" && form.date.trim() !== "";

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Service" required>
            <Select
              value={form.serviceId}
              onChange={(e) => onServiceChange(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select service…</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client" required>
            <Select value={form.clientId} onChange={(e) => onClientChange(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
          </Field>
          <Field label="Start time">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime")(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration">
            <Select
              value={String(form.durationMin)}
              onChange={(e) => set("durationMin")(Number(e.target.value))}
            >
              {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Staff">
            <Select value={form.staffId} onChange={(e) => onStaffChange(e.target.value)}>
              <option value="">Unassigned</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Location">
          <Input
            value={form.location}
            onChange={(e) => set("location")(e.target.value)}
            placeholder="e.g. Studio, Valley Fair"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
            placeholder="Any extra details..."
            rows={2}
          />
        </Field>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => onSave(form)}
        confirmLabel="Save"
        disabled={!valid}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Period label                                                        */
/* ------------------------------------------------------------------ */

function periodLabel(view: View, cursor: Date): string {
  if (view === "month") {
    return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }
  if (view === "week") {
    const days = getWeekDays(cursor);
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth()) {
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${DAY_NAMES_SHORT[cursor.getDay()]}, ${MONTH_NAMES[cursor.getMonth()]} ${cursor.getDate()}, ${cursor.getFullYear()}`;
}

function navigate(view: View, cursor: Date, dir: 1 | -1): Date {
  const d = new Date(cursor);
  if (view === "month") {
    d.setMonth(d.getMonth() + dir);
    return d;
  }
  if (view === "week") {
    d.setDate(d.getDate() + dir * 7);
    return d;
  }
  d.setDate(d.getDate() + dir);
  return d;
}

/* ------------------------------------------------------------------ */
/*  Availability tab (editable)                                        */
/* ------------------------------------------------------------------ */

const AVAIL_DAY_NAMES = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Generate time options in 15-min increments from 06:00 to 22:00. */
const TIME_OPTIONS = (() => {
  const opts: { value: string; label: string }[] = [];
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) break;
      const val = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h % 12 || 12;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      opts.push({ value: val, label });
    }
  }
  return opts;
})();

function TimeSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "px-2.5 py-1.5 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 transition appearance-none cursor-pointer",
        className,
      )}
    >
      {TIME_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function AvailToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn(
        "relative w-10 h-[22px] rounded-full overflow-hidden transition-colors shrink-0",
        on ? "bg-accent" : "bg-foreground/20",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
          on ? "translate-x-[22px]" : "translate-x-[3px]",
        )}
      />
    </button>
  );
}

function AvailabilityTab({
  businessHours,
  timeOff: initialTimeOff,
  lunchBreak: initialLunchBreak,
}: {
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
}) {
  const [days, setDays] = useState(() =>
    [...businessHours]
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((h) => ({
        id: h.id,
        dayOfWeek: h.dayOfWeek,
        isOpen: h.isOpen,
        opensAt: h.opensAt ?? "09:00",
        closesAt: h.closesAt ?? "18:00",
      })),
  );
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursSaved, setHoursSaved] = useState(false);

  const [lunch, setLunch] = useState<LunchBreak>(
    initialLunchBreak ?? { enabled: false, start: "12:00", end: "13:00" },
  );
  const [lunchSaving, setLunchSaving] = useState(false);
  const [lunchSaved, setLunchSaved] = useState(false);

  const [blocked, setBlocked] = useState(initialTimeOff);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addType, setAddType] = useState<"day_off" | "vacation">("day_off");
  const [addStart, setAddStart] = useState("");
  const [addEnd, setAddEnd] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [adding, setAdding] = useState(false);

  const openDays = days.filter((d) => d.isOpen);

  async function handleSaveHours() {
    setHoursSaving(true);
    try {
      await saveBusinessHours(
        days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          isOpen: d.isOpen,
          opensAt: d.isOpen ? d.opensAt : null,
          closesAt: d.isOpen ? d.closesAt : null,
        })),
      );
      setHoursSaved(true);
      setTimeout(() => setHoursSaved(false), 2000);
    } finally {
      setHoursSaving(false);
    }
  }

  async function handleSaveLunch() {
    setLunchSaving(true);
    try {
      await saveLunchBreak(lunch);
      setLunchSaved(true);
      setTimeout(() => setLunchSaved(false), 2000);
    } finally {
      setLunchSaving(false);
    }
  }

  async function handleAddBlocked() {
    if (!addStart) return;
    setAdding(true);
    try {
      const row = await addTimeOff({
        type: addType,
        startDate: addStart,
        endDate: addType === "day_off" ? addStart : addEnd || addStart,
        label: addLabel || undefined,
      });
      setBlocked((prev) => [...prev, row]);
      setShowAddForm(false);
      setAddStart("");
      setAddEnd("");
      setAddLabel("");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteBlocked(id: number) {
    await deleteTimeOff(id);
    setBlocked((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Studio Availability</h2>
          <p className="text-xs text-muted mt-0.5">
            {openDays.length} day{openDays.length !== 1 ? "s" : ""} open per week
          </p>
        </div>

        {/* Weekly Schedule */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Weekly Schedule
            </p>
          </div>
          <div className="px-5 pb-4 space-y-0.5">
            {days.map((row, idx) => (
              <div
                key={row.dayOfWeek}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface/60 transition-colors"
              >
                <span
                  className={cn(
                    "text-sm w-24 shrink-0 font-medium",
                    row.isOpen ? "text-foreground" : "text-muted/50",
                  )}
                >
                  {AVAIL_DAY_NAMES[row.dayOfWeek]}
                </span>
                <div className="flex-1 flex items-center gap-2">
                  {row.isOpen ? (
                    <>
                      <TimeSelect
                        value={row.opensAt}
                        onChange={(v) =>
                          setDays((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, opensAt: v } : d)),
                          )
                        }
                      />
                      <span className="text-muted text-xs shrink-0">to</span>
                      <TimeSelect
                        value={row.closesAt}
                        onChange={(v) =>
                          setDays((prev) =>
                            prev.map((d, i) => (i === idx ? { ...d, closesAt: v } : d)),
                          )
                        }
                      />
                    </>
                  ) : (
                    <span className="text-sm text-muted/40 italic">Closed</span>
                  )}
                </div>
                <AvailToggle
                  on={row.isOpen}
                  onChange={() =>
                    setDays((prev) =>
                      prev.map((d, i) => (i === idx ? { ...d, isOpen: !d.isOpen } : d)),
                    )
                  }
                />
              </div>
            ))}
            <div className="flex justify-end pt-3 border-t border-border/50 mt-2">
              <button
                onClick={handleSaveHours}
                disabled={hoursSaving}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {hoursSaved ? "Saved!" : hoursSaving ? "Saving…" : "Save Hours"}
              </button>
            </div>
          </div>
        </div>

        {/* Lunch Break */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Lunch Break
            </p>
          </div>
          <div className="px-5 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-4 py-0.5">
              <div className="min-w-0">
                <p className="text-sm text-foreground">Block lunch break</p>
                <p className="text-xs text-muted mt-0.5">
                  Prevent bookings during your lunch window
                </p>
              </div>
              <AvailToggle
                on={lunch.enabled}
                onChange={(v) => setLunch((prev) => ({ ...prev, enabled: v }))}
              />
            </div>
            {lunch.enabled && (
              <div className="flex items-center gap-3 pl-1">
                <TimeSelect
                  value={lunch.start}
                  onChange={(v) => setLunch((prev) => ({ ...prev, start: v }))}
                />
                <span className="text-muted text-xs shrink-0">to</span>
                <TimeSelect
                  value={lunch.end}
                  onChange={(v) => setLunch((prev) => ({ ...prev, end: v }))}
                />
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-border/50">
              <button
                onClick={handleSaveLunch}
                disabled={lunchSaving}
                className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors flex items-center gap-1.5 disabled:opacity-60"
              >
                {lunchSaved ? "Saved!" : lunchSaving ? "Saving…" : "Save Lunch Break"}
              </button>
            </div>
          </div>
        </div>

        {/* Blocked Dates */}
        <div className="bg-background border border-border rounded-2xl overflow-hidden">
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Blocked Dates
              </p>
              <button
                onClick={() => setShowAddForm((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-foreground/5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
          <div className="px-5 pb-4 space-y-3">
            {showAddForm && (
              <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
                {/* Type toggle */}
                <div className="flex gap-2">
                  {(["day_off", "vacation"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setAddType(t);
                        if (t === "day_off") setAddEnd("");
                      }}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                        addType === t
                          ? "bg-accent text-white"
                          : "bg-foreground/5 text-muted hover:text-foreground",
                      )}
                    >
                      {t === "day_off" ? "Day Off" : "Vacation"}
                    </button>
                  ))}
                </div>

                {/* Calendar picker */}
                <div className="flex justify-center">
                  {addType === "day_off" ? (
                    <DatePicker
                      mode="single"
                      selected={addStart ? parseDate(addStart) : undefined}
                      onSelect={(day) => {
                        setAddStart(day ? fmtDateISO(day) : "");
                        setAddEnd("");
                      }}
                      disabled={{ before: new Date() }}
                      className="!bg-transparent"
                    />
                  ) : (
                    <DatePicker
                      mode="range"
                      selected={
                        addStart
                          ? {
                              from: parseDate(addStart),
                              to: addEnd ? parseDate(addEnd) : undefined,
                            }
                          : undefined
                      }
                      onSelect={(range) => {
                        setAddStart(range?.from ? fmtDateISO(range.from) : "");
                        setAddEnd(range?.to ? fmtDateISO(range.to) : "");
                      }}
                      disabled={{ before: new Date() }}
                      className="!bg-transparent"
                    />
                  )}
                </div>

                {/* Selected date display + label */}
                {addStart && (
                  <div className="space-y-3">
                    <p className="text-sm text-foreground text-center">
                      {addType === "day_off"
                        ? parseDate(addStart).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : addEnd
                          ? `${parseDate(addStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${parseDate(addEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                          : `Starting ${parseDate(addStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} — select end date`}
                    </p>
                    <input
                      type="text"
                      value={addLabel}
                      onChange={(e) => setAddLabel(e.target.value)}
                      placeholder="Label (optional) — e.g. Hawaii trip"
                      className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setAddStart("");
                      setAddEnd("");
                      setAddLabel("");
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-muted rounded-lg hover:bg-foreground/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddBlocked}
                    disabled={!addStart || (addType === "vacation" && !addEnd) || adding}
                    className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
                  >
                    {adding ? "Adding…" : addType === "day_off" ? "Block Day" : "Block Dates"}
                  </button>
                </div>
              </div>
            )}

            {blocked.length === 0 && !showAddForm && (
              <p className="text-sm text-muted/50 italic text-center py-4">
                No blocked dates — your schedule is fully open.
              </p>
            )}

            {blocked.map((entry) => {
              const startD = parseDate(entry.startDate);
              const endD = parseDate(entry.endDate);
              const sameDay = entry.startDate === entry.endDate;
              const fmtD = (d: Date) =>
                d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-surface/60"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                          entry.type === "day_off"
                            ? "bg-amber-50 text-amber-600"
                            : "bg-blue-50 text-blue-600",
                        )}
                      >
                        {entry.type === "day_off" ? "Day Off" : "Vacation"}
                      </span>
                      {entry.label && (
                        <span className="text-sm font-medium text-foreground truncate">
                          {entry.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {sameDay ? fmtD(startD) : `${fmtD(startD)} – ${fmtD(endD)}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteBlocked(entry.id)}
                    className="text-muted hover:text-destructive transition-colors shrink-0 p-1.5 rounded-lg hover:bg-destructive/10"
                    title="Remove blocked date"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Events tab (DB-backed)                                             */
/* ------------------------------------------------------------------ */

const EVENT_TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> =
  {
    bridal: {
      label: "Bridal Party",
      color: "text-pink-700",
      bg: "bg-pink-50",
      border: "border-pink-100",
    },
    pop_up: {
      label: "Pop-Up",
      color: "text-[#a07040]",
      bg: "bg-[#d4a574]/10",
      border: "border-[#d4a574]/25",
    },
    travel: {
      label: "Travel",
      color: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-100",
    },
    private_party: {
      label: "Private Party",
      color: "text-purple-700",
      bg: "bg-purple-50",
      border: "border-purple-100",
    },
    workshop: {
      label: "Workshop",
      color: "text-[#4e6b51]",
      bg: "bg-[#4e6b51]/10",
      border: "border-[#4e6b51]/20",
    },
    birthday: {
      label: "Birthday",
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-100",
    },
    corporate: {
      label: "Corporate",
      color: "text-slate-700",
      bg: "bg-slate-50",
      border: "border-slate-200",
    },
  };

const EVENT_STATUS_CFG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  upcoming: {
    label: "Upcoming",
    color: "text-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/10",
    border: "border-[#5b8a8a]/20",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  completed: {
    label: "Completed",
    color: "text-muted",
    bg: "bg-foreground/8",
    border: "border-foreground/15",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
  draft: {
    label: "Draft",
    color: "text-muted",
    bg: "bg-foreground/5",
    border: "border-foreground/10",
  },
};

function fmtEventDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function fmtEventRange(startsAt: string, endsAt: string | null) {
  const date = fmtEventDate(startsAt);
  const start = fmtEventTime(startsAt);
  if (!endsAt) return `${date} · ${start}`;
  return `${date} · ${start} – ${fmtEventTime(endsAt)}`;
}

function EventsTab({ events }: { events: EventRow[] }) {
  const upcoming = events.filter(
    (e) => e.status === "upcoming" || e.status === "confirmed" || e.status === "draft",
  );
  const past = events.filter((e) => e.status === "completed" || e.status === "cancelled");

  const totalGuests = upcoming.reduce((s, e) => s + e.guests.length, 0);
  const totalRevenue = upcoming.reduce((s, e) => s + (e.expectedRevenueInCents ?? 0), 0);

  function EventCard({ ev }: { ev: EventRow }) {
    const typeCfg = EVENT_TYPE_CFG[ev.eventType] ?? EVENT_TYPE_CFG.workshop;
    const statusCfg = EVENT_STATUS_CFG[ev.status] ?? EVENT_STATUS_CFG.draft;
    const guestCount = ev.guests.length;
    const maxAtt = ev.maxAttendees ?? 0;
    const fillPct = maxAtt > 0 ? Math.round((guestCount / maxAtt) * 100) : 0;

    return (
      <div className="group bg-background border border-border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-sm transition-all">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                statusCfg.color,
                statusCfg.bg,
                statusCfg.border,
              )}
            >
              {statusCfg.label}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                typeCfg.color,
                typeCfg.bg,
                typeCfg.border,
              )}
            >
              {typeCfg.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{ev.title}</h3>
        </div>

        {ev.description && (
          <p className="text-xs text-muted leading-relaxed line-clamp-2">{ev.description}</p>
        )}

        <div className="space-y-1.5 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span>{fmtEventRange(ev.startsAt, ev.endsAt)}</span>
          </div>
          {ev.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {ev.location}
                {ev.address ? ` · ${ev.address}` : ""}
              </span>
            </div>
          )}
        </div>

        {maxAtt > 0 && (
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {guestCount}/{maxAtt} guests
                </span>
                <span>{fillPct}%</span>
              </div>
              <div className="w-full h-1.5 bg-foreground/8 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    fillPct >= 100 ? "bg-[#a07040]" : "bg-[#4e6b51]",
                  )}
                  style={{ width: `${Math.min(fillPct, 100)}%` }}
                />
              </div>
            </div>
            {ev.expectedRevenueInCents != null && ev.expectedRevenueInCents > 0 && (
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-foreground">
                  ${(ev.expectedRevenueInCents / 100).toLocaleString()}
                </p>
                <p className="text-[10px] text-muted">expected</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Events</h2>
          <p className="text-xs text-muted mt-0.5">
            Pop-ups, workshops, training days, and parties.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Upcoming</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{upcoming.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Total Guests</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{totalGuests}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
            Expected Revenue
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            ${(totalRevenue / 100).toLocaleString()}
          </p>
        </div>
      </div>

      {events.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted">No events yet. Create one from the Events page.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Upcoming</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {upcoming.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Past</p>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {past.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  View config                                                         */
/* ------------------------------------------------------------------ */

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "staff", label: "Staff" },
  { key: "agenda", label: "Agenda" },
];

const CAL_PAGE_TABS = [
  { id: "calendar", label: "Calendar" },
  { id: "availability", label: "Availability" },
  { id: "events", label: "Events" },
] as const;
type CalPageTab = (typeof CAL_PAGE_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  CalendarPage                                                        */
/* ------------------------------------------------------------------ */

export function CalendarPage({
  initialBookings,
  clients,
  serviceOptions,
  staffOptions,
  businessHours,
  timeOff,
  lunchBreak,
  events: initialEventRows,
}: {
  initialBookings: BookingRow[];
  clients: { id: string; name: string; phone: string | null }[];
  serviceOptions: {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
  }[];
  staffOptions: { id: string; name: string }[];
  businessHours: BusinessHourRow[];
  timeOff: TimeOffRow[];
  lunchBreak: LunchBreak | null;
  events: EventRow[];
}) {
  const router = useRouter();
  const staffMembers = useMemo(() => staffOptions.map((s) => s.name), [staffOptions]);

  const initialEvents = useMemo(() => {
    const active = initialBookings.filter(
      (b) => b.status !== "cancelled" && b.status !== "no_show",
    );
    return active.map(mapBookingToCalEvent);
  }, [initialBookings]);

  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => parseDate(TODAY));
  const [events, setEvents] = useState<CalEvent[]>(initialEvents);
  const [calPageTab, setCalPageTab] = useState<CalPageTab>("calendar");

  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CalEvent | null>(null);
  const [formInitial, setFormInitial] = useState<FormState>(BLANK_FORM);

  const openNew = (prefill?: Partial<FormState>) => {
    setEditTarget(null);
    setFormInitial({ ...BLANK_FORM, ...prefill });
    setFormOpen(true);
    setSelectedEvent(null);
  };

  const openEdit = (ev: CalEvent) => {
    setEditTarget(ev);
    setFormInitial({
      title: ev.title,
      type: ev.type,
      date: ev.date,
      startTime: ev.startTime,
      durationMin: ev.durationMin,
      staff: ev.staff ?? "",
      client: ev.client ?? "",
      location: ev.location ?? "",
      notes: ev.notes ?? "",
      serviceId: ev.serviceId ?? "",
      clientId: ev.clientId ?? "",
      staffId: ev.staffId ?? "",
    });
    setSelectedEvent(null);
    setFormOpen(true);
  };

  const handleSave = async (f: FormState) => {
    const startsAt = new Date(`${f.date}T${f.startTime}`);
    const svc = serviceOptions.find((s) => s.id === f.serviceId);
    const totalInCents = svc ? svc.priceInCents : 0;

    if (editTarget && editTarget.bookingId) {
      await updateBooking(editTarget.bookingId, {
        clientId: f.clientId,
        serviceId: Number(f.serviceId),
        staffId: f.staffId || null,
        startsAt,
        durationMinutes: f.durationMin,
        totalInCents,
        location: f.location || undefined,
        clientNotes: f.notes || undefined,
        status: editTarget.status as
          | "confirmed"
          | "pending"
          | "completed"
          | "in_progress"
          | "cancelled"
          | "no_show",
      });
      router.refresh();
    } else if (f.serviceId && f.clientId) {
      await createBooking({
        clientId: f.clientId,
        serviceId: Number(f.serviceId),
        staffId: f.staffId || null,
        startsAt,
        durationMinutes: f.durationMin,
        totalInCents,
        location: f.location || undefined,
        clientNotes: f.notes || undefined,
      });
      router.refresh();
    }
    setFormOpen(false);
  };

  const handleDelete = async (ev: CalEvent) => {
    if (ev.bookingId) {
      await deleteBooking(ev.bookingId);
    }
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    setSelectedEvent(null);
  };

  const handleSlotClick = (date: string, h: number, staff?: string) => {
    const staffOpt = staff ? staffOptions.find((s) => s.name === staff) : undefined;
    openNew({
      date,
      startTime: `${String(h).padStart(2, "0")}:00`,
      ...(staffOpt ? { staff: staffOpt.name, staffId: staffOpt.id } : {}),
    });
  };

  const handleDayClick = (d: Date) => {
    setCursor(d);
    setView("day");
  };

  if (calPageTab === "availability" || calPageTab === "events") {
    return (
      <div className="flex flex-col min-h-full">
        {/* Top tab bar */}
        <div className="flex gap-1 border-b border-border px-4 md:px-6 lg:px-8 pt-4 shrink-0">
          {CAL_PAGE_TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setCalPageTab(id)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                calPageTab === id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted hover:text-foreground hover:border-border",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {calPageTab === "availability" ? (
          <AvailabilityTab
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        ) : (
          <EventsTab events={initialEventRows} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-[1600px] mx-auto w-full px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-4 gap-4">
      {/* ---- Tab bar ---- */}
      <div className="flex gap-1 border-b border-border -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 shrink-0">
        {CAL_PAGE_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setCalPageTab(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              calPageTab === id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---- Toolbar ---- */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(navigate(view, cursor, -1))}
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCursor(parseDate(TODAY))}
            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground rounded-lg hover:bg-foreground/8 border border-border transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(navigate(view, cursor, 1))}
            className="p-1.5 rounded-lg hover:bg-foreground/8 text-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <h2 className="text-base font-semibold text-foreground tracking-tight flex-1 min-w-0 truncate">
          {periodLabel(view, cursor)}
        </h2>

        {/* View tabs */}
        <div className="flex gap-0.5 bg-surface border border-border rounded-lg p-0.5 shrink-0">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                view === key ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* New event */}
        <button
          onClick={() => openNew({ date: fmtDate(cursor) })}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>
      </div>

      {/* ---- Calendar body ---- */}
      <div className="flex-1 min-h-0 border border-border rounded-2xl overflow-hidden bg-background flex flex-col">
        {view === "month" && (
          <MonthView
            cursor={cursor}
            events={events}
            onDayClick={handleDayClick}
            onEventClick={setSelectedEvent}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "week" && (
          <WeekView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "day" && (
          <DayView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "staff" && (
          <StaffView
            cursor={cursor}
            events={events}
            staffMembers={staffMembers}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
            businessHours={businessHours}
            timeOff={timeOff}
            lunchBreak={lunchBreak}
          />
        )}
        {view === "agenda" && (
          <AgendaView cursor={cursor} events={events} onEventClick={setSelectedEvent} />
        )}
      </div>

      {/* ---- Event detail dialog ---- */}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => openEdit(selectedEvent)}
          onDelete={() => handleDelete(selectedEvent)}
        />
      )}

      {/* ---- Event form dialog ---- */}
      {formOpen && (
        <EventFormDialog
          key={editTarget?.id ?? "new"}
          open
          title={editTarget ? "Edit Booking" : "New Booking"}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
          clients={clients}
          serviceOptions={serviceOptions}
          staffOptions={staffOptions}
        />
      )}
    </div>
  );
}
