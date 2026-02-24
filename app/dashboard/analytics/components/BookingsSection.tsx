/**
 * Bookings section — stacked booking trend bars + service mix breakdown.
 *
 * DB-wired via `getBookingsTrend()` and `getServiceMix()`.
 *
 * @module analytics/components/BookingsSection
 * @see {@link ../actions.ts} — `WeeklyBookings`, `ServiceMixItem` types
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WeeklyBookings, ServiceMixItem } from "../actions";

const SERVICE_MIX_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#c4907a]",
  Jewelry: "bg-[#d4a574]",
  Consulting: "bg-[#5b8a8a]",
  Crochet: "bg-[#7ba3a3]",
};

export function BookingsSection({
  bookingsTrend,
  serviceMix,
}: {
  bookingsTrend: WeeklyBookings[];
  serviceMix: ServiceMixItem[];
}) {
  const BAR_AREA_H = 180;
  const maxBookingBar = Math.max(
    ...bookingsTrend.map((w) => w.lash + w.jewelry + w.crochet + w.consulting),
    1,
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Stacked bar chart */}
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold">Bookings by Week</CardTitle>
            <div className="flex gap-3 flex-wrap">
              {[
                { label: "Lash", color: "bg-[#c4907a]" },
                { label: "Jewelry", color: "bg-[#d4a574]" },
                { label: "Crochet", color: "bg-[#7ba3a3]" },
                { label: "Consulting", color: "bg-[#5b8a8a]" },
              ].map((l) => (
                <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className={cn("w-2 h-2 rounded-sm", l.color)} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="relative h-56">
            {[20, 15, 10, 5]
              .filter((l) => l <= maxBookingBar * 1.1)
              .map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxBookingBar) * BAR_AREA_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-4 text-right shrink-0">
                    {line}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
            <div className="absolute inset-0 flex items-end gap-1.5 pl-6">
              {bookingsTrend.map((w) => {
                const total = w.lash + w.jewelry + w.crochet + w.consulting;
                const barPx = Math.round((total / maxBookingBar) * BAR_AREA_H);
                return (
                  <div
                    key={w.week}
                    className="group relative flex-1 flex flex-col items-center gap-1.5"
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                      <div className="bg-foreground text-background rounded-xl px-3 py-2.5 shadow-xl text-[11px] whitespace-nowrap min-w-[120px]">
                        <p className="font-semibold mb-1.5 pb-1.5 border-b border-background/20">
                          {w.week} · {total} bookings
                        </p>
                        <div className="space-y-1">
                          {[
                            { label: "Lash", value: w.lash, color: "bg-[#c4907a]" },
                            { label: "Jewelry", value: w.jewelry, color: "bg-[#d4a574]" },
                            { label: "Crochet", value: w.crochet, color: "bg-[#7ba3a3]" },
                            { label: "Consulting", value: w.consulting, color: "bg-[#5b8a8a]" },
                          ].map((c) => (
                            <div key={c.label} className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-sm inline-block", c.color)} />
                                {c.label}
                              </span>
                              <span className="font-medium">{c.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                    <div
                      className="w-full flex flex-col rounded-t-sm overflow-hidden cursor-default hover:brightness-110 transition-all"
                      style={{ height: `${barPx}px` }}
                    >
                      <div className="bg-[#c4907a] min-h-0" style={{ flex: w.lash }} />
                      <div className="bg-[#d4a574] min-h-0" style={{ flex: w.jewelry }} />
                      <div className="bg-[#7ba3a3] min-h-0" style={{ flex: w.crochet }} />
                      <div className="bg-[#5b8a8a] min-h-0" style={{ flex: w.consulting }} />
                    </div>
                    <span className="text-[9px] text-muted whitespace-nowrap">{w.week}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service mix */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Service Mix</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 space-y-3.5">
          {serviceMix.map((s) => (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-foreground">{s.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{s.count} appts</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">{s.pct}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", SERVICE_MIX_COLORS[s.label] ?? "bg-accent")}
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
