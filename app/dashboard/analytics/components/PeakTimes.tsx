/**
 * Peak times heatmap — bookings by hour-of-day and day-of-week.
 *
 * DB-wired via `getPeakTimes()`. Load values are normalised to 0–100%
 * relative to the busiest slot.
 *
 * @module analytics/components/PeakTimes
 * @see {@link ../actions.ts} — `PeakTimeSlot` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PeakTimeSlot } from "../actions";

function heatColor(load: number) {
  if (load >= 85) return "bg-[#c4907a]";
  if (load >= 60) return "bg-[#d4a574]";
  if (load >= 35) return "bg-[#e8c4b8]";
  return "bg-foreground/8";
}

function busynessLabel(load: number) {
  if (load >= 85) return "Peak";
  if (load >= 60) return "Busy";
  if (load >= 35) return "Moderate";
  return "Low";
}

export function PeakTimesSection({
  byHour,
  byDay,
}: {
  byHour: PeakTimeSlot[];
  byDay: PeakTimeSlot[];
}) {
  const PEAK_BAR_H = 110;

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold">Peak Times</CardTitle>
        <p className="text-xs text-muted mt-0.5">When your studio is busiest</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {/* By hour */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
              By Hour
            </p>
            <div className="flex items-end gap-1 h-36">
              {byHour.map((h) => (
                <div
                  key={h.label}
                  className="group relative flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                    <div className="bg-foreground text-background rounded-xl px-2.5 py-2 shadow-xl text-[11px] whitespace-nowrap">
                      <p className="font-semibold">{h.label}</p>
                      <p className="text-background/70 mt-0.5">
                        {busynessLabel(h.load)} · {h.load}%
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                  </div>
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all cursor-default hover:brightness-110",
                      heatColor(h.load),
                    )}
                    style={{ height: `${Math.round((h.load / 100) * PEAK_BAR_H)}px` }}
                  />
                  <span className="text-[9px] text-muted leading-none">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* By day */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-3">
              By Day
            </p>
            <div className="flex items-end gap-1.5 h-36">
              {byDay.map((d) => (
                <div
                  key={d.label}
                  className="group relative flex-1 flex flex-col items-center gap-1.5"
                >
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                    <div className="bg-foreground text-background rounded-xl px-2.5 py-2 shadow-xl text-[11px] whitespace-nowrap">
                      <p className="font-semibold">{d.label}</p>
                      <p className="text-background/70 mt-0.5">
                        {busynessLabel(d.load)} · {d.load}%
                      </p>
                    </div>
                    <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                  </div>
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all cursor-default hover:brightness-110",
                      heatColor(d.load),
                    )}
                    style={{ height: `${Math.round((d.load / 100) * PEAK_BAR_H)}px` }}
                  />
                  <span className="text-[9px] text-muted leading-none">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 mt-5 pt-4 border-t border-border/50">
          {[
            { label: "Low", color: "bg-foreground/8" },
            { label: "Moderate", color: "bg-[#e8c4b8]" },
            { label: "Busy", color: "bg-[#d4a574]" },
            { label: "Peak", color: "bg-[#c4907a]" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className={cn("w-3 h-3 rounded-sm", l.color)} />
              {l.label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
