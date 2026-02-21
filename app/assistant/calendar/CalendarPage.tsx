"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const TODAY = "2026-02-21";
const HOUR_H = 60;
const DAY_START = 8;
const DAY_END = 20;
const TOTAL_HOURS = DAY_END - DAY_START;
const GRID_H = TOTAL_HOURS * HOUR_H + 12;
const GRID_TOP_PAD = 12;
const HOURS = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => DAY_START + i);
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

type View = "month" | "week" | "agenda";
type ApptType = "lash" | "lash-addon" | "training";

interface Appointment {
  id: number;
  date: string;
  startTime: string;
  durationMin: number;
  title: string;
  type: ApptType;
  client: string;
  clientInitials: string;
  price: number;
  notes?: string;
}

const MY_APPOINTMENTS: Appointment[] = [
  {
    id: 1,
    date: "2026-02-21",
    startTime: "10:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Maya R.",
    clientInitials: "MR",
    price: 75,
  },
  {
    id: 2,
    date: "2026-02-21",
    startTime: "12:00",
    durationMin: 120,
    title: "Volume Lashes — Full Set",
    type: "lash",
    client: "Priya K.",
    clientInitials: "PK",
    price: 140,
    notes: "New client. Instagram referral. Wants dramatic look.",
  },
  {
    id: 3,
    date: "2026-02-21",
    startTime: "14:30",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Chloe T.",
    clientInitials: "CT",
    price: 75,
  },
  {
    id: 4,
    date: "2026-02-21",
    startTime: "16:30",
    durationMin: 45,
    title: "Lash Removal + Rebook",
    type: "lash-addon",
    client: "Amy L.",
    clientInitials: "AL",
    price: 35,
  },
  {
    id: 5,
    date: "2026-02-22",
    startTime: "11:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Dana W.",
    clientInitials: "DW",
    price: 75,
  },
  {
    id: 6,
    date: "2026-02-22",
    startTime: "14:00",
    durationMin: 120,
    title: "Volume Lashes — Full Set",
    type: "lash",
    client: "Nia B.",
    clientInitials: "NB",
    price: 140,
  },
  {
    id: 7,
    date: "2026-02-24",
    startTime: "10:30",
    durationMin: 90,
    title: "Hybrid Lashes — Full Set",
    type: "lash",
    client: "Kira M.",
    clientInitials: "KM",
    price: 130,
  },
  {
    id: 8,
    date: "2026-02-24",
    startTime: "13:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Toni S.",
    clientInitials: "TS",
    price: 75,
  },
  {
    id: 9,
    date: "2026-02-25",
    startTime: "10:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Jordan L.",
    clientInitials: "JL",
    price: 75,
  },
  {
    id: 10,
    date: "2026-02-26",
    startTime: "15:00",
    durationMin: 120,
    title: "Volume Lashes — Full Set",
    type: "lash",
    client: "Camille F.",
    clientInitials: "CF",
    price: 140,
  },
  {
    id: 11,
    date: "2026-02-26",
    startTime: "17:30",
    durationMin: 60,
    title: "Lash Tint + Lift",
    type: "lash-addon",
    client: "Aisha R.",
    clientInitials: "AR",
    price: 65,
  },
  {
    id: 12,
    date: "2026-02-27",
    startTime: "11:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Sade O.",
    clientInitials: "SO",
    price: 75,
  },
  {
    id: 13,
    date: "2026-02-28",
    startTime: "10:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Mia T.",
    clientInitials: "MT",
    price: 75,
  },
  {
    id: 14,
    date: "2026-02-28",
    startTime: "12:00",
    durationMin: 120,
    title: "Volume Lashes — Full Set",
    type: "lash",
    client: "Zara K.",
    clientInitials: "ZK",
    price: 140,
  },
  {
    id: 15,
    date: "2026-03-03",
    startTime: "10:00",
    durationMin: 90,
    title: "Hybrid Lashes — Full Set",
    type: "lash",
    client: "Lena P.",
    clientInitials: "LP",
    price: 130,
  },
  {
    id: 16,
    date: "2026-03-04",
    startTime: "11:00",
    durationMin: 75,
    title: "Classic Lash Fill",
    type: "lash",
    client: "Maya R.",
    clientInitials: "MR",
    price: 75,
  },
  {
    id: 17,
    date: "2026-03-05",
    startTime: "14:00",
    durationMin: 120,
    title: "Volume Masterclass — Module 3",
    type: "training",
    client: "Studio",
    clientInitials: "TC",
    price: 0,
    notes: "Complete module 3 quiz before attending.",
  },
];

const TYPE_C: Record<ApptType, { bg: string; border: string; text: string; dot: string }> = {
  lash: { bg: "#c4907a1a", border: "#c4907a", text: "#96604a", dot: "#c4907a" },
  "lash-addon": { bg: "#d4a5741a", border: "#d4a574", text: "#a07040", dot: "#d4a574" },
  training: { bg: "#22c55e1a", border: "#22c55e", text: "#15803d", dot: "#22c55e" },
};

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

function timeToMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function hourLabel(h: number): string {
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function periodLabel(view: View, cursor: Date): string {
  if (view === "month") return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  if (view === "week") {
    const days = getWeekDays(cursor);
    const s = days[0];
    const e = days[6];
    if (s.getMonth() === e.getMonth())
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
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
  d.setMonth(d.getMonth() + dir);
  return d;
}

/* ------------------------------------------------------------------ */
/*  Detail dialog (read-only)                                           */
/* ------------------------------------------------------------------ */

function ApptDetailDialog({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const c = TYPE_C[appt.type];
  const d = parseDate(appt.date);
  const typeLabel = { lash: "Lash", "lash-addon": "Add-on", training: "Training" }[appt.type];
  const endMin = timeToMin(appt.startTime) + appt.durationMin;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  return (
    <Dialog open title={appt.title} onClose={onClose}>
      <div className="space-y-4">
        <span
          className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: c.bg, color: c.text, outline: `1px solid ${c.border}40` }}
        >
          {typeLabel}
        </span>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <span className="w-4 h-4 shrink-0 text-center text-xs">📅</span>
            <span>
              {DAY_NAMES_SHORT[d.getDay()]}, {MONTH_NAMES[d.getMonth()]} {d.getDate()},{" "}
              {d.getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {fmt12(appt.startTime)} – {fmt12(endTime)} · {appt.durationMin} min
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <Users className="w-4 h-4 shrink-0" />
            <span>{appt.client}</span>
          </div>
          {appt.price > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-foreground font-semibold">
              <span className="w-4 text-center">$</span>
              <span>${appt.price}</span>
            </div>
          )}
          {appt.notes && (
            <p className="text-sm text-muted bg-surface rounded-lg p-3 border border-border italic">
              {appt.notes}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Month view                                                          */
/* ------------------------------------------------------------------ */

function MonthView({
  cursor,
  appointments,
  onApptClick,
  onDayClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onApptClick: (a: Appointment) => void;
  onDayClick: (d: Date) => void;
}) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
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
          const today = ds === TODAY;
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
                  const c = TYPE_C[a.type];
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
                        {fmt12(a.startTime)} {a.client}
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

/* ------------------------------------------------------------------ */
/*  Week view                                                           */
/* ------------------------------------------------------------------ */

function WeekView({
  cursor,
  appointments,
  onApptClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onApptClick: (a: Appointment) => void;
}) {
  const days = useMemo(() => getWeekDays(cursor), [cursor]);

  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
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
          const today = ds === TODAY;
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
            {/* Hour lines */}
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
                    const c = TYPE_C[a.type];
                    const top =
                      ((timeToMin(a.startTime) - DAY_START * 60) / 60) * HOUR_H + GRID_TOP_PAD;
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
                              {fmt12(a.startTime)} · {a.title}
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

/* ------------------------------------------------------------------ */
/*  Agenda view                                                         */
/* ------------------------------------------------------------------ */

function AgendaView({
  cursor,
  appointments,
  onApptClick,
}: {
  cursor: Date;
  appointments: Appointment[];
  onApptClick: (a: Appointment) => void;
}) {
  const fromDate = fmtDate(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const toDate = fmtDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const grouped = useMemo(() => {
    const filtered = appointments
      .filter((a) => a.date >= fromDate && a.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const map: { date: string; appts: Appointment[] }[] = [];
    for (const a of filtered) {
      const last = map[map.length - 1];
      if (last && last.date === a.date) last.appts.push(a);
      else map.push({ date: a.date, appts: [a] });
    }
    return map;
  }, [appointments, fromDate, toDate]);

  if (!grouped.length)
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted">No appointments this month.</p>
      </div>
    );

  return (
    <div className="flex-1 overflow-auto p-4 md:p-6">
      <div className="space-y-6 max-w-2xl mx-auto">
        {grouped.map(({ date, appts }) => {
          const d = parseDate(date);
          const today = date === TODAY;
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
                  {MONTH_NAMES[d.getMonth()]} · ${appts.reduce((s, a) => s + a.price, 0)}
                </span>
              </div>
              <div className="space-y-2 pl-2">
                {appts.map((a) => {
                  const c = TYPE_C[a.type];
                  return (
                    <div
                      key={a.id}
                      onClick={() => onApptClick(a)}
                      className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface cursor-pointer hover:bg-background transition-colors"
                    >
                      <div
                        className="w-1 self-stretch rounded-full shrink-0"
                        style={{ background: c.dot }}
                      />
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px] bg-background text-muted font-semibold">
                          {a.clientInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmt12(a.startTime)} · {a.durationMin}m
                          </span>
                          <span className="text-xs text-muted flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {a.client}
                          </span>
                        </div>
                      </div>
                      {a.price > 0 && (
                        <span className="text-sm font-semibold text-foreground shrink-0">
                          ${a.price}
                        </span>
                      )}
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
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

const VIEWS: { key: View; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "agenda", label: "Agenda" },
];

export function AssistantCalendarPage() {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState<Date>(() => parseDate(TODAY));
  const [selected, setSelected] = useState<Appointment | null>(null);

  const handleDayClick = (d: Date) => {
    setCursor(d);
    setView("week");
  };

  return (
    <div className="flex flex-col h-screen max-w-[1600px] mx-auto w-full px-4 md:px-6 lg:px-8 pt-4 md:pt-6 pb-4 gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
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

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 text-[11px] text-muted">
          {(Object.entries(TYPE_C) as [ApptType, (typeof TYPE_C)[ApptType]][]).map(([type, c]) => (
            <span key={type} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
              {type === "lash" ? "Lash" : type === "lash-addon" ? "Add-on" : "Training"}
            </span>
          ))}
        </div>

        {/* View switcher */}
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
      </div>

      {/* Calendar body */}
      <div className="flex-1 min-h-0 border border-border rounded-2xl overflow-hidden bg-background flex flex-col">
        {view === "month" && (
          <MonthView
            cursor={cursor}
            appointments={MY_APPOINTMENTS}
            onApptClick={setSelected}
            onDayClick={handleDayClick}
          />
        )}
        {view === "week" && (
          <WeekView cursor={cursor} appointments={MY_APPOINTMENTS} onApptClick={setSelected} />
        )}
        {view === "agenda" && (
          <AgendaView cursor={cursor} appointments={MY_APPOINTMENTS} onApptClick={setSelected} />
        )}
      </div>

      {selected && <ApptDetailDialog appt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
