"use client";

import { Clock, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppointmentRow } from "../actions";
import { statusConfig, categoryDot } from "./helpers";

export function ListView({
  appointments,
  todayLabel,
  onApptClick,
}: {
  appointments: AppointmentRow[];
  todayLabel: string;
  onApptClick: (a: AppointmentRow) => void;
}) {
  // Group by day
  const byDay = appointments.reduce<Record<string, AppointmentRow[]>>((acc, a) => {
    (acc[a.dayLabel] ??= []).push(a);
    return acc;
  }, {});

  if (Object.keys(byDay).length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-xl">
        <Clock className="w-8 h-8 text-muted/40 mx-auto mb-2" />
        <p className="text-sm text-muted">No appointments this week.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {Object.entries(byDay).map(([day, appts]) => (
        <div key={day}>
          <div className="flex items-center gap-3 mb-2">
            <p className="text-xs font-semibold text-foreground">{day}</p>
            {day === todayLabel && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                Today
              </span>
            )}
            <span className="text-xs text-muted">
              {appts.length} appointment{appts.length !== 1 ? "s" : ""} · $
              {appts.reduce((s, a) => s + a.price, 0)}
            </span>
          </div>
          <Card className="gap-0">
            <CardContent className="px-0 py-0">
              {appts.map((a) => {
                const sts = statusConfig(a.status);
                return (
                  <div
                    key={a.id}
                    onClick={() => onApptClick(a)}
                    className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                      <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(a.category))} />
                      <span className="text-xs text-muted font-medium tabular-nums">{a.time}</span>
                    </div>
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                        {a.clientInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{a.service}</p>
                      <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        {a.client}
                        <span className="flex items-center gap-0.5 text-muted/60">
                          <Clock className="w-2.5 h-2.5" />
                          {a.durationMin}m
                        </span>
                        {a.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {a.location}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-foreground hidden sm:block">
                        ${a.price}
                      </span>
                      <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                        {sts.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
