/**
 * Attendance & rebooking section — attendance breakdown + rebooking rate bars.
 *
 * DB-wired via `getAttendanceStats()` and `getRebookRates()`.
 *
 * @module analytics/components/AttendanceSection
 * @see {@link ../actions.ts} — `AttendanceStats`, `RebookRate` types
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttendanceStats, RebookRate } from "../actions";

const REBOOK_COLORS: Record<string, string> = {
  "Classic Lash Fill": "bg-[#c4907a]",
  "Volume Lashes": "bg-[#c4907a]",
  "Business Consulting": "bg-[#5b8a8a]",
  "Permanent Jewelry": "bg-[#d4a574]",
  "Crochet Install": "bg-[#7ba3a3]",
  "Mega Volume Set": "bg-[#c4907a]",
};

export function AttendanceSection({
  attendance,
  rebookRates,
}: {
  attendance: AttendanceStats;
  rebookRates: RebookRate[];
}) {
  const totalAttendance = attendance.completed + attendance.noShow + attendance.cancelled;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* Attendance breakdown */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Attendance & Cancellations</CardTitle>
          <p className="text-xs text-muted mt-0.5">{totalAttendance} appointments this period</p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 space-y-4">
          <div className="h-4 rounded-full overflow-hidden flex gap-px">
            <div
              className="bg-[#4e6b51]"
              style={{
                width: `${totalAttendance > 0 ? (attendance.completed / totalAttendance) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-[#d4a574]"
              style={{
                width: `${totalAttendance > 0 ? (attendance.cancelled / totalAttendance) * 100 : 0}%`,
              }}
            />
            <div
              className="bg-destructive/70"
              style={{
                width: `${totalAttendance > 0 ? (attendance.noShow / totalAttendance) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center py-3 bg-[#4e6b51]/8 rounded-xl border border-[#4e6b51]/20">
              <p className="text-xl font-semibold text-[#4e6b51] tabular-nums">
                {attendance.completed}
              </p>
              <p className="text-[10px] text-muted mt-0.5">Completed</p>
              <p className="text-[10px] text-[#4e6b51] mt-0.5">
                {totalAttendance > 0
                  ? Math.round((attendance.completed / totalAttendance) * 100)
                  : 0}
                %
              </p>
            </div>
            <div className="text-center py-3 bg-[#d4a574]/8 rounded-xl border border-[#d4a574]/20">
              <p className="text-xl font-semibold text-[#d4a574] tabular-nums">
                {attendance.cancelled}
              </p>
              <p className="text-[10px] text-muted mt-0.5">Cancelled</p>
              <p className="text-[10px] text-[#d4a574] mt-0.5">
                {totalAttendance > 0
                  ? Math.round((attendance.cancelled / totalAttendance) * 100)
                  : 0}
                %
              </p>
            </div>
            <div className="text-center py-3 bg-destructive/8 rounded-xl border border-destructive/20">
              <p className="text-xl font-semibold text-destructive tabular-nums">
                {attendance.noShow}
              </p>
              <p className="text-[10px] text-muted mt-0.5">No-Shows</p>
              <p className="text-[10px] text-destructive mt-0.5">
                {totalAttendance > 0 ? Math.round((attendance.noShow / totalAttendance) * 100) : 0}%
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-xs text-muted">Est. revenue lost to no-shows</span>
            <span className="text-sm font-semibold text-destructive">
              -${attendance.revenueLost.toLocaleString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Rebooking rate by service */}
      <Card className="gap-0">
        <CardHeader className="pt-5 pb-0 px-5">
          <CardTitle className="text-sm font-semibold">Rebooking Rate by Service</CardTitle>
          <p className="text-xs text-muted mt-0.5">
            % of clients who rebooked after their appointment
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4 space-y-3.5">
          {rebookRates.map((s) => (
            <div key={s.service}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-foreground truncate mr-2">{s.service}</span>
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums shrink-0",
                    s.rate >= 70
                      ? "text-[#4e6b51]"
                      : s.rate >= 50
                        ? "text-[#d4a574]"
                        : "text-muted",
                  )}
                >
                  {s.rate}%
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", REBOOK_COLORS[s.service] ?? "bg-accent")}
                  style={{ width: `${s.rate}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
