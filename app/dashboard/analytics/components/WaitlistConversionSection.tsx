/**
 * Waitlist conversion analytics — conversion rate, wait times, weekly trend,
 * and per-service breakdown.
 *
 * DB-wired via `getWaitlistConversion()`.
 *
 * @module analytics/components/WaitlistConversionSection
 * @see {@link ../actions.ts} — `WaitlistConversionStats` type
 */
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WaitlistConversionStats } from "../actions";

function rateColor(rate: number) {
  if (rate >= 60) return "text-[#4e6b51]";
  if (rate >= 30) return "text-[#d4a574]";
  return "text-destructive";
}

function rateBarColor(rate: number) {
  if (rate >= 60) return "bg-[#4e6b51]";
  if (rate >= 30) return "bg-[#d4a574]";
  return "bg-destructive/60";
}

export function WaitlistConversionSection({
  data,
}: {
  data: WaitlistConversionStats;
}) {
  if (data.totalEntries === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">
            Waitlist Conversion
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">
            No waitlist entries in this period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Row 1: KPI cards + funnel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="gap-0">
          <CardContent className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Total Entries
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {data.totalEntries}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {data.totalWaiting} still waiting
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardContent className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Conversion Rate
            </p>
            <p
              className={cn(
                "text-2xl font-bold tabular-nums mt-1",
                rateColor(data.conversionRate),
              )}
            >
              {data.conversionRate}%
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              {data.totalBooked} of {data.totalNotified} notified
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardContent className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Avg Wait Time
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {data.avgWaitDays != null ? `${data.avgWaitDays}d` : "—"}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              joined → notified
            </p>
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardContent className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Avg Claim Time
            </p>
            <p className="text-2xl font-bold tabular-nums mt-1">
              {data.avgClaimHours != null ? `${data.avgClaimHours}h` : "—"}
            </p>
            <p className="text-[11px] text-muted mt-0.5">
              notified → booked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Weekly trend chart + by-service breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Weekly trend */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Waitlist Conversion
                </CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Weekly entries vs. conversions vs. expirations
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-2 h-2 rounded-sm bg-[#8b9fac] inline-block" />
                  Joined
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />
                  Booked
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className="w-2 h-2 rounded-sm bg-destructive/60 inline-block" />
                  Expired
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            {data.weeklyTrend.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">
                Not enough data for a weekly trend.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={data.weeklyTrend}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border-tertiary)"
                    opacity={0.3}
                  />
                  <XAxis
                    dataKey="week"
                    tick={{
                      fontSize: 11,
                      fontFamily: "inherit",
                      fill: "var(--color-text-secondary)",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => String(Math.round(v))}
                    tick={{
                      fontSize: 11,
                      fontFamily: "inherit",
                      fill: "var(--color-text-secondary)",
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const joined =
                        (payload.find((p) => p.dataKey === "joined")
                          ?.value as number) ?? 0;
                      const booked =
                        (payload.find((p) => p.dataKey === "booked")
                          ?.value as number) ?? 0;
                      const expired =
                        (payload.find((p) => p.dataKey === "expired")
                          ?.value as number) ?? 0;
                      return (
                        <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                          <p className="font-semibold mb-1.5 pb-1 border-b border-border">
                            {label}
                          </p>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-muted">
                                <span className="w-2 h-2 rounded-sm bg-[#8b9fac] inline-block" />
                                Joined
                              </span>
                              <span className="font-medium">{joined}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-muted">
                                <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />
                                Booked
                              </span>
                              <span className="font-medium">{booked}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="flex items-center gap-1.5 text-muted">
                                <span className="w-2 h-2 rounded-sm bg-destructive/60 inline-block" />
                                Expired
                              </span>
                              <span className="font-medium">{expired}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="joined"
                    fill="#8b9fac"
                    name="Joined"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="booked"
                    fill="#4e6b51"
                    name="Booked"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="expired"
                    fill="hsl(var(--destructive) / 0.6)"
                    name="Expired"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* By service */}
        <Card className="gap-0">
          <CardHeader className="pt-5 pb-0 px-5">
            <CardTitle className="text-sm font-semibold">By Service</CardTitle>
            <p className="text-xs text-muted mt-0.5">
              Conversion rate per service
            </p>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-2">
            {data.byService.length === 0 ? (
              <p className="text-sm text-muted text-center py-8 px-5">
                No service data available.
              </p>
            ) : (
              data.byService.map((s, i) => (
                <div
                  key={s.service}
                  className={cn(
                    "px-5 py-3 hover:bg-surface/60 transition-colors",
                    i !== 0 && "border-t border-border/40",
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground truncate">
                      {s.service}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] text-muted">
                        {s.booked}/{s.entries}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-medium tabular-nums w-8 text-right",
                          rateColor(s.conversionRate),
                        )}
                      >
                        {s.conversionRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        rateBarColor(s.conversionRate),
                      )}
                      style={{ width: `${s.conversionRate}%` }}
                    />
                  </div>
                  {s.avgWaitDays != null && (
                    <p className="text-[10px] text-muted mt-1">
                      ~{s.avgWaitDays}d avg wait
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Funnel summary */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">
            Waitlist Funnel
          </CardTitle>
          <p className="text-xs text-muted mt-0.5">
            How entries flow through the waitlist pipeline
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="flex items-center gap-2 flex-wrap">
            {[
              {
                label: "Joined",
                value: data.totalEntries,
                color: "bg-[#8b9fac]",
              },
              {
                label: "Notified",
                value: data.totalNotified,
                color: "bg-[#d4a574]",
              },
              {
                label: "Booked",
                value: data.totalBooked,
                color: "bg-[#4e6b51]",
              },
              {
                label: "Expired",
                value: data.totalExpired,
                color: "bg-destructive/60",
              },
              {
                label: "Cancelled",
                value: data.totalCancelled,
                color: "bg-muted/40",
              },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 text-center min-w-[80px]",
                      step.color,
                    )}
                  >
                    <p className="text-lg font-bold text-white tabular-nums">
                      {step.value}
                    </p>
                  </div>
                  <p className="text-[10px] font-medium text-muted mt-1">
                    {step.label}
                  </p>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-muted text-lg mb-4">→</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
