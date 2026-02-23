"use client";

import type React from "react";
import Link from "next/link";
import {
  CalendarDays,
  MessageSquare,
  Clock,
  MapPin,
  ChevronRight,
  DollarSign,
  GraduationCap,
  TrendingUp,
  CalendarCheck,
  Users,
  Star,
  CheckCircle2,
  BookOpen,
  Inbox,
  CalendarX,
  BookMarked,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

export interface TodayBooking {
  id: number;
  status: BookingStatus;
  startsAt: Date;
  durationMinutes: number;
  totalInCents: number;
  location: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  serviceName: string;
  serviceCategory: ServiceCategory;
}

export interface RecentMessage {
  id: number;
  body: string;
  isRead: boolean;
  createdAt: Date;
  senderFirstName: string | null;
  senderAvatarUrl: string | null;
}

export interface AssistantEnrollment {
  id: number;
  status: "waitlisted" | "enrolled" | "in_progress" | "completed" | "withdrawn";
  progressPercent: number | null;
  programName: string;
  category: ServiceCategory;
}

export interface AssistantStats {
  appointmentsToday: number;
  earningsThisWeek: number; // in cents
  clientsThisMonth: number;
  avgRating: string | null;
}

interface AssistantHomePageProps {
  firstName: string;
  avatarUrl: string | null;
  todayBookings: TodayBooking[];
  stats: AssistantStats;
  recentMessages: RecentMessage[];
  enrollments: AssistantEnrollment[];
}

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { label: "My Schedule", icon: CalendarCheck, href: "/assistant/schedule" },
  { label: "Messages", icon: MessageSquare, href: "/assistant/messages" },
  { label: "My Clients", icon: Users, href: "/assistant/clients" },
  { label: "Earnings", icon: DollarSign, href: "/assistant/earnings" },
  { label: "Training", icon: GraduationCap, href: "/assistant/training" },
];

function bookingStatusConfig(status: BookingStatus) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "in_progress":
      return { label: "In Progress", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-foreground/8 text-foreground border-foreground/15",
      };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-foreground/5 text-muted/60 border-foreground/10 line-through",
      };
    case "no_show":
      return { label: "No Show", className: "bg-red-400/10 text-red-400/80 border-red-400/20" };
  }
}

function categoryDot(category: ServiceCategory) {
  switch (category) {
    case "lash":
      return "bg-[#c4907a]";
    case "jewelry":
      return "bg-[#d4a574]";
    case "crochet":
      return "bg-[#7ba3a3]";
    case "consulting":
      return "bg-[#5b8a8a]";
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatCents(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function enrollmentStatusLabel(
  status: AssistantEnrollment["status"],
  progress: number | null,
): { label: string; color: string } {
  switch (status) {
    case "completed":
      return { label: "Done", color: "text-[#4e6b51] bg-[#4e6b51]/10 border-[#4e6b51]/20" };
    case "in_progress":
      return {
        label: progress != null ? `${progress}%` : "In Progress",
        color: "text-accent bg-accent/10 border-accent/20",
      };
    case "enrolled":
      return {
        label: "Enrolled",
        color: "text-foreground/60 bg-foreground/8 border-foreground/15",
      };
    case "waitlisted":
      return { label: "Waitlisted", color: "text-[#7a5c10] bg-[#7a5c10]/10 border-[#7a5c10]/20" };
    case "withdrawn":
      return { label: "Withdrawn", color: "text-muted/50 bg-foreground/5 border-foreground/8" };
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  iconColor,
  iconBg,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}) {
  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
            <div className="flex items-center gap-1 text-xs text-muted">
              {trend === "up" && <TrendingUp className="w-3 h-3 text-[#4e6b51]" />}
              <span>{sub}</span>
            </div>
          </div>
          <div className={cn("rounded-xl p-2 shrink-0", iconBg)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BookingRow({ booking }: { booking: TodayBooking }) {
  const status = bookingStatusConfig(booking.status);
  const clientName =
    [booking.clientFirstName, booking.clientLastName].filter(Boolean).join(" ") || "Client";
  const initials =
    [booking.clientFirstName?.[0], booking.clientLastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
        <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.serviceCategory))} />
        <span className="text-xs text-muted font-medium tabular-nums">
          {formatTime(booking.startsAt)}
        </span>
      </div>
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{booking.serviceName}</p>
        <p className="text-xs text-muted mt-0.5">
          {clientName}
          {booking.location && (
            <span className="ml-1.5 inline-flex items-center gap-0.5">
              <MapPin className="w-2.5 h-2.5" />
              {booking.location}
            </span>
          )}
        </p>
      </div>
      <span className="text-[10px] text-muted/60 flex items-center gap-0.5 shrink-0 hidden sm:flex">
        <Clock className="w-2.5 h-2.5" />
        {booking.durationMinutes}m
      </span>
      <Badge className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}>
        {status.label}
      </Badge>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function AssistantHomePage({
  firstName,
  avatarUrl,
  todayBookings,
  stats,
  recentMessages,
  enrollments,
}: AssistantHomePageProps) {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const completedEnrollments = enrollments.filter((e) => e.status === "completed").length;
  const activeEnrollments = enrollments.filter(
    (e) => e.status === "enrolled" || e.status === "in_progress",
  ).length;

  const statCards = [
    {
      label: "Appointments Today",
      value: String(stats.appointmentsToday),
      sub:
        stats.appointmentsToday > 0
          ? `${todayBookings.filter((b) => b.status === "confirmed" || b.status === "pending").length} remaining`
          : "None scheduled",
      trend: "neutral" as const,
      icon: CalendarDays,
      iconColor: "text-blush",
      iconBg: "bg-blush/10",
    },
    {
      label: "Earnings This Week",
      value: stats.earningsThisWeek > 0 ? formatCents(stats.earningsThisWeek) : "—",
      sub: stats.earningsThisWeek > 0 ? "from completed appts" : "No completed appts yet",
      trend: "neutral" as const,
      icon: DollarSign,
      iconColor: "text-[#4e6b51]",
      iconBg: "bg-[#4e6b51]/10",
    },
    {
      label: "Clients Served",
      value: String(stats.clientsThisMonth),
      sub: "this month",
      trend: "neutral" as const,
      icon: Users,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      label: "Avg Rating",
      value: stats.avgRating ?? "—",
      sub: stats.avgRating ? "from client reviews" : "No reviews yet",
      trend: stats.avgRating ? ("up" as const) : ("neutral" as const),
      icon: Star,
      iconColor: "text-[#d4a574]",
      iconBg: "bg-[#d4a574]/10",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={firstName}
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        )}
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {greeting}, {firstName} ✦
          </h1>
          <p className="text-sm text-muted mt-0.5">{today}</p>
        </div>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-foreground hover:bg-foreground/5 hover:border-foreground/20 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-muted" />
            {label}
          </Link>
        ))}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Today's schedule + Messages ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Schedule */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">My Schedule Today</CardTitle>
              <Link
                href="/assistant/schedule"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                Full schedule <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {todayBookings.length > 0 ? (
              todayBookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CalendarX className="w-8 h-8 text-foreground/15 mb-2" />
                <p className="text-sm text-muted/60 font-medium">No appointments today</p>
                <p className="text-xs text-muted/40 mt-0.5">
                  Your upcoming shifts will appear here once scheduled.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Messages */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Messages</CardTitle>
              <Link
                href="/assistant/messages"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                All <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {recentMessages.length > 0 ? (
              recentMessages.map((msg) => {
                const initials = msg.senderFirstName?.[0]?.toUpperCase() ?? "T";
                return (
                  <div
                    key={msg.id}
                    className="flex gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    <Avatar size="sm">
                      {msg.senderAvatarUrl && (
                        <AvatarImage src={msg.senderAvatarUrl} referrerPolicy="no-referrer" />
                      )}
                      <AvatarFallback className="text-[10px] bg-accent/10 text-accent font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {msg.senderFirstName ?? "Studio"}
                        </span>
                        {!msg.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-3">
                        {msg.body}
                      </p>
                      <p className="text-[10px] text-muted/60 mt-1">
                        {relativeTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Inbox className="w-8 h-8 text-foreground/15 mb-2" />
                <p className="text-sm text-muted/60 font-medium">No messages yet</p>
                <p className="text-xs text-muted/40 mt-0.5">
                  Trini will reach out here with updates and announcements.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Training & certifications ───────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Training</CardTitle>
              {enrollments.length > 0 && (
                <p className="text-xs text-muted mt-0.5">
                  {completedEnrollments} of {enrollments.length} completed
                  {activeEnrollments > 0 && (
                    <span className="ml-2 text-[#7a5c10] font-medium">
                      · {activeEnrollments} active
                    </span>
                  )}
                </p>
              )}
            </div>
            <Link
              href="/assistant/training"
              className="text-xs text-accent hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-3">
          {enrollments.length > 0 ? (
            <>
              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-foreground/8 mb-4">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{
                    width: `${enrollments.length > 0 ? (completedEnrollments / enrollments.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="space-y-2">
                {enrollments.map((item) => {
                  const isDone = item.status === "completed";
                  const badge = enrollmentStatusLabel(item.status, item.progressPercent);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-4 h-4 text-[#4e6b51] shrink-0" />
                      ) : (
                        <BookOpen className="w-4 h-4 text-[#7a5c10] shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            isDone ? "text-muted line-through" : "text-foreground",
                          )}
                        >
                          {item.programName}
                        </p>
                        <p className="text-[10px] text-muted mt-0.5 capitalize">{item.category}</p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium border px-1.5 py-0.5 rounded-full shrink-0",
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookMarked className="w-8 h-8 text-foreground/15 mb-2" />
              <p className="text-sm text-muted/60 font-medium">No training assigned yet</p>
              <p className="text-xs text-muted/40 mt-0.5">
                Trini will assign programs here as you join the team.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
