"use client";

/**
 * ClientEventsPage — Read-only view for clients to see their events.
 *
 * Shows event status, details, guest list, and services.
 * Clients can see but not edit events.
 */

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock,
  DollarSign,
  MapPin,
  PartyPopper,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventRow, EventType, EventStatus } from "./actions";

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */

const TYPE_LABELS: Record<EventType, string> = {
  bridal: "Bridal Party",
  pop_up: "Pop-Up",
  travel: "Travel",
  private_party: "Private Party",
  workshop: "Workshop",
  birthday: "Birthday",
  corporate: "Corporate",
};

const TYPE_COLORS: Record<EventType, { bg: string; text: string; border: string }> = {
  bridal: { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-100" },
  pop_up: { bg: "bg-[#d4a574]/10", text: "text-[#a07040]", border: "border-[#d4a574]/25" },
  travel: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
  private_party: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
  workshop: { bg: "bg-[#4e6b51]/10", text: "text-[#4e6b51]", border: "border-[#4e6b51]/20" },
  birthday: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100" },
  corporate: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
};

function statusLabel(status: EventStatus) {
  switch (status) {
    case "draft":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "upcoming":
      return { label: "Upcoming", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    default:
      return { label: status, className: "bg-foreground/8 text-muted border-foreground/12" };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function centsToDisplay(cents: number | null): string {
  if (cents == null || cents === 0) return "";
  return `$${(cents / 100).toLocaleString()}`;
}

/* ------------------------------------------------------------------ */
/*  Client event card                                                   */
/* ------------------------------------------------------------------ */

function ClientEventCard({ event }: { event: EventRow }) {
  const [expanded, setExpanded] = useState(false);
  const status = statusLabel(event.status);
  const typeColors = TYPE_COLORS[event.eventType];
  const paidCount = event.guests.filter((g) => g.paid).length;
  const depDisplay = centsToDisplay(event.depositInCents);

  return (
    <Card className="gap-0">
      <CardContent className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}>
                {status.label}
              </Badge>
            </div>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span
                className={cn(
                  "text-[11px] font-medium px-1.5 py-0.5 rounded-full border",
                  typeColors.bg,
                  typeColors.text,
                  typeColors.border,
                )}
              >
                {TYPE_LABELS[event.eventType]}
              </span>
            </div>

            <div className="flex flex-col gap-1.5 mt-3">
              <span className="text-xs text-muted flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                {formatDate(event.startsAt)}
              </span>
              <span className="text-xs text-muted flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                {formatTime(event.startsAt)}
                {event.endsAt && ` – ${formatTime(event.endsAt)}`}
              </span>
              {event.location && (
                <span className="text-xs text-muted flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {event.location}
                  {event.address && ` · ${event.address}`}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <span className="text-xs text-muted flex items-center gap-1">
                <Users className="w-3 h-3" />
                {event.guests.length}
                {event.maxAttendees != null && ` / ${event.maxAttendees}`} guests
              </span>
              {depDisplay && (
                <span className="text-xs text-muted flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  {depDisplay} deposit
                </span>
              )}
            </div>
          </div>

          {event.guests.length > 0 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors shrink-0"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Services */}
        {event.services && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {event.services.split(",").map((s) => (
              <span
                key={s.trim()}
                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/8 text-accent border border-accent/15"
              >
                {s.trim()}
              </span>
            ))}
          </div>
        )}

        {/* Description */}
        {event.description && (
          <p className="text-xs text-muted mt-3 leading-relaxed">{event.description}</p>
        )}

        {/* Expanded guest list */}
        {expanded && event.guests.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">
              Guest List ({event.guests.length}
              {event.maxAttendees != null && ` / ${event.maxAttendees}`})
            </p>
            <div className="space-y-1.5">
              {event.guests.map((g) => (
                <div key={g.id} className="flex items-center gap-3 text-xs">
                  <span className="flex-1 text-foreground">{g.name}</span>
                  {g.service && <span className="text-muted">{g.service}</span>}
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
                      g.paid
                        ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20"
                        : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20",
                    )}
                  >
                    {g.paid ? "Paid" : "Unpaid"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientEventsPage({ events }: { events: EventRow[] }) {
  const upcoming = events.filter(
    (e) => e.status === "upcoming" || e.status === "confirmed" || e.status === "draft",
  );
  const past = events.filter((e) => e.status === "completed" || e.status === "cancelled");

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Events</h1>
        <p className="text-sm text-muted mt-0.5">Your private events, parties, and bookings</p>
      </div>

      {events.length === 0 ? (
        <Card className="gap-0">
          <CardContent className="px-5 py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mx-auto">
              <PartyPopper className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">No events yet</p>
              <p className="text-xs text-muted mt-1 max-w-xs mx-auto">
                When you book a private event, bridal party, or pop-up with us, it will show up here
                so you can track all the details.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">
                  Upcoming ({upcoming.length})
                </p>
              </div>
              <div className="space-y-3">
                {upcoming.map((e) => (
                  <ClientEventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}

          {/* Past */}
          {past.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Past Events ({past.length})</p>
              <div className="space-y-3">
                {past.map((e) => (
                  <ClientEventCard key={e.id} event={e} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
