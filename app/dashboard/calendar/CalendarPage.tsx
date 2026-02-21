"use client";

import { useState, useMemo } from "react";
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
  ExternalLink,
} from "lucide-react";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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
}

/* ------------------------------------------------------------------ */
/*  Mock data                                                           */
/* ------------------------------------------------------------------ */

const STAFF_MEMBERS = ["Trini", "Aaliyah", "Jade", "Maya"];

let _nextId = 100;
function nextId() {
  return ++_nextId;
}

const INITIAL_EVENTS: CalEvent[] = [
  // Mon Feb 16
  {
    id: 1,
    title: "Volume Lash Full Set",
    type: "lash",
    date: "2026-02-16",
    startTime: "09:00",
    durationMin: 90,
    staff: "Trini",
    client: "Sarah M.",
  },
  {
    id: 2,
    title: "Permanent Anklet",
    type: "jewelry",
    date: "2026-02-16",
    startTime: "11:00",
    durationMin: 60,
    staff: "Jade",
    client: "Nina P.",
  },
  {
    id: 3,
    title: "Goddess Locs",
    type: "crochet",
    date: "2026-02-16",
    startTime: "10:00",
    durationMin: 180,
    staff: "Aaliyah",
    client: "Keisha W.",
  },
  // Tue Feb 17
  {
    id: 4,
    title: "Volume Lash Masterclass",
    type: "training",
    date: "2026-02-17",
    startTime: "09:00",
    durationMin: 180,
    staff: "Trini",
    location: "Studio",
  },
  {
    id: 5,
    title: "Mega Volume Set",
    type: "lash",
    date: "2026-02-17",
    startTime: "10:00",
    durationMin: 90,
    staff: "Trini",
    client: "Destiny C.",
  },
  {
    id: 6,
    title: "Dainty Wrist Chain",
    type: "jewelry",
    date: "2026-02-17",
    startTime: "13:00",
    durationMin: 60,
    staff: "Jade",
    client: "Camille F.",
  },
  {
    id: 7,
    title: "Classic Wispy Lash",
    type: "lash",
    date: "2026-02-17",
    startTime: "14:00",
    durationMin: 90,
    staff: "Jade",
    client: "Amara J.",
  },
  // Wed Feb 18
  {
    id: 8,
    title: "Bridal Lashes",
    type: "lash",
    date: "2026-02-18",
    startTime: "11:00",
    durationMin: 120,
    staff: "Trini",
    client: "Lily N.",
  },
  {
    id: 9,
    title: "Classic Fill",
    type: "lash",
    date: "2026-02-18",
    startTime: "11:00",
    durationMin: 60,
    staff: "Jade",
    client: "Maya R.",
  },
  {
    id: 10,
    title: "Permanent Necklace",
    type: "jewelry",
    date: "2026-02-18",
    startTime: "13:00",
    durationMin: 60,
    staff: "Jade",
    client: "Priya K.",
  },
  {
    id: 11,
    title: "Blocked – Lunch",
    type: "blocked",
    date: "2026-02-18",
    startTime: "15:00",
    durationMin: 60,
    staff: "Trini",
  },
  // Thu Feb 19
  {
    id: 12,
    title: "Pop-up at Valley Fair",
    type: "event",
    date: "2026-02-19",
    startTime: "10:00",
    durationMin: 360,
    staff: "Trini",
    location: "Valley Fair Mall",
  },
  {
    id: 13,
    title: "Crochet Box Braids",
    type: "crochet",
    date: "2026-02-19",
    startTime: "10:00",
    durationMin: 240,
    staff: "Aaliyah",
    client: "Keisha W.",
  },
  // Fri Feb 20
  {
    id: 14,
    title: "Classic Lash Fill",
    type: "lash",
    date: "2026-02-20",
    startTime: "09:00",
    durationMin: 60,
    staff: "Jade",
    client: "Sarah M.",
  },
  {
    id: 15,
    title: "Volume Lash Full Set",
    type: "lash",
    date: "2026-02-20",
    startTime: "10:30",
    durationMin: 90,
    staff: "Trini",
    client: "Destiny C.",
  },
  {
    id: 16,
    title: "Goddess Locs",
    type: "crochet",
    date: "2026-02-20",
    startTime: "13:00",
    durationMin: 150,
    staff: "Aaliyah",
    client: "Amara J.",
  },
  {
    id: 17,
    title: "Permanent Bracelet",
    type: "jewelry",
    date: "2026-02-20",
    startTime: "13:00",
    durationMin: 45,
    staff: "Jade",
    client: "Lily N.",
  },
  // Sat Feb 21 (today)
  {
    id: 18,
    title: "Mega Volume Set",
    type: "lash",
    date: "2026-02-21",
    startTime: "10:00",
    durationMin: 90,
    staff: "Trini",
    client: "Camille F.",
  },
  {
    id: 19,
    title: "Permanent Necklace",
    type: "jewelry",
    date: "2026-02-21",
    startTime: "12:00",
    durationMin: 60,
    staff: "Jade",
    client: "Maya R.",
  },
  {
    id: 20,
    title: "Classic Wispy",
    type: "lash",
    date: "2026-02-21",
    startTime: "13:00",
    durationMin: 90,
    staff: "Trini",
    client: "Priya K.",
  },
  // Sun Feb 22
  {
    id: 21,
    title: "Crochet Tutorial",
    type: "training",
    date: "2026-02-22",
    startTime: "14:00",
    durationMin: 120,
    staff: "Aaliyah",
  },
  // Mon Feb 23
  {
    id: 22,
    title: "Mega Volume Masterclass",
    type: "training",
    date: "2026-02-23",
    startTime: "10:00",
    durationMin: 180,
    staff: "Trini",
  },
  {
    id: 23,
    title: "Permanent Anklet",
    type: "jewelry",
    date: "2026-02-23",
    startTime: "09:00",
    durationMin: 45,
    staff: "Jade",
    client: "Nina P.",
  },
  // Tue Feb 24
  {
    id: 24,
    title: "Classic Lash Set",
    type: "lash",
    date: "2026-02-24",
    startTime: "11:00",
    durationMin: 90,
    staff: "Trini",
    client: "Sarah M.",
  },
  {
    id: 25,
    title: "Dainty Chain",
    type: "jewelry",
    date: "2026-02-24",
    startTime: "14:00",
    durationMin: 60,
    staff: "Jade",
    client: "Keisha W.",
  },
];

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

const TODAY = "2026-02-21";

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
}: {
  events: CalEvent[];
  onSelect: (e: CalEvent) => void;
  onSlotClick?: (h: number) => void;
}) {
  const laid = useMemo(() => layoutDay(events), [events]);

  return (
    <div
      className="relative flex-1 min-w-0 border-r border-border/30 last:border-r-0"
      style={{ height: `${GRID_H}px` }}
    >
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
}: {
  cursor: Date;
  events: CalEvent[];
  onDayClick: (d: Date) => void;
  onEventClick: (e: CalEvent) => void;
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
}: {
  cursor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (date: string, h: number) => void;
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
}: {
  cursor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (date: string, h: number) => void;
}) {
  const ds = fmtDate(cursor);
  const dayEvents = useMemo(() => events.filter((ev) => ev.date === ds), [events, ds]);
  const today = isToday(ds);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex shrink-0 border-b border-border">
        <div className="w-14 shrink-0" />
        <div className="flex-1 py-3 text-center border-l border-border/30">
          <p className="text-xs text-muted">{DAY_NAMES_SHORT[cursor.getDay()]}</p>
          <p
            className={cn(
              "text-xl font-semibold mt-0.5 w-10 h-10 flex items-center justify-center rounded-full mx-auto",
              today ? "bg-accent text-white" : "text-foreground",
            )}
          >
            {cursor.getDate()}
          </p>
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
  onEventClick,
  onSlotClick,
}: {
  cursor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
  onSlotClick: (date: string, h: number, staff: string) => void;
}) {
  const ds = fmtDate(cursor);

  const byStaff = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const s of STAFF_MEMBERS) map[s] = [];
    for (const ev of events) {
      if (ev.date === ds && ev.staff && map[ev.staff]) {
        map[ev.staff].push(ev);
      }
    }
    return map;
  }, [events, ds]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Staff column headers */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-14 shrink-0" />
        {STAFF_MEMBERS.map((s) => (
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
            {STAFF_MEMBERS.map((s) => (
              <DayColumn
                key={s}
                events={byStaff[s]}
                onSelect={onEventClick}
                onSlotClick={(h) => onSlotClick(ds, h, s)}
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
}

const BLANK_FORM: FormState = {
  title: "",
  type: "lash",
  date: "",
  startTime: "09:00",
  durationMin: 60,
  staff: "Trini",
  client: "",
  location: "",
  notes: "",
};

function EventFormDialog({
  open,
  title,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial: FormState;
  onClose: () => void;
  onSave: (f: FormState) => void;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <Field label="Title" required>
          <Input
            value={form.title}
            onChange={(e) => set("title")(e.target.value)}
            placeholder="e.g. Volume Lash Full Set"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <Select value={form.type} onChange={(e) => set("type")(e.target.value as EventType)}>
              {(Object.keys(TYPE_LABELS) as EventType[]).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Staff">
            <Select value={form.staff} onChange={(e) => set("staff")(e.target.value)}>
              {STAFF_MEMBERS.map((s) => (
                <option key={s} value={s}>
                  {s}
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
          <Field label="Client">
            <Input
              value={form.client}
              onChange={(e) => set("client")(e.target.value)}
              placeholder="e.g. Sarah M."
            />
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
        disabled={!form.title.trim() || !form.date}
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
/*  Events tab (special events / parties)                              */
/* ------------------------------------------------------------------ */

type SpecialEventStatus = "upcoming" | "sold_out" | "past" | "draft";

interface SpecialEvent {
  id: number;
  title: string;
  date: string;
  time: string;
  location: string;
  capacity: number;
  registered: number;
  price: number | null;
  status: SpecialEventStatus;
  tags: string[];
  description: string;
}

const SPECIAL_EVENTS: SpecialEvent[] = [
  {
    id: 1,
    title: "Permanent Jewelry Pop-Up Party",
    date: "Mar 8, 2026",
    time: "12:00 PM – 6:00 PM",
    location: "T Creative Studio · Atlanta, GA",
    capacity: 20,
    registered: 14,
    price: null,
    status: "upcoming",
    tags: ["jewelry", "pop-up"],
    description:
      "Walk-in permanent jewelry welding event. No appointment needed. Multiple chain styles and metals available.",
  },
  {
    id: 2,
    title: "Lash + Jewels Galentine's Day",
    date: "Feb 13, 2026",
    time: "11:00 AM – 4:00 PM",
    location: "T Creative Studio · Atlanta, GA",
    capacity: 12,
    registered: 12,
    price: 45,
    status: "sold_out",
    tags: ["lash", "jewelry", "event"],
    description:
      "Galentine's event — lash refresh + permanent bracelet combo for you and your bestie.",
  },
  {
    id: 3,
    title: "Beauty Business Workshop",
    date: "Mar 22, 2026",
    time: "10:00 AM – 2:00 PM",
    location: "Atlanta (venue TBD)",
    capacity: 30,
    registered: 8,
    price: 200,
    status: "upcoming",
    tags: ["consulting", "workshop"],
    description:
      "Half-day workshop: pricing strategy, client retention, and social media marketing for beauty entrepreneurs.",
  },
  {
    id: 4,
    title: "Lash Certification — Spring Cohort",
    date: "Apr 5–6, 2026",
    time: "9:00 AM – 5:00 PM",
    location: "T Creative Studio · Atlanta, GA",
    capacity: 6,
    registered: 3,
    price: 800,
    status: "upcoming",
    tags: ["training", "certification"],
    description:
      "2-day lash tech certification. Classic, hybrid, and volume techniques. Kit included.",
  },
  {
    id: 5,
    title: "Permanent Jewelry Course",
    date: "Jan 18, 2026",
    time: "10:00 AM – 4:00 PM",
    location: "T Creative Studio · Atlanta, GA",
    capacity: 4,
    registered: 4,
    price: 450,
    status: "past",
    tags: ["training", "jewelry"],
    description:
      "1-day hands-on jewelry welding course. Includes starter kit and business setup guide.",
  },
];

const STATUS_CFG: Record<
  SpecialEventStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  upcoming: {
    label: "Upcoming",
    color: "text-[#5b8a8a]",
    bg: "bg-[#5b8a8a]/10",
    border: "border-[#5b8a8a]/20",
  },
  sold_out: {
    label: "Sold Out",
    color: "text-[#a07040]",
    bg: "bg-[#a07040]/10",
    border: "border-[#a07040]/20",
  },
  past: {
    label: "Past",
    color: "text-muted",
    bg: "bg-foreground/8",
    border: "border-foreground/15",
  },
  draft: {
    label: "Draft",
    color: "text-muted",
    bg: "bg-foreground/5",
    border: "border-foreground/10",
  },
};

function EventsTab() {
  const upcoming = SPECIAL_EVENTS.filter((e) => e.status === "upcoming" || e.status === "sold_out");
  const past = SPECIAL_EVENTS.filter((e) => e.status === "past");

  function EventCard({ ev }: { ev: SpecialEvent }) {
    const cfg = STATUS_CFG[ev.status];
    const fillPct = ev.capacity > 0 ? Math.round((ev.registered / ev.capacity) * 100) : 0;
    return (
      <div className="group bg-background border border-border rounded-2xl p-4 flex flex-col gap-3 hover:shadow-sm transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span
                className={cn(
                  "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                  cfg.color,
                  cfg.bg,
                  cfg.border,
                )}
              >
                {cfg.label}
              </span>
              {ev.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] text-muted bg-surface border border-border px-1.5 py-0.5 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">{ev.title}</h3>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-muted leading-relaxed line-clamp-2">{ev.description}</p>

        <div className="space-y-1.5 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            <span>
              {ev.date} · {ev.time}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{ev.location}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[10px] text-muted mb-1">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {ev.registered}/{ev.capacity} registered
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
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-foreground">
              {ev.price === null ? "Free" : `$${ev.price}`}
            </p>
            <p className="text-[10px] text-muted">per person</p>
          </div>
        </div>

        {ev.status === "upcoming" && (
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors">
              <ExternalLink className="w-3 h-3" />
              Share Link
            </button>
            <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors">
              <Users className="w-3 h-3" />
              View RSVPs
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Special Events</h2>
          <p className="text-xs text-muted mt-0.5">
            Pop-ups, workshops, training days, and parties.
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-accent text-white text-sm font-medium rounded-xl hover:bg-accent/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Upcoming</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{upcoming.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
            Total Registered
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {upcoming.reduce((s, e) => s + e.registered, 0)}
          </p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
            Potential Revenue
          </p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            $
            {upcoming
              .filter((e) => e.price)
              .reduce((s, e) => s + (e.price ?? 0) * e.registered, 0)
              .toLocaleString()}
          </p>
        </div>
      </div>

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
  { id: "events", label: "Events" },
] as const;
type CalPageTab = (typeof CAL_PAGE_TABS)[number]["id"];

/* ------------------------------------------------------------------ */
/*  CalendarPage                                                        */
/* ------------------------------------------------------------------ */

export function CalendarPage() {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => parseDate(TODAY));
  const [events, setEvents] = useState<CalEvent[]>(INITIAL_EVENTS);
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
      staff: ev.staff ?? "Trini",
      client: ev.client ?? "",
      location: ev.location ?? "",
      notes: ev.notes ?? "",
    });
    setSelectedEvent(null);
    setFormOpen(true);
  };

  const handleSave = (f: FormState) => {
    if (editTarget) {
      setEvents((prev) => prev.map((ev) => (ev.id === editTarget.id ? { ...ev, ...f } : ev)));
    } else {
      setEvents((prev) => [...prev, { ...f, id: nextId() }]);
    }
    setFormOpen(false);
  };

  const handleDelete = (ev: CalEvent) => {
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    setSelectedEvent(null);
  };

  const handleSlotClick = (date: string, h: number, staff?: string) => {
    openNew({ date, startTime: `${String(h).padStart(2, "0")}:00`, ...(staff ? { staff } : {}) });
  };

  const handleDayClick = (d: Date) => {
    setCursor(d);
    setView("day");
  };

  if (calPageTab === "events") {
    return (
      <div className="flex flex-col h-screen overflow-y-auto">
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
        <EventsTab />
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
          />
        )}
        {view === "week" && (
          <WeekView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
          />
        )}
        {view === "day" && (
          <DayView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
          />
        )}
        {view === "staff" && (
          <StaffView
            cursor={cursor}
            events={events}
            onEventClick={setSelectedEvent}
            onSlotClick={handleSlotClick}
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
          title={editTarget ? "Edit Event" : "New Event"}
          initial={formInitial}
          onClose={() => setFormOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
