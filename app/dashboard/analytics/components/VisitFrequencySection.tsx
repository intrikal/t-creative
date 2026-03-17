/**
 * Visit frequency distribution — horizontal bar histogram showing how many
 * clients fall into each visit-count bucket (last 12 months).
 *
 * DB-wired: data from `getVisitFrequency()`.
 *
 * @module analytics/components/VisitFrequencySection
 * @see {@link ../actions.ts} — `VisitFrequencyBucket` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { VisitFrequencyBucket } from "../actions";

const BAR_COLORS = ["bg-[#c4907a]", "bg-[#d4a574]", "bg-[#7ba3a3]", "bg-[#4e6b51]", "bg-[#3a5240]"];

export function VisitFrequencySection({ data }: { data: VisitFrequencyBucket[] }) {
  const maxClients = Math.max(...data.map((d) => d.clients), 1);
  const totalClients = data.reduce((s, d) => s + d.clients, 0);

  if (totalClients === 0) {
    return (
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Visit Frequency</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <p className="text-sm text-muted text-center py-8">
            No completed visits in the last 12 months.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold">Visit Frequency</CardTitle>
        <p className="text-xs text-muted mt-0.5">
          Last 12 months — {totalClients} client{totalClients !== 1 ? "s" : ""} by number of
          completed visits
        </p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4 space-y-3">
        {data.map((bucket, i) => (
          <div key={bucket.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-foreground">{bucket.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted">
                  {bucket.clients} client{bucket.clients !== 1 ? "s" : ""}
                </span>
                <span className="text-xs font-medium text-foreground tabular-nums w-7 text-right">
                  {bucket.pct}%
                </span>
              </div>
            </div>
            <div className="h-2.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${BAR_COLORS[i] ?? "bg-foreground/30"}`}
                style={{ width: `${(bucket.clients / maxClients) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
