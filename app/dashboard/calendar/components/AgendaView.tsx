/**
 * @file AgendaView.tsx
 * @description Chronological list view of upcoming events grouped by date.
 */

"use client";

import { useMemo } from "react";
import { Clock, User, Users, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { DAY_NAMES_SHORT, MONTH_NAMES, TYPE_C, TYPE_LABELS } from "./constants";
import { fmtDate, parseDate, fmt12, isToday } from "./helpers";
import type { CalEvent } from "./types";

export function AgendaView({
  cursor,
  events,
  onEventClick,
}: {
  cursor: Date;
  events: CalEvent[];
  onEventClick: (e: CalEvent) => void;
}) {
  const fromDate = fmtDate(cursor);

  /**
   * Group future events by date for rendering with date headers.
   * 1. Filter to only events on or after the cursor date.
   * 2. Sort by date then start time for chronological order.
   * 3. Group consecutively — push to last group if same date, else start new group.
   * This produces an array of { date, events[] } sections for the agenda list.
   */
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
