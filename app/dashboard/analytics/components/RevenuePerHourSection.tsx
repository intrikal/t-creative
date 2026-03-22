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

import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RevenuePerHourDay } from "@/lib/types/analytics.types";

export function RevenuePerHourSection({ data }: { data: RevenuePerHourDay[] }) {
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const totalHours = data.reduce((s, d) => s + d.availableHours, 0);
  const overallRph = totalHours > 0 ? Math.round(totalRevenue / totalHours) : 0;
  const maxRph = Math.max(...data.map((d) => d.revenuePerHour), 1);

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
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" opacity={0.3} />
              <XAxis
                dataKey="day"
                tickFormatter={(v) => String(v).slice(0, 3)}
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as RevenuePerHourDay;
                  return (
                    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                      <p className="font-semibold mb-1">{label}</p>
                      {d.availableHours === 0 ? (
                        <p className="text-muted">Closed</p>
                      ) : (
                        <div className="space-y-0.5 text-muted">
                          <p>${d.revenuePerHour}/hr</p>
                          <p>${d.revenue.toLocaleString()} over {d.availableHours}h</p>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Bar dataKey="revenuePerHour" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {data.map((d) => {
                  const ratio = maxRph > 0 ? d.revenuePerHour / maxRph : 0;
                  const fill = ratio >= 0.7 ? "#4e6b51" : ratio >= 0.4 ? "#7ba3a3" : "#d4a574";
                  return <Cell key={d.day} fill={fill} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
