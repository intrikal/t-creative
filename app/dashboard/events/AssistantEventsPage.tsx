"use client";

import { useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Search,
  PartyPopper,
  Briefcase,
  Gem,
  Heart,
  Plane,
  GraduationCap,
  Cake,
  CalendarX,
  Clipboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AssistantEventRow, AssistantEventStats } from "./assistant-actions";

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const EVENT_TYPE_CONFIG: Record<
  string,
  { label: string; icon: typeof PartyPopper; accent: string }
> = {
  private_party: { label: "Private Party", icon: PartyPopper, accent: "#c4907a" },
  pop_up: { label: "Pop-Up", icon: Gem, accent: "#d4a574" },
  corporate: { label: "Corporate", icon: Briefcase, accent: "#5b8a8a" },
  bridal: { label: "Bridal", icon: Heart, accent: "#c4907a" },
  birthday: { label: "Birthday", icon: Cake, accent: "#d4a574" },
  travel: { label: "Travel", icon: Plane, accent: "#7ba3a3" },
  workshop: { label: "Workshop", icon: GraduationCap, accent: "#4e6b51" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-foreground/5 text-muted border-foreground/10" },
  upcoming: { label: "Upcoming", className: "bg-accent/10 text-accent border-accent/20" },
  confirmed: {
    label: "Confirmed",
    className: "bg-foreground/8 text-foreground border-foreground/15",
  },
  in_progress: { label: "In Progress", className: "bg-blush/12 text-[#96604a] border-blush/20" },
  completed: {
    label: "Completed",
    className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

const STATUS_FILTERS = ["All", "Upcoming", "Completed", "Cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function formatEventDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

/* ------------------------------------------------------------------ */
/*  Event card                                                         */
/* ------------------------------------------------------------------ */

function EventCard({ event }: { event: AssistantEventRow }) {
  const typeConfig = EVENT_TYPE_CONFIG[event.eventType] ?? {
    label: event.eventType,
    icon: CalendarDays,
    accent: "#999",
  };
  const TypeIcon = typeConfig.icon;
  const statusCfg = STATUS_CONFIG[event.status] ?? {
    label: event.status,
    className: "bg-foreground/5 text-muted border-foreground/10",
  };

  const isPast = ["completed", "cancelled"].includes(event.status);

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden transition-shadow",
        isPast ? "opacity-70" : "hover:shadow-md",
      )}
    >
      <div className="h-1" style={{ background: typeConfig.accent }} />
      <CardContent className="px-5 py-4 space-y-3">
        {/* Type badge + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${typeConfig.accent}18` }}
            >
              <TypeIcon className="w-4 h-4" style={{ color: typeConfig.accent }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              {typeConfig.label}
            </span>
          </div>
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", statusCfg.className)}>
            {statusCfg.label}
          </Badge>
        </div>

        {/* Title + description */}
        <div>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{event.title}</h3>
          {event.description && (
            <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-2">
              {event.description}
            </p>
          )}
        </div>

        {/* Date + time */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-muted">
          <span className="flex items-center gap-1">
            <CalendarDays className="w-3 h-3" />
            {formatEventDate(event.startsAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatEventTime(event.startsAt)}
            {event.endsAt && ` – ${formatEventTime(event.endsAt)}`}
          </span>
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-start gap-1.5 text-xs text-muted">
            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
            <div>
              <span className="font-medium text-foreground">{event.location}</span>
              {event.address && <p className="text-[10px] text-muted/70 mt-0.5">{event.address}</p>}
            </div>
          </div>
        )}

        {/* Guest count + your role */}
        <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-border/40">
          {event.maxAttendees != null && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Users className="w-3 h-3" />
              {event.guestCount}/{event.maxAttendees} guests
            </span>
          )}
          {event.role && (
            <span className="text-[10px] font-medium text-accent px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20">
              {event.role}
            </span>
          )}
        </div>

        {/* Equipment notes */}
        {event.equipmentNotes && (
          <div className="flex items-start gap-1.5 text-xs text-muted bg-surface rounded-lg px-3 py-2 border border-border/50">
            <Clipboard className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{event.equipmentNotes}</span>
          </div>
        )}

        {/* Staff notes for this assistant */}
        {event.staffNotes && (
          <p className="text-xs text-muted italic bg-surface rounded-lg px-3 py-2 border border-border/50">
            &ldquo;{event.staffNotes}&rdquo;
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function AssistantEventsPage({
  initialEvents,
  stats,
  embedded,
}: {
  initialEvents: AssistantEventRow[];
  stats: AssistantEventStats;
  /** When true, strips outer padding and page header (used inside Schedule page tabs) */
  embedded?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  const filtered = initialEvents.filter((e) => {
    const matchSearch =
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.location ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All"
        ? true
        : statusFilter === "Upcoming"
          ? ["upcoming", "confirmed", "in_progress"].includes(e.status)
          : statusFilter === "Completed"
            ? e.status === "completed"
            : ["cancelled"].includes(e.status);
    return matchSearch && matchStatus;
  });

  return (
    <div className={cn(embedded ? "space-y-4" : "p-4 md:p-6 lg:p-8 space-y-4")}>
      {!embedded && (
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            My Events
          </h1>
          <p className="text-sm text-muted mt-0.5">Events you&apos;re assigned to</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Upcoming", value: stats.upcoming },
          { label: "Completed", value: stats.completed },
          { label: "Total", value: stats.total },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events…"
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

      {/* Event cards */}
      {filtered.length === 0 ? (
        <Card className="gap-0">
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <CalendarX className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted font-medium">
                {search ? "No events match your search." : "No events assigned yet"}
              </p>
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Clear search
                </button>
              ) : (
                <p className="text-xs text-muted/60 mt-0.5">
                  Events will appear here once your studio owner assigns you.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
