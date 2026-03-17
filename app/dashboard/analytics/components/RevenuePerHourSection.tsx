/**
 * Revenue per available hour — bar chart by day of week showing how
 * much revenue each studio-open hour generates on average.
 *
 * DB-wired: data from `getRevenuePerHour()`.
 *
 * @module analytics/components/RevenuePerHourSection
 * @see {@link ../actions.ts} — `RevenuePerHourDay` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RevenuePerHourDay } from "../actions";

function barColor(rph: number, max: number) {
  const ratio = max > 0 ? rph / max : 0;
  if (ratio >= 0.7) return "bg-[#4e6b51]";
  if (ratio >= 0.4) return "bg-[#7ba3a3]";
  return "bg-[#d4a574]";
}

export function RevenuePerHourSection({ data }: { data: RevenuePerHourDay[] }) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalHours = data.reduce((s, d) => s + d.availableHours, 0);
  const overallRph = totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0;
  const maxRph = Math.max(...data.map((d) => d.revenuePerHour), 1);
  const BAR_H = 140;

  if (totalHours === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Revenue per Available Hour</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">
            No business hours configured or no revenue data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Revenue per Available Hour</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Last 30 days — paid revenue / studio open hours by day
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="relative h-52">
            {[50, 100, 150, 200]
              .filter((l) => l <= maxRph * 1.2)
              .map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxRph) * BAR_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-7 text-right shrink-0">
                    ${line}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
            <div className="absolute inset-0 flex items-end gap-1.5 pl-9">
              {data.map((d) => {
                const barPx = maxRph > 0 ? Math.round((d.revenuePerHour / maxRph) * BAR_H) : 0;
                const closed = d.availableHours === 0;
                return (
                  <div
                    key={d.day}
                    className="group relative flex-1 flex flex-col items-center gap-1.5"
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                      <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-xl text-[11px] whitespace-nowrap">
                        <p className="font-semibold">{d.day}</p>
                        {closed ? (
                          <p className="text-background/70 mt-0.5">Closed</p>
                        ) : (
                          <div className="space-y-0.5 mt-0.5">
                            <p className="text-background/70">${d.revenuePerHour}/hr</p>
                            <p className="text-background/50">
                              ${d.revenue.toLocaleString()} over {d.availableHours}h
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                    {closed ? (
                      <div className="w-full flex items-end justify-center h-6">
                        <span className="text-[9px] text-muted/40">—</span>
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "w-full rounded-t-sm hover:brightness-110 transition-all cursor-default",
                          barColor(d.revenuePerHour, maxRph),
                        )}
                        style={{
                          height: `${barPx}px`,
                          minHeight: d.revenuePerHour > 0 ? "4px" : "0",
                        }}
                      />
                    )}
                    <span className="text-[9px] text-muted whitespace-nowrap">
                      {d.day.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Hourly Summary</CardTitle>
          <p className="text-xs text-muted mt-0.5">Last 30 days</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="flex flex-col items-center justify-center py-3 mb-4">
            <span className="text-4xl font-bold tabular-nums text-foreground">${overallRph}</span>
            <p className="text-[11px] text-muted mt-1">avg revenue per open hour</p>
          </div>

          <div className="space-y-2 pt-3 border-t border-border/40">
            {data
              .filter((d) => d.availableHours > 0)
              .sort((a, b) => b.revenuePerHour - a.revenuePerHour)
              .map((d) => (
                <div key={d.day} className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{d.day}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{d.availableHours}h open</span>
                    <span
                      className={cn(
                        "text-xs font-medium tabular-nums w-12 text-right",
                        d.revenuePerHour >= overallRph ? "text-[#4e6b51]" : "text-[#d4a574]",
                      )}
                    >
                      ${d.revenuePerHour}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
