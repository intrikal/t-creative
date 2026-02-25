"use client";

import { useMemo } from "react";
import { Clock, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "../actions";
import {
  fmtDate,
  parseDate,
  DAY_NAMES_SHORT,
  MONTH_NAMES,
  CATEGORY_COLORS,
  fmt12,
} from "./helpers";

export function AgendaView({
  cursor,
  todayKey,
  appointments,
  onApptClick,
}: {
  cursor: Date;
  todayKey: string;
  appointments: AppointmentRow[];
  onApptClick: (a: AppointmentRow) => void;
}) {
  const fromDate = fmtDate(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
  const toDate = fmtDate(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0));

  const grouped = useMemo(() => {
    const filtered = appointments
      .filter((a) => a.date >= fromDate && a.date <= toDate)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime24.localeCompare(b.startTime24));
    const map: { date: string; appts: AppointmentRow[] }[] = [];
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
          const today = date === todayKey;
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
                  const c = CATEGORY_COLORS[a.category];
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
                        <p className="text-sm font-medium text-foreground truncate">{a.service}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {fmt12(a.startTime24)} · {a.durationMin}m
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
