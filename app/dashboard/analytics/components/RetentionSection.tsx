/**
 * Retention section — new vs returning client bars + at-risk client list.
 *
 * DB-wired via `getRetentionTrend()` and `getAtRiskClients()`.
 *
 * @module analytics/components/RetentionSection
 * @see {@link ../actions.ts} — `RetentionWeek`, `AtRiskClient` types
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RetentionWeek, AtRiskClient } from "../actions";

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
  const RET_BAR_H = 140;
  const maxRetentionBar = Math.max(...retentionTrend.map((w) => w.newClients + w.returning), 1);

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
          <div className="relative h-48">
            {[10, 20]
              .filter((l) => l <= maxRetentionBar * 1.1)
              .map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${18 + (line / maxRetentionBar) * RET_BAR_H}px` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-4 text-right shrink-0">
                    {line}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
            <div className="absolute inset-0 flex items-end gap-1.5 pl-6">
              {retentionTrend.map((w) => {
                const total = w.newClients + w.returning;
                const barPx = Math.round((total / maxRetentionBar) * RET_BAR_H);
                return (
                  <div
                    key={w.week}
                    className="group relative flex-1 flex flex-col items-center gap-1.5"
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150">
                      <div className="bg-foreground text-background rounded-xl px-3 py-2 shadow-xl text-[11px] whitespace-nowrap">
                        <p className="font-semibold mb-1 pb-1 border-b border-background/20">
                          {w.week} · {total} clients
                        </p>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-sm bg-[#4e6b51] inline-block" />
                              Returning
                            </span>
                            <span className="font-medium">{w.returning}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-sm bg-[#c4907a] inline-block" />
                              New
                            </span>
                            <span className="font-medium">{w.newClients}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
                    </div>
                    <div
                      className="w-full flex flex-col rounded-t-sm overflow-hidden cursor-default hover:brightness-110 transition-all"
                      style={{ height: `${barPx}px` }}
                    >
                      <div className="bg-[#4e6b51] min-h-0" style={{ flex: w.returning }} />
                      <div className="bg-[#c4907a] min-h-0" style={{ flex: w.newClients }} />
                    </div>
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
