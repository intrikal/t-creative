/**
 * Assistant bookings page with view switching (List, Week, Month, Agenda).
 *
 * Re-uses the calendar view components from the schedule module by mapping
 * `AssistantBookingRow` to the `AppointmentRow` shape those views expect.
 *
 * @module bookings/AssistantBookingsPage
 */
"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Search,
  Clock,
  Phone,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  List,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppointmentRow, BookingStatus, ServiceCategory } from "../schedule/actions";
import { AgendaView } from "../schedule/components/AgendaView";
import { ApptDetailDialog } from "../schedule/components/ApptDetailDialog";
import {
  type View,
  fmtDate,
  navigate as navCursor,
  periodLabel,
  CATEGORY_COLORS,
} from "../schedule/components/helpers";
import { MonthView } from "../schedule/components/MonthView";
import { WeekGridView } from "../schedule/components/WeekGridView";
import type { AssistantBookingRow, AssistantBookingStats } from "./actions";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const VIEW_OPTIONS: { value: View; label: string; icon: typeof List }[] = [
  { value: "list", label: "List", icon: List },
  { value: "week", label: "Week", icon: CalendarRange },
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "agenda", label: "Agenda", icon: Clock },
];

const STATUS_FILTERS = ["All", "Upcoming", "Completed", "Cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusConfig(status: string) {
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

function categoryDot(cat: string) {
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
/*  Mapper: AssistantBookingRow → AppointmentRow                       */
/* ------------------------------------------------------------------ */

function toAppointmentRow(b: AssistantBookingRow): AppointmentRow {
  return {
    id: b.id,
    date: b.date,
    dayLabel: b.dayLabel,
    time: b.time,
    startTime24: b.startTime24,
    endTime: b.endTime,
    service: b.service,
    category: (b.category as ServiceCategory) ?? "lash",
    client: b.client,
    clientInitials: b.clientInitials,
    status: b.status as BookingStatus,
    durationMin: b.durationMin,
    price: b.price,
    notes: b.notes ?? undefined,
    kind: "booking",
  };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AssistantBookingsPage({
  initialBookings,
  stats,
}: {
  initialBookings: AssistantBookingRow[];
  stats: AssistantBookingStats;
}) {
  const [view, setView] = useState<View>("list");
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<AppointmentRow | null>(null);
  const handleApptClick = useCallback((appt: AppointmentRow) => {
    setSelected(appt);
  }, []);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const todayKey = useMemo(() => fmtDate(new Date()), []);

  const filtered = initialBookings.filter((b) => {
    const matchSearch =
      b.client.toLowerCase().includes(search.toLowerCase()) ||
      b.service.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All"
        ? true
        : statusFilter === "Upcoming"
          ? ["confirmed", "pending", "in_progress"].includes(b.status)
          : statusFilter === "Completed"
            ? b.status === "completed"
            : ["cancelled", "no_show"].includes(b.status);
    return matchSearch && matchStatus;
  });

  const appointments = useMemo(() => initialBookings.map(toAppointmentRow), [initialBookings]);

  const prev = () => setCursor((c) => navCursor(view, c, -1));
  const next = () => setCursor((c) => navCursor(view, c, 1));
  const goToday = () => setCursor(new Date());
  const handleDayClick = (d: Date) => {
    setCursor(d);
    setView("week");
  };

  const showNav = view !== "list";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 lg:p-8 pb-0 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">My Bookings</h1>
            <p className="text-sm text-muted mt-0.5">
              Your appointment history and upcoming sessions
            </p>
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

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Upcoming", value: stats.upcomingCount },
            { label: "Completed", value: stats.completedCount },
            { label: "Revenue", value: `$${stats.completedRevenue}` },
          ].map((s) => (
            <Card key={s.label} className="gap-0 py-4">
              <CardContent className="px-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Calendar nav — only for calendar views */}
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

        {/* Category legend — only for calendar views */}
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

        {/* Search + status filters — only for list view */}
        {!showNav && (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by client or service…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
              />
            </div>
            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                    statusFilter === f
                      ? "bg-foreground/8 text-foreground"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* View body */}
      <div className="flex-1 min-h-0 p-4 md:px-6 lg:px-8 md:pb-6 lg:pb-8">
        {view === "list" && (
          <Card className="gap-0">
            <CardContent className="px-0 py-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <CalendarX className="w-8 h-8 text-foreground/15 mb-2" />
                  <p className="text-sm text-muted">No bookings found.</p>
                </div>
              ) : (
                filtered.map((b) => {
                  const sts = statusConfig(b.status);
                  const isExpanded = expanded === b.id;
                  return (
                    <div key={b.id} className="border-b border-border/40 last:border-0">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : b.id)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface/60 transition-colors text-left"
                      >
                        <div className="flex flex-col items-center gap-1 shrink-0 w-14">
                          <span
                            className={cn("w-1.5 h-1.5 rounded-full", categoryDot(b.category))}
                          />
                          <span className="text-[10px] text-muted font-medium">{b.dayLabel}</span>
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
        )}

        {view === "week" && (
          <WeekGridView
            cursor={cursor}
            todayKey={todayKey}
            appointments={appointments}
            onApptClick={handleApptClick}
          />
        )}
        {view === "month" && (
          <MonthView
            cursor={cursor}
            todayKey={todayKey}
            appointments={appointments}
            onApptClick={handleApptClick}
            onDayClick={handleDayClick}
          />
        )}
        {view === "agenda" && (
          <AgendaView
            cursor={cursor}
            todayKey={todayKey}
            appointments={appointments}
            onApptClick={handleApptClick}
          />
        )}
      </div>

      {/* Detail dialog */}
      {selected && <ApptDetailDialog appt={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
