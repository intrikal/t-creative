"use client";

/**
 * StaffPage — Assistant profiles and upcoming shifts.
 *
 * Backed by `assistantProfiles` + `shifts` tables.
 * Data is fetched via server actions and passed as props.
 */

import { useState } from "react";
import { Users, CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StaffRow, ShiftRow } from "./actions";

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

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

function specialtyDot(category: string) {
  switch (category) {
    case "lash":
    case "lash extensions":
      return { dot: "bg-[#c4907a]", label: "Lash" };
    case "jewelry":
    case "permanent jewelry":
      return { dot: "bg-[#d4a574]", label: "Jewelry" };
    case "crochet":
    case "crochet braids":
      return { dot: "bg-[#7ba3a3]", label: "Crochet" };
    case "consulting":
      return { dot: "bg-[#5b8a8a]", label: "Consulting" };
    default:
      return { dot: "bg-muted", label: category };
  }
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

interface StaffPageProps {
  staff: StaffRow[];
  shifts: ShiftRow[];
}

export function StaffPage({ staff, shifts }: StaffPageProps) {
  const [tab, setTab] = useState<"team" | "shifts">("team");

  const activeCount = staff.filter((s) => s.status === "active").length;
  const totalShiftsToday = shifts.filter((s) => s.date === "Today").length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Staff</h1>
          <p className="text-sm text-muted mt-0.5">
            {activeCount} active today · {totalShiftsToday} shifts
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0">
          <Plus className="w-4 h-4" />
          Add Staff
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(["team", "shifts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
              tab === t
                ? "border-foreground text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t === "team" ? (
              <Users className="w-3.5 h-3.5" />
            ) : (
              <CalendarDays className="w-3.5 h-3.5" />
            )}
            {t === "team" ? "Team" : "Shifts"}
          </button>
        ))}
      </div>

      {tab === "team" ? (
        /* ── Team view ─────────────────────────────────────────────── */
        <div className="grid gap-4 sm:grid-cols-2">
          {staff.map((member) => (
            <Card key={member.id} className="gap-0">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar>
                    <AvatarFallback className="bg-surface text-muted text-sm font-semibold">
                      {member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{member.name}</span>
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          member.status === "active" ? "bg-[#4e6b51]" : "bg-muted/40",
                        )}
                      />
                    </div>
                    <p className="text-xs text-muted mt-0.5">{member.role}</p>
                    {member.bio && (
                      <p className="text-xs text-muted/70 mt-1.5 leading-relaxed line-clamp-2">
                        {member.bio}
                      </p>
                    )}

                    {/* Specialties */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {member.specialties.map((s) => {
                        const { dot, label } = specialtyDot(s);
                        return (
                          <span
                            key={s}
                            className="flex items-center gap-1 text-[10px] text-muted border border-border/60 px-1.5 py-0.5 rounded-full"
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />
                            {label}
                          </span>
                        );
                      })}
                    </div>

                    {/* Stats */}
                    <div className="flex gap-4 mt-3 pt-3 border-t border-border/50">
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {member.activeBookingsToday}
                        </p>
                        <p className="text-[10px] text-muted">today</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-foreground">
                          {member.totalShiftsMonth}
                        </p>
                        <p className="text-[10px] text-muted">shifts/month</p>
                      </div>
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted">Joined</p>
                        <p className="text-xs font-medium text-foreground">{member.joinedDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* ── Shifts view ────────────────────────────────────────────── */
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Upcoming & Recent Shifts</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-3">
            {shifts.map((shift) => {
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
                    {shift.notes && (
                      <p className="text-[10px] text-muted/60 mt-0.5">{shift.notes}</p>
                    )}
                  </div>

                  {/* Booking count */}
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
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
