/**
 * Retention section — new vs returning client bars + at-risk client list.
 *
 * DB-wired via `getRetentionTrend()` and `getAtRiskClients()`.
 *
 * @module analytics/components/RetentionSection
 * @see {@link ../actions.ts} — `RetentionWeek`, `AtRiskClient` types
 */
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RetentionWeek, AtRiskClient } from "@/lib/types/analytics.types";

function urgencyColor(urgency: string) {
  if (urgency === "high") return "text-destructive bg-destructive/10";
  if (urgency === "medium") return "text-[#d4a574] bg-[#d4a574]/10";
  return "text-muted bg-foreground/5";
}

export function RetentionSection({
  retentionTrend,
  atRiskClients,
}: {
  retentionTrend: RetentionWeek[];
  atRiskClients: AtRiskClient[];
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* New vs returning stacked bar */}
      <Card className="xl:col-span-2 gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Client Retention</CardTitle>
              <p className="text-xs text-muted mt-0.5">New vs. returning clients by week</p>
            </div>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />
                Returning
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="w-2 h-2 rounded-sm bg-[#c4907a] inline-block" />
                New
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={retentionTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                  const newVal = (payload.find((p) => p.dataKey === "newClients")?.value as number) ?? 0;
                  const retVal = (payload.find((p) => p.dataKey === "returning")?.value as number) ?? 0;
                  return (
                    <div className="bg-background border rounded-lg shadow-md px-3 py-2 text-xs">
                      <p className="font-semibold mb-1.5 pb-1 border-b border-border">{label} · {newVal + retVal} clients</p>
                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />Returning
                          </span>
                          <span className="font-medium">{retVal}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="w-2 h-2 rounded-sm bg-[#c4907a] inline-block" />New
                          </span>
                          <span className="font-medium">{newVal}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="newClients" stackId="a" fill="#d4a574" name="New" radius={[0, 0, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="returning" stackId="a" fill="#4e6b51" name="Returning" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* At-risk clients */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">At-Risk Clients</CardTitle>
          <p className="text-xs text-muted mt-0.5">Haven&apos;t visited in 30+ days</p>
        </CardHeader>
        <CardContent className="px-0 pb-0 pt-2">
          {atRiskClients.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No at-risk clients found.</p>
          ) : (
            atRiskClients.map((c, i) => (
              <div
                key={c.name}
                className={cn(
                  "flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface/60 transition-colors",
                  i !== 0 && "border-t border-border/40",
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted truncate">
                    {c.service} · {c.lastVisit}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0",
                    urgencyColor(c.urgency),
                  )}
                >
                  {c.daysSince}d ago
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
