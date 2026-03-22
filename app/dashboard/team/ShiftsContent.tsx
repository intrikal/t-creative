"use client";

/**
 * ShiftsContent — Shift schedule view for the Team page.
 * Data fetched via server actions in app/dashboard/staff/actions.ts.
 */

import { useEffect, useState } from "react";
import { Clock, CheckCircle2, XCircle, CalendarDays } from "lucide-react";
import { getShifts } from "@/app/dashboard/staff/actions";
import type { ShiftRow } from "@/lib/types/staff.types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ShiftStatus = ShiftRow["status"];

function shiftStatusConfig(status: ShiftStatus) {
  switch (status) {
    case "scheduled":
      return {
        label: "Scheduled",
        className: "bg-foreground/8 text-foreground border-foreground/15",
        icon: CalendarDays,
      };
    case "in_progress":
      return {
        label: "In Progress",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
        icon: CheckCircle2,
      };
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
        icon: CheckCircle2,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
        icon: XCircle,
      };
  }
}

export function ShiftsContent() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShifts()
      .then(setShifts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">Upcoming & Recent Shifts</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3">
          <p className="text-sm text-muted py-4">Loading shifts…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Upcoming & Recent Shifts</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3">
        {shifts.length === 0 ? (
          <p className="text-sm text-muted py-4">No shifts scheduled.</p>
        ) : (
          shifts.map((shift) => {
            const status = shiftStatusConfig(shift.status);
            return (
              <div
                key={shift.id}
                className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
              >
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                    {shift.staffInitials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{shift.staffName}</p>
                  <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                    <Clock className="w-2.5 h-2.5" />
                    {shift.date} · {shift.startTime}–{shift.endTime}
                  </p>
                  {shift.notes && <p className="text-[10px] text-muted/60 mt-0.5">{shift.notes}</p>}
                </div>

                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-foreground">{shift.bookedSlots} booked</span>
                </div>

                <Badge
                  className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
                >
                  {status.label}
                </Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
