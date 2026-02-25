"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, List, CalendarDays, CalendarRange, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppointmentRow, ScheduleStats } from "./actions";
import { AgendaView } from "./components/AgendaView";
import { ApptDetailDialog } from "./components/ApptDetailDialog";
import { type View, fmtDate, navigate, periodLabel, CATEGORY_COLORS } from "./components/helpers";
import { ListView } from "./components/ListView";
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
  const [view, setView] = useState<View>("list");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<AppointmentRow | null>(null);

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
    setView("week");
  };

  const showNav = view !== "list";

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

        {/* Nav bar (prev / period / next / Today) — only for calendar views */}
        {showNav && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
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
              <span className="text-sm font-semibold text-foreground ml-2">
                {periodLabel(view, cursor)}
              </span>
            </div>
            <button
              onClick={goToday}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-border text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              Today
            </button>
          </div>
        )}

        {/* Category legend */}
        {showNav && (
          <div className="flex items-center gap-3 flex-wrap">
            {(Object.entries(CATEGORY_COLORS) as [string, { dot: string }][]).map(
              ([cat, { dot }]) => (
                <span key={cat} className="flex items-center gap-1.5 text-xs text-muted capitalize">
                  <span className="w-2 h-2 rounded-full" style={{ background: dot }} />
                  {cat}
                </span>
              ),
            )}
          </div>
        )}
      </div>

      {/* View body */}
      <div className="flex-1 min-h-0 p-4 md:px-6 lg:px-8 md:pb-6 lg:pb-8">
        {view === "list" && (
          <ListView
            appointments={initialAppointments}
            todayLabel={todayLabel}
            onApptClick={setSelected}
          />
        )}
        {view === "month" && (
          <MonthView
            cursor={cursor}
            todayKey={todayKey}
            appointments={initialAppointments}
            onApptClick={setSelected}
            onDayClick={handleDayClick}
          />
        )}
        {view === "week" && (
          <WeekGridView
            cursor={cursor}
            todayKey={todayKey}
            appointments={initialAppointments}
            onApptClick={setSelected}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            cursor={cursor}
            todayKey={todayKey}
            appointments={initialAppointments}
            onApptClick={setSelected}
          />
        )}
      </div>

      {/* Detail dialog */}
      {selected && <ApptDetailDialog appt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
