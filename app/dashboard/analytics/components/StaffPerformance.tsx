/**
 * Staff performance cards — per-staff bookings, revenue, avg ticket, utilization.
 *
 * DB-wired via `getStaffPerformance()`.
 *
 * @module analytics/components/StaffPerformance
 * @see {@link ../actions.ts} — `StaffPerformanceItem` type
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StaffPerformanceItem } from "../actions";

const AVATAR_PALETTE: Record<string, string> = {
  T: "bg-[#c4907a]",
  A: "bg-[#7ba3a3]",
  J: "bg-[#d4a574]",
  M: "bg-[#5b8a8a]",
};

export function StaffPerformanceSection({ staff }: { staff: StaffPerformanceItem[] }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold">Staff Performance</CardTitle>
        <p className="text-xs text-muted mt-0.5">Bookings, revenue, and utilization this period</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {staff.map((s) => (
            <div key={s.name} className="bg-surface rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                    AVATAR_PALETTE[s.avatar] ?? "bg-accent",
                  )}
                >
                  {s.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                  <p className="text-[11px] text-muted truncate">{s.role}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-base font-semibold text-foreground tabular-nums">
                    {s.bookings}
                  </p>
                  <p className="text-[9px] text-muted uppercase tracking-wide">Bookings</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground tabular-nums">
                    ${(s.revenue / 1000).toFixed(1)}k
                  </p>
                  <p className="text-[9px] text-muted uppercase tracking-wide">Revenue</p>
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground tabular-nums">
                    ${s.avgTicket}
                  </p>
                  <p className="text-[9px] text-muted uppercase tracking-wide">Avg Ticket</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-muted">Utilization</span>
                  <span className="text-[10px] font-medium text-foreground tabular-nums">
                    {s.utilization}%
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      s.utilization >= 70
                        ? "bg-[#4e6b51]"
                        : s.utilization >= 45
                          ? "bg-[#d4a574]"
                          : "bg-destructive/60",
                    )}
                    style={{ width: `${s.utilization}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
