"use client";

import type React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Users,
  MessageSquare,
  Clock,
  MapPin,
  Star,
  ChevronRight,
  CalendarPlus,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Package,
  Image,
  ListOrdered,
  DollarSign,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RevenueChart } from "./RevenueChart";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type Trend = "up" | "down" | "neutral";

type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "3d_printing" | "aesthetics";
type InquiryStatus = "new" | "read" | "replied" | "archived";

export interface AdminStats {
  revenueTodayCents: number;
  revenueTodayVsYesterdayPct: number | null;
  appointmentsToday: number;
  appointmentsRemaining: number;
  activeClientsThisMonth: number;
  newClientsThisWeek: number;
  waitlistTotal: number;
  waitlistNotContacted: number;
  outstandingCents: number;
  unpaidInvoiceCount: number;
  openInquiries: number;
  newInquiriesToday: number;
  lowStockProducts: number;
  lowStockSupplies: number;
}

export interface AdminBooking {
  id: number;
  time: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  staff: string;
  status: BookingStatus;
  durationMin: number;
  location?: string;
}

export interface AdminInquiry {
  id: number;
  name: string;
  initials: string;
  interest: ServiceCategory | null;
  message: string;
  time: string;
  status: InquiryStatus;
}

export interface AdminClient {
  id: string;
  name: string;
  initials: string;
  source: string | null;
  joinedAgo: string;
  vip: boolean;
  services: string[];
}

export interface AdminAlert {
  id: string;
  type: "warning" | "error" | "info";
  message: string;
  href: string;
  cta: string;
}

export interface AdminStaff {
  initials: string;
  name: string;
  role: string | null;
  hours: string;
  status: "active" | "on_leave";
}

export interface DashboardPageProps {
  firstName: string;
  lowStockCount: number;
  stats: AdminStats;
  alerts: AdminAlert[];
  todayBookings: AdminBooking[];
  inquiries: AdminInquiry[];
  weeklyRevenue: { day: string; amount: number }[];
  weeklyRevenueTotal: number;
  weeklyRevenueVsPriorPct: number | null;
  recentClients: AdminClient[];
  teamToday: AdminStaff[];
}

/* ------------------------------------------------------------------ */
/*  Quick actions (static)                                             */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { label: "New Booking", icon: CalendarPlus, href: "/dashboard/bookings" },
  { label: "New Invoice", icon: FileText, href: "/dashboard/financial" },
  { label: "View Calendar", icon: CalendarDays, href: "/dashboard/calendar" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/messages" },
  { label: "Upload Media", icon: Image, href: "/dashboard/media" },
  { label: "Inventory", icon: Package, href: "/dashboard/marketplace" },
];

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
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
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "no_show":
      return {
        label: "No Show",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

function categoryDot(category: string) {
  switch (category) {
    case "lash":
      return "bg-[#c4907a]";
    case "jewelry":
      return "bg-[#d4a574]";
    case "crochet":
      return "bg-[#7ba3a3]";
    case "consulting":
      return "bg-[#5b8a8a]";
    default:
      return "bg-muted";
  }
}

function sourceBadge(source: string | null) {
  switch (source) {
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "tiktok":
      return { label: "TikTok", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "pinterest":
      return { label: "Pinterest", className: "bg-rose-50 text-rose-700 border-rose-100" };
    case "word_of_mouth":
      return { label: "Word of Mouth", className: "bg-teal-50 text-teal-700 border-teal-100" };
    case "google_search":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "referral":
      return { label: "Referral", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "website_direct":
      return { label: "Website", className: "bg-stone-50 text-stone-600 border-stone-100" };
    case "event":
      return { label: "Event", className: "bg-purple-50 text-purple-700 border-purple-100" };
    default:
      return {
        label: source ?? "Unknown",
        className: "bg-stone-50 text-stone-600 border-stone-100",
      };
  }
}

function inquiryStatusConfig(status: InquiryStatus) {
  switch (status) {
    case "new":
      return { label: "New", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "read":
      return { label: "Read", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "replied":
      return { label: "Replied", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "archived":
      return { label: "Archived", className: "bg-foreground/5 text-muted/60 border-foreground/8" };
  }
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    lash: "Lash",
    jewelry: "Jewelry",
    crochet: "Crochet",
    consulting: "Consulting",
    "3d_printing": "3D Printing",
    aesthetics: "Aesthetics",
  };
  return labels[category] ?? category;
}

function formatDollars(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
  trend,
  icon: Icon,
  iconColor,
  iconBg,
  href,
}: {
  label: string;
  value: string;
  sub: string;
  trend: Trend;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  href?: string;
}) {
  const content = (
    <Card className={cn("gap-0 py-4", href && "hover:border-foreground/20 transition-colors")}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="text-2xl font-semibold text-foreground tracking-tight">{value}</p>
            <div className="flex items-center gap-1 text-xs text-muted">
              {trend === "up" && <TrendingUp className="w-3 h-3 text-[#4e6b51]" />}
              {trend === "down" && <TrendingDown className="w-3 h-3 text-destructive" />}
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

  return href ? <Link href={href}>{content}</Link> : content;
}

function BookingRow({ booking }: { booking: AdminBooking }) {
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
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-muted">{booking.staff}</span>
        <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {booking.durationMin}m
        </span>
      </div>
      <Badge className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}>
        {status.label}
      </Badge>
    </div>
  );
}

function InquiryRow({ inquiry }: { inquiry: AdminInquiry }) {
  const status = inquiryStatusConfig(inquiry.status);
  return (
    <div className="flex gap-3 py-3 border-b border-border/50 last:border-0">
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
          {inquiry.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{inquiry.name}</span>
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
            {status.label}
          </Badge>
          {inquiry.interest && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-foreground/5 text-muted border-foreground/8">
              {categoryLabel(inquiry.interest)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{inquiry.message}</p>
        <p className="text-[10px] text-muted/60 mt-1">{inquiry.time}</p>
      </div>
    </div>
  );
}

function ClientRow({ client }: { client: AdminClient }) {
  const src = sourceBadge(client.source);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
      <Avatar>
        <AvatarFallback className="bg-surface text-muted text-xs font-semibold">
          {client.initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{client.name}</span>
          {client.vip && (
            <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574]" aria-label="VIP" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <Badge className={cn("border text-[10px] px-1.5 py-0.5", src.className)}>
            {src.label}
          </Badge>
          {client.services.map((s) => (
            <span
              key={s}
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryDot(s))}
              title={categoryLabel(s)}
            />
          ))}
        </div>
      </div>
      <span className="text-[10px] text-muted/70 shrink-0 hidden sm:block">{client.joinedAgo}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function DashboardPage({
  firstName,
  lowStockCount,
  stats,
  alerts,
  todayBookings,
  inquiries,
  weeklyRevenue,
  weeklyRevenueTotal,
  weeklyRevenueVsPriorPct,
  recentClients,
  teamToday,
}: DashboardPageProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.includes(a.id));

  // Build stats cards from real data
  const revTodayDisplay = formatDollars(stats.revenueTodayCents);
  const revVsYesterday =
    stats.revenueTodayVsYesterdayPct !== null
      ? `${stats.revenueTodayVsYesterdayPct > 0 ? "+" : ""}${stats.revenueTodayVsYesterdayPct}% vs yesterday`
      : "vs yesterday";
  const revTrend: Trend =
    stats.revenueTodayVsYesterdayPct !== null && stats.revenueTodayVsYesterdayPct > 0
      ? "up"
      : stats.revenueTodayVsYesterdayPct !== null && stats.revenueTodayVsYesterdayPct < 0
        ? "down"
        : "neutral";

  const STATS = [
    {
      label: "Revenue Today",
      value: revTodayDisplay,
      sub: revVsYesterday,
      trend: revTrend,
      icon: TrendingUp,
      iconColor: "text-[#4e6b51]",
      iconBg: "bg-[#4e6b51]/10",
    },
    {
      label: "Appointments",
      value: String(stats.appointmentsToday),
      sub: `${stats.appointmentsRemaining} remaining today`,
      trend: "neutral" as Trend,
      icon: CalendarDays,
      iconColor: "text-blush",
      iconBg: "bg-blush/10",
    },
    {
      label: "Active Clients",
      value: String(stats.activeClientsThisMonth),
      sub: `+${stats.newClientsThisWeek} this week`,
      trend: stats.newClientsThisWeek > 0 ? ("up" as Trend) : ("neutral" as Trend),
      icon: Users,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
    {
      label: "Waitlist",
      value: String(stats.waitlistTotal),
      sub: `${stats.waitlistNotContacted} not contacted`,
      trend: "neutral" as Trend,
      icon: ListOrdered,
      iconColor: "text-[#7a5c10]",
      iconBg: "bg-[#7a5c10]/10",
    },
    {
      label: "Outstanding",
      value: formatDollars(stats.outstandingCents),
      sub: `${stats.unpaidInvoiceCount} unpaid invoice${stats.unpaidInvoiceCount !== 1 ? "s" : ""}`,
      trend: stats.outstandingCents > 0 ? ("down" as Trend) : ("neutral" as Trend),
      icon: DollarSign,
      iconColor: "text-destructive",
      iconBg: "bg-destructive/10",
    },
    {
      label: "Open Inquiries",
      value: String(stats.openInquiries),
      sub: `${stats.newInquiriesToday} new today`,
      trend: "neutral" as Trend,
      icon: MessageSquare,
      iconColor: "text-[#5b8a8a]",
      iconBg: "bg-[#5b8a8a]/10",
    },
    {
      label: "Low Stock",
      value: String(lowStockCount),
      sub:
        stats.lowStockSupplies > 0
          ? `${stats.lowStockSupplies} supply item${stats.lowStockSupplies !== 1 ? "s" : ""} below reorder`
          : "all stocked",
      trend: lowStockCount > 0 ? ("down" as Trend) : ("neutral" as Trend),
      icon: Package,
      iconColor: lowStockCount > 0 ? "text-[#7a5c10]" : "text-muted",
      iconBg: lowStockCount > 0 ? "bg-[#7a5c10]/10" : "bg-muted/10",
      href: "/dashboard/marketplace",
    },
  ];

  const weeklyTotalDisplay = `$${weeklyRevenueTotal.toLocaleString()}`;
  const weeklyVsPriorDisplay =
    weeklyRevenueVsPriorPct !== null
      ? weeklyRevenueVsPriorPct > 0
        ? `↑ ${weeklyRevenueVsPriorPct}% vs prior week`
        : weeklyRevenueVsPriorPct < 0
          ? `↓ ${Math.abs(weeklyRevenueVsPriorPct)}% vs prior week`
          : "flat vs prior week"
      : null;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Good morning, {firstName} ✦
        </h1>
        <p className="text-sm text-muted mt-0.5">{today}</p>
      </div>

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href }) => (
          <Link
            key={label}
            href={href}
            className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-sm font-medium text-foreground hover:bg-foreground/5 hover:border-foreground/20 transition-colors"
          >
            <Icon className="w-3.5 h-3.5 text-muted" />
            {label}
            {label === "Inventory" && lowStockCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#7a5c10] text-white text-[10px] font-semibold leading-none">
                {lowStockCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Stats ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => {
            const styles = {
              warning: {
                bar: "bg-[#7a5c10]",
                bg: "bg-[#7a5c10]/5 border-[#7a5c10]/20",
                text: "text-[#7a5c10]",
                Icon: AlertTriangle,
              },
              error: {
                bar: "bg-destructive",
                bg: "bg-destructive/5 border-destructive/20",
                text: "text-destructive",
                Icon: AlertCircle,
              },
              info: {
                bar: "bg-accent",
                bg: "bg-accent/5 border-accent/20",
                text: "text-accent",
                Icon: Info,
              },
            }[alert.type];

            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm",
                  styles.bg,
                )}
              >
                <div className={cn("w-1 self-stretch rounded-full shrink-0", styles.bar)} />
                <styles.Icon className={cn("w-4 h-4 shrink-0", styles.text)} />
                <p className="flex-1 text-foreground text-sm">{alert.message}</p>
                <Link
                  href={alert.href}
                  className={cn("text-xs font-medium shrink-0 hover:underline", styles.text)}
                >
                  {alert.cta}
                </Link>
                <button
                  onClick={() => setDismissedAlerts((prev) => [...prev, alert.id])}
                  className="p-1 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Schedule + Inquiries ────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Today&apos;s Schedule</CardTitle>
              <Link
                href="/dashboard/bookings"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {todayBookings.length > 0 ? (
              todayBookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)
            ) : (
              <p className="text-sm text-muted py-4 text-center">No appointments today</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Inquiries</CardTitle>
              <Link
                href="/dashboard/inquiries"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {inquiries.length > 0 ? (
              inquiries.map((inquiry) => <InquiryRow key={inquiry.id} inquiry={inquiry} />)
            ) : (
              <p className="text-sm text-muted py-4 text-center">No open inquiries</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue chart ───────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Revenue — Last 7 Days</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Total: <span className="font-medium text-foreground">{weeklyTotalDisplay}</span>
                {weeklyVsPriorDisplay && (
                  <span
                    className={cn(
                      "ml-2",
                      weeklyRevenueVsPriorPct !== null && weeklyRevenueVsPriorPct >= 0
                        ? "text-[#4e6b51]"
                        : "text-destructive",
                    )}
                  >
                    {weeklyVsPriorDisplay}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#c4907a] inline-block" /> Today
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#e8c4b8] inline-block" /> Prior days
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-4">
          <RevenueChart data={weeklyRevenue} />
        </CardContent>
      </Card>

      {/* ── Staff today + Recent clients ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Staff on today */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Team Today</CardTitle>
              <Link
                href="/dashboard/assistants"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                Full roster <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {teamToday.length > 0 ? (
              teamToday.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
                >
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {s.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        s.status === "on_leave" ? "text-muted" : "text-foreground",
                      )}
                    >
                      {s.name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{s.role}</p>
                  </div>
                  {s.status === "on_leave" ? (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20 shrink-0">
                      On Leave
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted shrink-0 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {s.hours}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted py-4 text-center">No shifts scheduled today</p>
            )}
          </CardContent>
        </Card>

        {/* Recent clients */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Clients</CardTitle>
              <Link
                href="/dashboard/clients"
                className="text-xs text-accent hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {recentClients.length > 0 ? (
              recentClients.map((client) => <ClientRow key={client.id} client={client} />)
            ) : (
              <p className="text-sm text-muted py-4 text-center">No recent clients</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
