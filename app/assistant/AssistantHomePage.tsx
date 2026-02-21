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
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                   */
/* ------------------------------------------------------------------ */

type BookingStatus = "completed" | "in_progress" | "confirmed" | "pending";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface Booking {
  id: number;
  time: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  status: BookingStatus;
  durationMin: number;
  location?: string;
}

const MY_BOOKINGS_TODAY: Booking[] = [
  {
    id: 1,
    time: "10:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Maya R.",
    clientInitials: "MR",
    status: "completed",
    durationMin: 90,
  },
  {
    id: 2,
    time: "12:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Priya K.",
    clientInitials: "PK",
    status: "in_progress",
    durationMin: 120,
  },
  {
    id: 3,
    time: "2:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Chloe T.",
    clientInitials: "CT",
    status: "confirmed",
    durationMin: 75,
  },
  {
    id: 4,
    time: "4:30 PM",
    service: "Lash Removal + Rebook",
    category: "lash",
    client: "Amy L.",
    clientInitials: "AL",
    status: "confirmed",
    durationMin: 45,
  },
];

const MOCK_STATS: {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}[] = [
  {
    label: "Appointments Today",
    value: "4",
    sub: "2 remaining",
    trend: "neutral",
    icon: CalendarDays,
    iconColor: "text-blush",
    iconBg: "bg-blush/10",
  },
  {
    label: "Earnings This Week",
    value: "$620",
    sub: "+14% vs last week",
    trend: "up",
    icon: DollarSign,
    iconColor: "text-[#4e6b51]",
    iconBg: "bg-[#4e6b51]/10",
  },
  {
    label: "Clients Served",
    value: "18",
    sub: "this month",
    trend: "neutral",
    icon: Users,
    iconColor: "text-accent",
    iconBg: "bg-accent/10",
  },
  {
    label: "Avg Rating",
    value: "4.9",
    sub: "from 12 reviews",
    trend: "up",
    icon: Star,
    iconColor: "text-[#d4a574]",
    iconBg: "bg-[#d4a574]/10",
  },
];

const QUICK_ACTIONS = [
  { label: "My Schedule", icon: CalendarCheck, href: "/assistant/schedule" },
  { label: "Messages", icon: MessageSquare, href: "/assistant/messages" },
  { label: "My Clients", icon: Users, href: "/assistant/clients" },
  { label: "Earnings", icon: DollarSign, href: "/assistant/earnings" },
  { label: "Training", icon: GraduationCap, href: "/assistant/training" },
];

interface Announcement {
  id: number;
  from: string;
  fromInitials: string;
  message: string;
  time: string;
  pinned?: boolean;
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: 1,
    from: "Trini",
    fromInitials: "TC",
    message:
      "New lash glue protocol starting Monday — please review the updated aftercare guide in Training before your next appointment.",
    time: "Today, 8:30 AM",
    pinned: true,
  },
  {
    id: 2,
    from: "Trini",
    fromInitials: "TC",
    message:
      "Great feedback on last week! Client reviews are up. Keep up the consistency — you're doing amazing.",
    time: "Yesterday",
  },
  {
    id: 3,
    from: "Trini",
    fromInitials: "TC",
    message:
      "Reminder: studio hours are shifting to 10am–7pm starting March 1. Update your availability in Settings.",
    time: "Feb 18",
  },
];

interface TrainingItem {
  id: number;
  title: string;
  category: string;
  completed: boolean;
  dueDate?: string;
}

const TRAINING_ITEMS: TrainingItem[] = [
  {
    id: 1,
    title: "Updated Lash Aftercare Protocol",
    category: "Technique",
    completed: false,
    dueDate: "Due Feb 24",
  },
  {
    id: 2,
    title: "Client Consultation Best Practices",
    category: "Client Care",
    completed: false,
    dueDate: "Due Mar 1",
  },
  {
    id: 3,
    title: "Intro to Volume Lashing",
    category: "Technique",
    completed: true,
  },
  {
    id: 4,
    title: "Permanent Jewelry Safety & Prep",
    category: "Jewelry",
    completed: true,
  },
];

/* ------------------------------------------------------------------ */
/*  Display helpers                                                     */
/* ------------------------------------------------------------------ */

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
}: (typeof MOCK_STATS)[number]) {
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

function BookingRow({ booking }: { booking: Booking }) {
  const status = bookingStatusConfig(booking.status);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
        <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.category))} />
        <span className="text-xs text-muted font-medium tabular-nums">{booking.time}</span>
      </div>
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
          {booking.clientInitials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{booking.service}</p>
        <p className="text-xs text-muted mt-0.5">
          {booking.client}
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
        {booking.durationMin}m
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

export function AssistantHomePage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const completedTraining = TRAINING_ITEMS.filter((t) => t.completed).length;
  const pendingTraining = TRAINING_ITEMS.filter((t) => !t.completed).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Good morning, Jasmine ✦
        </h1>
        <p className="text-sm text-muted mt-0.5">{today}</p>
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
        {MOCK_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Today's schedule + Announcements ────────────────────────── */}
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
            {MY_BOOKINGS_TODAY.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </CardContent>
        </Card>

        {/* Announcements from Trini */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">From Trini</CardTitle>
              <Link
                href="/assistant/messages"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                Messages <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {ANNOUNCEMENTS.map((a) => (
              <div key={a.id} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
                <Avatar size="sm">
                  <AvatarFallback className="text-[10px] bg-accent/10 text-accent font-bold">
                    {a.fromInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{a.from}</span>
                    {a.pinned && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                        Pinned
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5 leading-relaxed line-clamp-3">
                    {a.message}
                  </p>
                  <p className="text-[10px] text-muted/60 mt-1">{a.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Training progress ───────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Training</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                {completedTraining} of {TRAINING_ITEMS.length} completed
                {pendingTraining > 0 && (
                  <span className="ml-2 text-[#7a5c10] font-medium">
                    · {pendingTraining} pending
                  </span>
                )}
              </p>
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
          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full bg-foreground/8 mb-4">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${(completedTraining / TRAINING_ITEMS.length) * 100}%` }}
            />
          </div>
          <div className="space-y-2">
            {TRAINING_ITEMS.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0"
              >
                {item.completed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#4e6b51] shrink-0" />
                ) : (
                  <BookOpen className="w-4 h-4 text-[#7a5c10] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.completed ? "text-muted line-through" : "text-foreground",
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">{item.category}</p>
                </div>
                {item.dueDate && !item.completed && (
                  <span className="text-[10px] font-medium text-[#7a5c10] bg-[#7a5c10]/10 border border-[#7a5c10]/20 px-1.5 py-0.5 rounded-full shrink-0">
                    {item.dueDate}
                  </span>
                )}
                {item.completed && (
                  <span className="text-[10px] font-medium text-[#4e6b51] bg-[#4e6b51]/10 border border-[#4e6b51]/20 px-1.5 py-0.5 rounded-full shrink-0">
                    Done
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
