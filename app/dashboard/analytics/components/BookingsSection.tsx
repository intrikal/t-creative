/**
 * Bookings section — stacked booking trend bars + service mix breakdown.
 *
 * DB-wired via `getBookingsTrend()` and `getServiceMix()`.
 *
 * @module analytics/components/BookingsSection
 * @see {@link ../actions.ts} — `WeeklyBookings`, `ServiceMixItem` types
 */
"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
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
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Stacked area chart */}
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
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={bookingsTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" opacity={0.3} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => String(Math.round(v))}
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const total = payload.reduce((s, p) => s + (p.value as number), 0);
                  return (
                    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                      <p className="font-semibold mb-1.5 pb-1 border-b border-border">{label} · {total} bookings</p>
                      <div className="space-y-0.5">
                        {payload.map((p) => (
                          <div key={String(p.dataKey)} className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5 text-muted capitalize">{p.name}</span>
                            <span className="font-medium">{p.value as number}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="lash" stackId="1" fill="#c4907a" stroke="#c4907a" fillOpacity={0.4} strokeWidth={1.5} name="Lash" isAnimationActive={false} />
              <Area type="monotone" dataKey="jewelry" stackId="1" fill="#d4a574" stroke="#d4a574" fillOpacity={0.4} strokeWidth={1.5} name="Jewelry" isAnimationActive={false} />
              <Area type="monotone" dataKey="crochet" stackId="1" fill="#7ba3a3" stroke="#7ba3a3" fillOpacity={0.4} strokeWidth={1.5} name="Crochet" isAnimationActive={false} />
              <Area type="monotone" dataKey="consulting" stackId="1" fill="#5b8a8a" stroke="#5b8a8a" fillOpacity={0.4} strokeWidth={1.5} name="Consulting" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
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
