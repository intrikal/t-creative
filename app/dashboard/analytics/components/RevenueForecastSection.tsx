"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RevenueForecastData } from "@/lib/types/analytics.types";

function fmtUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtUsdCompact(cents: number): string {
  if (cents >= 100_000) return `$${(cents / 100_000).toFixed(0)}k`;
  if (cents >= 10_000) return `$${(cents / 100_00).toFixed(1)}k`;
  return `$${(cents / 100).toFixed(0)}`;
}

export function RevenueForecastSection({ data }: { data: RevenueForecastData }) {
  const { points, completionRate, milestones } = data;

  // Sample every 3rd point for X-axis readability
  const tickIndices = new Set<number>();
  for (let i = 0; i < points.length; i += 7) tickIndices.add(i);

  // Find the 30/60 day indices for reference lines
  const day30Idx = points.findIndex((p, i) => i >= 29);
  const day60Idx = points.findIndex((p, i) => i >= 59);
  const day30Label = points[day30Idx]?.label;
  const day60Label = points[day60Idx]?.label;

  return (
    <div className="space-y-4">
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Revenue Forecast</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            90-day projection based on confirmed bookings, recurring patterns, and membership
            renewals. Confidence band reflects {Math.round(completionRate * 100)}% historical
            completion rate.
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-tertiary)"
                opacity={0.3}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
                interval={6}
              />
              <YAxis
                tickFormatter={(v) => fmtUsdCompact(v)}
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0]?.payload as (typeof points)[0] | undefined;
                  if (!d) return null;
                  return (
                    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs space-y-1">
                      <p className="font-semibold">{label}</p>
                      <p className="text-[#4e6b51]">Confirmed: {fmtUsd(d.confirmed)}</p>
                      <p className="text-[#7ba3a3]">
                        + Recurring: {fmtUsd(d.recurring - d.confirmed)}
                      </p>
                      <p className="text-[#d4a574]">
                        + Membership: {fmtUsd(d.total - d.recurring)}
                      </p>
                      <p className="font-semibold border-t pt-1 mt-1">Total: {fmtUsd(d.total)}</p>
                      <p className="text-muted">
                        Range: {fmtUsd(d.low)} – {fmtUsd(d.high)}
                      </p>
                    </div>
                  );
                }}
              />

              {/* Confidence band (rendered as filled area between low and high) */}
              <Area
                type="monotone"
                dataKey="high"
                fill="#4e6b51"
                fillOpacity={0.06}
                stroke="none"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="low"
                fill="#ffffff"
                fillOpacity={1}
                stroke="none"
                isAnimationActive={false}
              />

              {/* Stacked layers: confirmed → recurring → total */}
              <Area
                type="monotone"
                dataKey="total"
                fill="#d4a574"
                fillOpacity={0.12}
                stroke="#d4a574"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="recurring"
                fill="#7ba3a3"
                fillOpacity={0.12}
                stroke="#7ba3a3"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="confirmed"
                fill="#4e6b51"
                fillOpacity={0.15}
                stroke="#4e6b51"
                strokeWidth={2}
                isAnimationActive={false}
              />

              {/* 30/60 day markers */}
              {day30Label && (
                <ReferenceLine
                  x={day30Label}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  label={{
                    value: "30d",
                    position: "top",
                    fontSize: 10,
                    fill: "var(--color-text-secondary)",
                  }}
                />
              )}
              {day60Label && (
                <ReferenceLine
                  x={day60Label}
                  stroke="var(--color-border)"
                  strokeDasharray="3 3"
                  label={{
                    value: "60d",
                    position: "top",
                    fontSize: 10,
                    fill: "var(--color-text-secondary)",
                  }}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#4e6b51] rounded-full inline-block" /> Confirmed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#7ba3a3] rounded-full inline-block" /> Recurring
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#d4a574] rounded-full inline-block" /> Membership
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 bg-[#4e6b51]/10 rounded-sm inline-block" /> Confidence
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Milestone cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {milestones.map((m) => (
          <Card key={m.days} className="gap-0">
            <CardContent className="px-4 py-4 space-y-2">
              <p className="text-xs font-medium text-muted">{m.days}-Day Forecast</p>
              <p className="text-lg font-bold text-foreground">{fmtUsd(m.total)}</p>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted">Confirmed</span>
                  <span className="font-medium text-[#4e6b51]">{fmtUsd(m.confirmed)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Recurring</span>
                  <span className="font-medium text-[#7ba3a3]">{fmtUsd(m.recurring)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Membership</span>
                  <span className="font-medium text-[#d4a574]">{fmtUsd(m.membership)}</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="text-muted">Range</span>
                  <span className="text-foreground">
                    {fmtUsd(m.low)} – {fmtUsd(m.high)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
