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
  const REV_BAR_H = 160;
  const maxRevenueBar = Math.max(...revenueTrend.map((w) => w.revenue), 1);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Revenue by Week</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <div className="relative h-52">
            {[1000, 2000, 3000]
              .filter((l) => l <= maxRevenueBar * 1.2)
              .map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxRevenueBar) * REV_BAR_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-7 text-right shrink-0">
                    ${line / 1000}k
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
            <div className="absolute inset-0 flex items-end gap-1.5 pl-9">
              {revenueTrend.map((w) => {
                const barPx = Math.round((w.revenue / maxRevenueBar) * REV_BAR_H);
                return (
                  <div
                    key={w.week}
                    className="group relative flex-1 flex flex-col items-center gap-1.5"
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                      <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-xl text-[11px] whitespace-nowrap">
                        <p className="font-semibold">{w.week}</p>
                        <p className="text-background/70 mt-0.5">${w.revenue.toLocaleString()}</p>
                      </div>
                      <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                    <div
                      className="w-full rounded-t-sm bg-[#4e6b51] hover:brightness-110 transition-all cursor-default"
                      style={{ height: `${barPx}px` }}
                    />
                    <span className="text-[9px] text-muted whitespace-nowrap">
                      {w.week.replace("Jan ", "J").replace("Feb ", "F")}
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
