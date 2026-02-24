/**
 * Average days between appointments — overall + per service category.
 *
 * @module analytics/components/AppointmentGapSection
 * @see {@link ../actions.ts} — `AppointmentGapStats` type, `getAppointmentGaps()`
 */
"use client";

import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AppointmentGapStats } from "../actions";

const BAR_COLORS: Record<string, string> = {
  "Lash Services": "bg-[#c4907a]",
  Jewelry: "bg-[#d4a574]",
  Consulting: "bg-[#5b8a8a]",
  Crochet: "bg-[#7ba3a3]",
};

export function AppointmentGapSection({ data }: { data: AppointmentGapStats }) {
  const maxDays = Math.max(...data.byCategory.map((c) => c.avgDays), data.overall ?? 0, 1);

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-muted" /> Avg Days Between Visits
        </CardTitle>
        <p className="text-xs text-muted mt-0.5">Helps set rebooking reminder timing</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {data.overall == null ? (
          <p className="text-sm text-muted text-center py-8">
            Not enough repeat visits to calculate.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 mb-5">
              <span className="text-3xl font-semibold text-foreground tabular-nums">
                {data.overall}
              </span>
              <span className="text-sm text-muted">days overall</span>
            </div>

            {data.byCategory.length > 0 && (
              <div className="space-y-3">
                {data.byCategory.map((c) => (
                  <div key={c.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground">{c.category}</span>
                      <span className="text-xs font-medium text-foreground tabular-nums">
                        {c.avgDays} days
                      </span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${BAR_COLORS[c.category] ?? "bg-[#8fa89c]"}`}
                        style={{ width: `${(c.avgDays / maxDays) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
