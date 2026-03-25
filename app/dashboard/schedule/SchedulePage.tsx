"use client";

import { useState, useCallback, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  CalendarRange,
  Clock,
  Search,
  CalendarX,
  Phone,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  AppointmentRow,
  AssistantBookingRow,
  AssistantBookingStats,
  ScheduleStats,
} from "@/lib/types/booking.types";
import { cn } from "@/lib/utils";
import type { AssistantEventRow, AssistantEventStats } from "../events/assistant-actions";
import { AssistantEventsPage } from "../events/AssistantEventsPage";
import { AgendaView } from "./components/AgendaView";
import { ApptDetailDialog } from "./components/ApptDetailDialog";
import { type View, fmtDate, navigate, periodLabel, CATEGORY_COLORS } from "./components/helpers";
import { ListView } from "./components/ListView";
import { MiniCalendar } from "./components/MiniCalendar";
import { MonthView } from "./components/MonthView";
import { WeekGridView } from "./components/WeekGridView";

/* ------------------------------------------------------------------ */
/*  Top-level tabs                                                     */
/* ------------------------------------------------------------------ */

type TopTab = "calendar" | "appointments" | "events";

/* ------------------------------------------------------------------ */
/*  Calendar view options                                              */
/* ------------------------------------------------------------------ */

const VIEW_OPTIONS: { value: View; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "agenda", label: "Agenda", icon: Clock },
];

/* ------------------------------------------------------------------ */
/*  Bookings list helpers                                              */
/* ------------------------------------------------------------------ */

const BOOKING_STATUS_FILTERS = ["All", "Upcoming", "Completed", "Cancelled"] as const;
type BookingStatusFilter = (typeof BOOKING_STATUS_FILTERS)[number];

function bookingStatusConfig(status: string) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "in_progress":
      return { label: "In Progress", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-foreground/8 text-foreground border-foreground/15",
      };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "no_show":
      return {
        label: "No Show",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    default:
      return { label: status, className: "bg-foreground/8 text-foreground border-foreground/15" };
  }
}

function bookingCategoryDot(cat: string) {
  return (
    {
      lash: "bg-[#c4907a]",
      jewelry: "bg-[#d4a574]",
      crochet: "bg-[#7ba3a3]",
      consulting: "bg-[#5b8a8a]",
    }[cat] ?? "bg-foreground/30"
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AssistantSchedulePage({
  initialAppointments,
  stats,
  todayKey,
  bookings,
  bookingStats,
  events,
  eventStats,
}: {
  initialAppointments: AppointmentRow[];
  stats: ScheduleStats;
  todayKey: string;
  bookings?: AssistantBookingRow[];
  bookingStats?: AssistantBookingStats;
  events?: AssistantEventRow[];
  eventStats?: AssistantEventStats;
}) {
  const hasExtraTabs = !!bookings;

  // ── Top tab state ──
  const [topTab, setTopTab] = useState<TopTab>("calendar");

  // ── Calendar state ──
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const [listSelectedDate, setListSelectedDate] = useState<string | null>(todayKey);
  const [listCalendarCursor, setListCalendarCursor] = useState(() => new Date());
  const handleApptClick = useCallback((appt: AppointmentRow) => setSelected(appt), []);

  // ── Bookings state ──
  const [bSearch, setBSearch] = useState("");
  const [bStatusFilter, setBStatusFilter] = useState<BookingStatusFilter>("All");
  const [bExpanded, setBExpanded] = useState<number | null>(null);
  const [bSelectedDate, setBSelectedDate] = useState<string | null>(null);
  const [bCalendarCursor, setBCalendarCursor] = useState(() => new Date());

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const prev = () => setCursor((c) => navigate(view, c, -1));
  const next = () => setCursor((c) => navigate(view, c, 1));
  const goToday = () => setCursor(new Date());
  const handleDayClick = (d: Date) => setCursor(d);

  const appointmentDays = useMemo(
    () => new Set(initialAppointments.map((a) => a.date)),
    [initialAppointments],
  );

  const listPeriodLabel = listCalendarCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // ── Bookings filtering ──
  const filteredBookings = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => {
      const matchSearch =
        b.client.toLowerCase().includes(bSearch.toLowerCase()) ||
        b.service.toLowerCase().includes(bSearch.toLowerCase());
      const matchStatus =
        bStatusFilter === "All"
          ? true
          : bStatusFilter === "Upcoming"
            ? ["confirmed", "pending", "in_progress"].includes(b.status)
            : bStatusFilter === "Completed"
              ? b.status === "completed"
              : ["cancelled", "no_show"].includes(b.status);
      const matchDate = bSelectedDate ? b.date === bSelectedDate : true;
      return matchSearch && matchStatus && matchDate;
    });
  }, [bookings, bSearch, bStatusFilter, bSelectedDate]);

  const bookingDays = useMemo(() => new Set((bookings ?? []).map((b) => b.date)), [bookings]);

  const bPeriodLabel = bCalendarCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 lg:p-8 pb-0 space-y-4">
        {/* Header + top tabs */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
              Schedule
            </h1>
            <p className="text-sm text-muted mt-0.5">Your appointments and events</p>
          </div>

          {/* Calendar view switcher — only on calendar tab */}
          {topTab === "calendar" && (
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
          )}
        </div>

        {/* Top-level tabs */}
        {hasExtraTabs && (
          <div className="flex gap-1 border-b border-border">
            {(
              [
                { key: "calendar", label: "Calendar" },
                {
                  key: "appointments",
                  label: `Appointments${bookingStats ? ` (${bookingStats.upcomingCount})` : ""}`,
                },
                { key: "events", label: `Events${eventStats ? ` (${eventStats.upcoming})` : ""}` },
              ] as { key: TopTab; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTopTab(key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                  topTab === key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Calendar tab header content */}
        {topTab === "calendar" && (
          <>
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

            {/* Nav bar */}
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
          </>
        )}

        {/* Appointments tab header content */}
        {topTab === "appointments" && bookings && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Upcoming", value: bookingStats?.upcomingCount ?? 0 },
                { label: "Completed", value: bookingStats?.completedCount ?? 0 },
                { label: "Revenue", value: `$${bookingStats?.completedRevenue ?? 0}` },
              ].map((s) => (
                <Card key={s.label} className="gap-0 py-4">
                  <CardContent className="px-4 text-center">
                    <p className="text-2xl font-semibold text-foreground">{s.value}</p>
                    <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Nav + search */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">{bPeriodLabel}</span>
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
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  value={bSearch}
                  onChange={(e) => setBSearch(e.target.value)}
                  placeholder="Search by client or service…"
                  className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
                />
              </div>
              <div className="flex gap-1">
                {BOOKING_STATUS_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setBStatusFilter(f)}
                    className={cn(
                      "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                      bStatusFilter === f
                        ? "bg-foreground/8 text-foreground"
                        : "text-muted hover:text-foreground",
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Tab bodies ── */}
      <div className="flex-1 min-h-0 p-4 md:px-6 lg:px-8 md:pb-6 lg:pb-8">
        {/* Calendar tab */}
        {topTab === "calendar" && (
          <>
            {view === "list" && (
              <div className="flex gap-6 h-full">
                <div className="hidden md:block w-64 shrink-0">
                  <Card className="gap-0 sticky top-0">
                    <CardContent className="px-4 py-4">
                      <MiniCalendar
                        cursor={listCalendarCursor}
                        onCursorChange={setListCalendarCursor}
                        selectedDate={listSelectedDate}
                        onSelect={(key) =>
                          setListSelectedDate(key === listSelectedDate ? null : key)
                        }
                        appointmentDays={appointmentDays}
                        todayKey={todayKey}
                      />
                    </CardContent>
                  </Card>
                </div>
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
          </>
        )}

        {/* Appointments tab */}
        {topTab === "appointments" && bookings && (
          <div className="flex gap-6 h-full">
            <div className="hidden md:block w-64 shrink-0">
              <Card className="gap-0 sticky top-0">
                <CardContent className="px-4 py-4">
                  <MiniCalendar
                    cursor={bCalendarCursor}
                    onCursorChange={setBCalendarCursor}
                    selectedDate={bSelectedDate}
                    onSelect={(key) => setBSelectedDate(key === bSelectedDate ? null : key)}
                    appointmentDays={bookingDays}
                    todayKey={todayKey}
                  />
                </CardContent>
              </Card>
            </div>
            <div className="flex-1 min-w-0">
              <Card className="gap-0">
                <CardContent className="px-0 py-0">
                  {filteredBookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <CalendarX className="w-8 h-8 text-foreground/15 mb-2" />
                      <p className="text-sm text-muted">
                        {bSelectedDate ? "No bookings on this date." : "No bookings found."}
                      </p>
                      {bSelectedDate && (
                        <button
                          onClick={() => setBSelectedDate(null)}
                          className="text-xs text-accent hover:underline mt-1"
                        >
                          Show all bookings
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredBookings.map((b) => {
                      const sts = bookingStatusConfig(b.status);
                      const isExpanded = bExpanded === b.id;
                      return (
                        <div key={b.id} className="border-b border-border/40 last:border-0">
                          <button
                            onClick={() => setBExpanded(isExpanded ? null : b.id)}
                            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface/60 transition-colors text-left"
                          >
                            <div className="flex flex-col items-center gap-1 shrink-0 w-14">
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  bookingCategoryDot(b.category),
                                )}
                              />
                              <span className="text-[10px] text-muted font-medium">
                                {b.dayLabel}
                              </span>
                              <span className="text-[10px] text-muted/60">{b.time}</span>
                            </div>
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                                {b.clientInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {b.service}
                              </p>
                              <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                                {b.client}
                                <span className="flex items-center gap-0.5 text-muted/60">
                                  <Clock className="w-2.5 h-2.5" />
                                  {b.durationMin}m
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-semibold text-foreground hidden sm:block">
                                ${b.price}
                              </span>
                              <Badge
                                className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}
                              >
                                {sts.label}
                              </Badge>
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-5 pb-4 bg-surface/30 space-y-2 border-t border-border/30">
                              {b.clientPhone && (
                                <div className="flex items-center gap-2 pt-3">
                                  <Phone className="w-3 h-3 text-muted" />
                                  <span className="text-xs text-muted">{b.clientPhone}</span>
                                </div>
                              )}
                              {b.notes && (
                                <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 border border-border/50 italic">
                                  &ldquo;{b.notes}&rdquo;
                                </p>
                              )}
                              {!b.clientPhone && !b.notes && (
                                <p className="text-xs text-muted/50 pt-3">No additional details.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Events tab */}
        {topTab === "events" && events && eventStats && (
          <AssistantEventsPage initialEvents={events} stats={eventStats} embedded />
        )}
      </div>

      {selected && <ApptDetailDialog appt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
