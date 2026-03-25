"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, List, CalendarDays, CalendarRange, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AppointmentRow, ScheduleStats } from "@/lib/types/booking.types";
import { cn } from "@/lib/utils";
import { AgendaView } from "./components/AgendaView";
import { ApptDetailDialog } from "./components/ApptDetailDialog";
import { type View, fmtDate, navigate, periodLabel, CATEGORY_COLORS } from "./components/helpers";
import { ListView } from "./components/ListView";
import { MiniCalendar } from "./components/MiniCalendar";
import { MonthView } from "./components/MonthView";
import { WeekGridView } from "./components/WeekGridView";

const VIEW_OPTIONS: { value: View; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "agenda", label: "Agenda", icon: Clock },
];

export function AssistantSchedulePage({
  initialAppointments,
  stats,
  todayKey,
}: {
  initialAppointments: AppointmentRow[];
  stats: ScheduleStats;
  todayKey: string;
}) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [listSelectedDate, setListSelectedDate] = useState<string | null>(todayKey);
  const [listCalendarCursor, setListCalendarCursor] = useState(() => new Date());
  const handleApptClick = useCallback((appt: AppointmentRow) => {
    setSelected(appt);
  }, []);

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const prev = () => setCursor((c) => navigate(view, c, -1));
  const next = () => setCursor((c) => navigate(view, c, 1));
  const goToday = () => setCursor(new Date());

  const handleDayClick = (d: Date) => {
    setCursor(d);
  };

  // Collect all dates that have appointments for the mini calendar dots
  const appointmentDays = useMemo(
    () => new Set(initialAppointments.map((a) => a.date)),
    [initialAppointments],
  );

  // Navigate helper for list view
  const listPeriodLabel = listCalendarCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 md:p-6 lg:p-8 pb-0 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Schedule</h1>
            <p className="text-sm text-muted mt-0.5">Your upcoming appointments</p>
          </div>
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
            {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setView(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                  view === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted hover:text-foreground",
                )}
              >
                <Icon className="w-3.5 h-3.5 hidden sm:block" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Today", value: String(stats.todayCount), sub: "appointments" },
            { label: "Today's Revenue", value: `$${stats.todayRevenue}`, sub: "projected" },
            { label: "This Week", value: String(stats.weekCount), sub: "total appointments" },
            { label: "Week Revenue", value: `$${stats.weekRevenue}`, sub: "projected" },
          ].map((s) => (
            <Card key={s.label} className="gap-0 py-4">
              <CardContent className="px-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
                <p className="text-[10px] text-muted/60">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Nav bar — always visible */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {view !== "list" && (
              <>
                <button
                  onClick={prev}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={next}
                  className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
            <span className="text-sm font-semibold text-foreground ml-2">
              {view === "list" ? listPeriodLabel : periodLabel(view, cursor)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Category legend */}
            <div className="hidden sm:flex items-center gap-3">
              {(Object.entries(CATEGORY_COLORS) as [string, { dot: string }][]).map(
                ([cat, { dot }]) => (
                  <span
                    key={cat}
                    className="flex items-center gap-1.5 text-xs text-muted capitalize"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
                    {cat}
                  </span>
                ),
              )}
            </div>
            {view !== "list" && (
              <button
                onClick={goToday}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                Today
              </button>
            )}
          </div>
        </div>
      </div>

      {/* View body */}
      <div className="flex-1 min-h-0 p-4 md:px-6 lg:px-8 md:pb-6 lg:pb-8">
        {view === "list" && (
          <div className="flex gap-6 h-full">
            {/* Mini calendar sidebar */}
            <div className="hidden md:block w-64 shrink-0">
              <Card className="gap-0 sticky top-0">
                <CardContent className="px-4 py-4">
                  <MiniCalendar
                    cursor={listCalendarCursor}
                    onCursorChange={setListCalendarCursor}
                    selectedDate={listSelectedDate}
                    onSelect={(key) => setListSelectedDate(key === listSelectedDate ? null : key)}
                    appointmentDays={appointmentDays}
                    todayKey={todayKey}
                  />
                </CardContent>
              </Card>
            </div>
            {/* Appointment list */}
            <div className="flex-1 min-w-0">
              <ListView
                appointments={initialAppointments}
                todayLabel={todayLabel}
                onApptClick={handleApptClick}
                selectedDateKey={listSelectedDate}
              />
            </div>
          </div>
        )}
        {view === "month" && (
          <Card className="gap-0 flex-1 flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <MonthView
                cursor={cursor}
                todayKey={todayKey}
                appointments={initialAppointments}
                onApptClick={handleApptClick}
                onDayClick={handleDayClick}
              />
            </CardContent>
          </Card>
        )}
        {view === "week" && (
          <Card className="gap-0 flex-1 flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <WeekGridView
                cursor={cursor}
                todayKey={todayKey}
                appointments={initialAppointments}
                onApptClick={handleApptClick}
              />
            </CardContent>
          </Card>
        )}
        {view === "agenda" && (
          <Card className="gap-0 flex-1 flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <AgendaView
                cursor={cursor}
                todayKey={todayKey}
                appointments={initialAppointments}
                onApptClick={handleApptClick}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail dialog */}
      {selected && <ApptDetailDialog appt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
