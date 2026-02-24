/**
 * Cancellation reasons breakdown — horizontal bars per reason.
 *
 * @module analytics/components/CancellationReasonsSection
 * @see {@link ../actions.ts} — `CancellationReasonItem` type, `getCancellationReasons()`
 */
"use client";

import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CancellationReasonItem } from "../actions";

export function CancellationReasonsSection({ reasons }: { reasons: CancellationReasonItem[] }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <XCircle className="w-4 h-4 text-muted" /> Cancellation Reasons
        </CardTitle>
        <p className="text-xs text-muted mt-0.5">Why clients cancel appointments</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3 space-y-3">
        {reasons.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No cancellations recorded.</p>
        ) : (
          reasons.map((r) => (
            <div key={r.reason}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground">{r.reason}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted">{r.pct}%</span>
                  <span className="text-xs font-medium text-foreground tabular-nums">
                    {r.count}
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-destructive/60 transition-all"
                  style={{ width: `${r.pct}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
