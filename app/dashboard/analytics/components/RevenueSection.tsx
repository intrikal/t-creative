/**
 * Revenue section — weekly revenue bar chart + monthly goal arc.
 *
 * DB-wired: bar chart from `getRevenueTrend()`.
 * Hardcoded: monthly goal values (no goal table yet).
 *
 * @module analytics/components/RevenueSection
 * @see {@link ../actions.ts} — `WeeklyRevenue` type
 */
"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WeeklyRevenue } from "../actions";

function GoalArc({ actual, goal }: { actual: number; goal: number }) {
  const pct = Math.min(actual / goal, 1);
  const r = 44;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const strokeDash = circumference * pct;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          className="text-border"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#4e6b51"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
          strokeDashoffset={circumference * 0.25}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: 16, fontWeight: 600 }}
        >
          {Math.round(pct * 100)}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="fill-muted" style={{ fontSize: 9 }}>
          of goal
        </text>
      </svg>
      <div className="text-center">
        <p className="text-base font-semibold text-foreground">${actual.toLocaleString()}</p>
        <p className="text-[11px] text-muted">of ${goal.toLocaleString()} goal</p>
      </div>
    </div>
  );
}

export function RevenueSection({
  revenueTrend,
  revenueMtd,
  revenueGoal,
}: {
  revenueTrend: WeeklyRevenue[];
  revenueMtd: number;
  revenueGoal: number;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Revenue by Week</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" opacity={0.3} />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fontFamily: "inherit", fill: "var(--color-text-secondary)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                      <p className="font-semibold mb-1">{label}</p>
                      <p className="text-muted">${(payload[0].value as number).toLocaleString()}</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                fill="#4e6b51"
                fillOpacity={0.15}
                stroke="#4e6b51"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Monthly Goal</CardTitle>
          <p className="text-xs text-muted mt-0.5">February progress</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 flex items-center justify-center">
          <GoalArc actual={revenueMtd} goal={revenueGoal} />
        </CardContent>
      </Card>
    </div>
  );
}
