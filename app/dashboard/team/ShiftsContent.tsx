"use client";

/**
 * ShiftsContent — Shift schedule view extracted from StaffPage.
 * All data is hardcoded for now (no DB schema yet).
 */

import { Clock, CheckCircle2, XCircle, AlertCircle, CalendarDays } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ShiftStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

interface Shift {
  id: number;
  staffId: number;
  staffName: string;
  staffInitials: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  bookedSlots: number;
  totalSlots: number;
  notes?: string;
}

const MOCK_SHIFTS: Shift[] = [
  { id: 1, staffId: 1, staffName: "Trini", staffInitials: "TR", date: "Today", startTime: "9:00 AM", endTime: "6:00 PM", status: "confirmed", bookedSlots: 4, totalSlots: 6 },
  { id: 2, staffId: 2, staffName: "Jasmine", staffInitials: "JC", date: "Today", startTime: "10:00 AM", endTime: "5:00 PM", status: "confirmed", bookedSlots: 2, totalSlots: 4 },
  { id: 3, staffId: 1, staffName: "Trini", staffInitials: "TR", date: "Tomorrow", startTime: "9:00 AM", endTime: "6:00 PM", status: "scheduled", bookedSlots: 3, totalSlots: 6 },
  { id: 4, staffId: 2, staffName: "Jasmine", staffInitials: "JC", date: "Tomorrow", startTime: "11:00 AM", endTime: "5:00 PM", status: "scheduled", bookedSlots: 2, totalSlots: 4 },
  { id: 5, staffId: 3, staffName: "Brianna", staffInitials: "BM", date: "Tomorrow", startTime: "10:00 AM", endTime: "4:00 PM", status: "scheduled", bookedSlots: 1, totalSlots: 3 },
  { id: 6, staffId: 1, staffName: "Trini", staffInitials: "TR", date: "Feb 22", startTime: "9:00 AM", endTime: "6:00 PM", status: "scheduled", bookedSlots: 2, totalSlots: 6 },
  { id: 7, staffId: 4, staffName: "Tasha", staffInitials: "TR2", date: "Feb 22", startTime: "12:00 PM", endTime: "5:00 PM", status: "scheduled", bookedSlots: 1, totalSlots: 3, notes: "Shadowing Trini for first 2 appointments" },
  { id: 8, staffId: 2, staffName: "Jasmine", staffInitials: "JC", date: "Feb 19", startTime: "10:00 AM", endTime: "5:00 PM", status: "completed", bookedSlots: 4, totalSlots: 4 },
  { id: 9, staffId: 3, staffName: "Brianna", staffInitials: "BM", date: "Feb 18", startTime: "9:00 AM", endTime: "3:00 PM", status: "cancelled", bookedSlots: 0, totalSlots: 3, notes: "Called out sick" },
];

function shiftStatusConfig(status: ShiftStatus) {
  switch (status) {
    case "scheduled":
      return { label: "Scheduled", className: "bg-foreground/8 text-foreground border-foreground/15", icon: CalendarDays };
    case "confirmed":
      return { label: "Confirmed", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20", icon: CheckCircle2 };
    case "completed":
      return { label: "Completed", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20", icon: CheckCircle2 };
    case "cancelled":
      return { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle };
    case "no_show":
      return { label: "No Show", className: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertCircle };
  }
}

export function ShiftsContent() {
  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-4">
        <CardTitle className="text-sm font-semibold">Upcoming & Recent Shifts</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3">
        {MOCK_SHIFTS.map((shift) => {
          const status = shiftStatusConfig(shift.status);
          const fillPct = Math.round((shift.bookedSlots / shift.totalSlots) * 100);
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
                {shift.notes && (
                  <p className="text-[10px] text-muted/60 mt-0.5">{shift.notes}</p>
                )}
              </div>

              <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs text-foreground">
                  {shift.bookedSlots}/{shift.totalSlots} booked
                </span>
                <div className="w-20 h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#c4907a] rounded-full"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>

              <Badge
                className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
              >
                {status.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
