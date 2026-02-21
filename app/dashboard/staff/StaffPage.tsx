"use client";

/**
 * StaffPage — Assistant profiles and upcoming shifts.
 *
 * Backed by `assistantProfiles` + `shifts` tables.
 * All data is hardcoded for now.
 */

import { useState } from "react";
import { Users, CalendarDays, Clock, CheckCircle2, XCircle, AlertCircle, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type ShiftStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface StaffMember {
  id: number;
  name: string;
  initials: string;
  role: string;
  email: string;
  phone: string;
  specialties: ServiceCategory[];
  activeBookingsToday: number;
  totalShiftsMonth: number;
  status: "active" | "off_today" | "inactive";
  joinedDate: string;
  bio?: string;
}

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

const MOCK_STAFF: StaffMember[] = [
  {
    id: 1,
    name: "Trini (Owner)",
    initials: "TR",
    role: "Owner & Lead Artist",
    email: "trini@tcreative.com",
    phone: "(404) 555-0001",
    specialties: ["lash", "jewelry", "consulting", "crochet"],
    activeBookingsToday: 4,
    totalShiftsMonth: 22,
    status: "active",
    joinedDate: "Founder",
    bio: "Founder of T Creative Studio. Specializes in volume lashes and permanent jewelry.",
  },
  {
    id: 2,
    name: "Jasmine Carter",
    initials: "JC",
    role: "Lash Artist",
    email: "jasmine@tcreative.com",
    phone: "(404) 555-0002",
    specialties: ["lash", "jewelry"],
    activeBookingsToday: 2,
    totalShiftsMonth: 18,
    status: "active",
    joinedDate: "Aug 2024",
    bio: "3 years experience in lash extensions. Certified in classic, hybrid, and volume techniques.",
  },
  {
    id: 3,
    name: "Brianna Moses",
    initials: "BM",
    role: "Crochet Specialist",
    email: "brianna@tcreative.com",
    phone: "(404) 555-0003",
    specialties: ["crochet"],
    activeBookingsToday: 0,
    totalShiftsMonth: 12,
    status: "off_today",
    joinedDate: "Oct 2024",
    bio: "Expert in crochet braids and custom hair installs.",
  },
  {
    id: 4,
    name: "Tasha Reid",
    initials: "TR2",
    role: "Junior Lash Artist",
    email: "tasha@tcreative.com",
    phone: "(404) 555-0004",
    specialties: ["lash"],
    activeBookingsToday: 0,
    totalShiftsMonth: 8,
    status: "off_today",
    joinedDate: "Jan 2025",
  },
];

const MOCK_SHIFTS: Shift[] = [
  {
    id: 1,
    staffId: 1,
    staffName: "Trini",
    staffInitials: "TR",
    date: "Today",
    startTime: "9:00 AM",
    endTime: "6:00 PM",
    status: "confirmed",
    bookedSlots: 4,
    totalSlots: 6,
  },
  {
    id: 2,
    staffId: 2,
    staffName: "Jasmine",
    staffInitials: "JC",
    date: "Today",
    startTime: "10:00 AM",
    endTime: "5:00 PM",
    status: "confirmed",
    bookedSlots: 2,
    totalSlots: 4,
  },
  {
    id: 3,
    staffId: 1,
    staffName: "Trini",
    staffInitials: "TR",
    date: "Tomorrow",
    startTime: "9:00 AM",
    endTime: "6:00 PM",
    status: "scheduled",
    bookedSlots: 3,
    totalSlots: 6,
  },
  {
    id: 4,
    staffId: 2,
    staffName: "Jasmine",
    staffInitials: "JC",
    date: "Tomorrow",
    startTime: "11:00 AM",
    endTime: "5:00 PM",
    status: "scheduled",
    bookedSlots: 2,
    totalSlots: 4,
  },
  {
    id: 5,
    staffId: 3,
    staffName: "Brianna",
    staffInitials: "BM",
    date: "Tomorrow",
    startTime: "10:00 AM",
    endTime: "4:00 PM",
    status: "scheduled",
    bookedSlots: 1,
    totalSlots: 3,
  },
  {
    id: 6,
    staffId: 1,
    staffName: "Trini",
    staffInitials: "TR",
    date: "Feb 22",
    startTime: "9:00 AM",
    endTime: "6:00 PM",
    status: "scheduled",
    bookedSlots: 2,
    totalSlots: 6,
  },
  {
    id: 7,
    staffId: 4,
    staffName: "Tasha",
    staffInitials: "TR2",
    date: "Feb 22",
    startTime: "12:00 PM",
    endTime: "5:00 PM",
    status: "scheduled",
    bookedSlots: 1,
    totalSlots: 3,
    notes: "Shadowing Trini for first 2 appointments",
  },
  {
    id: 8,
    staffId: 2,
    staffName: "Jasmine",
    staffInitials: "JC",
    date: "Feb 19",
    startTime: "10:00 AM",
    endTime: "5:00 PM",
    status: "completed",
    bookedSlots: 4,
    totalSlots: 4,
  },
  {
    id: 9,
    staffId: 3,
    staffName: "Brianna",
    staffInitials: "BM",
    date: "Feb 18",
    startTime: "9:00 AM",
    endTime: "3:00 PM",
    status: "cancelled",
    bookedSlots: 0,
    totalSlots: 3,
    notes: "Called out sick",
  },
];

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

function shiftStatusConfig(status: ShiftStatus) {
  switch (status) {
    case "scheduled":
      return {
        label: "Scheduled",
        className: "bg-foreground/8 text-foreground border-foreground/15",
        icon: CalendarDays,
      };
    case "confirmed":
      return {
        label: "Confirmed",
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
    case "no_show":
      return {
        label: "No Show",
        className: "bg-destructive/10 text-destructive border-destructive/20",
        icon: AlertCircle,
      };
  }
}

function specialtyDot(category: ServiceCategory) {
  switch (category) {
    case "lash":
      return { dot: "bg-[#c4907a]", label: "Lash" };
    case "jewelry":
      return { dot: "bg-[#d4a574]", label: "Jewelry" };
    case "crochet":
      return { dot: "bg-[#7ba3a3]", label: "Crochet" };
    case "consulting":
      return { dot: "bg-[#5b8a8a]", label: "Consulting" };
  }
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function StaffPage() {
  const [tab, setTab] = useState<"team" | "shifts">("team");

  const activeCount = MOCK_STAFF.filter((s) => s.status === "active").length;
  const totalShiftsToday = MOCK_SHIFTS.filter((s) => s.date === "Today").length;

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
          {MOCK_STAFF.map((member) => (
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

                  {/* Booking fill */}
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
      )}
    </div>
  );
}
