"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CalendarDays,
  CalendarX,
  Users,
  MessageSquare,
  Clock,
  ChevronRight,
  CalendarPlus,
  FileText,
  AlertTriangle,
  AlertCircle,
  Info,
  Inbox,
  X,
  Package,
  Image,
  ListOrdered,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RevenueChart } from "./RevenueChart";

import type { Trend, DashboardPageProps } from "./admin-dashboard-types";
import { formatDollars } from "./admin-dashboard-helpers";
import { StatCard } from "./components/AdminStatCard";
import { EmptyState } from "./components/AdminEmptyState";
import { BookingRow, InquiryRow, ClientRow } from "./components/AdminListRows";
import { SetupBanner } from "./components/AdminSetupBanner";

// Re-export types for consumers that import from this file
export type {
  Trend,
  BookingStatus,
  ServiceCategory,
  InquiryStatus,
  AdminStats,
  AdminBooking,
  AdminInquiry,
  AdminClient,
  AdminAlert,
  AdminStaff,
  DashboardPageProps,
} from "./admin-dashboard-types";

/* ------------------------------------------------------------------ */
/*  Quick actions                                                       */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { label: "New Booking", icon: CalendarPlus, href: "/dashboard/bookings", color: "text-blush", bg: "bg-blush/10" },
  { label: "New Invoice", icon: FileText, href: "/dashboard/financial", color: "text-[#4e6b51]", bg: "bg-[#4e6b51]/10" },
  { label: "View Calendar", icon: CalendarDays, href: "/dashboard/calendar", color: "text-accent", bg: "bg-accent/10" },
  { label: "Messages", icon: MessageSquare, href: "/dashboard/messages", color: "text-[#5b8a8a]", bg: "bg-[#5b8a8a]/10" },
  { label: "Upload Media", icon: Image, href: "/dashboard/media", color: "text-[#d4a574]", bg: "bg-[#d4a574]/10" },
  { label: "Inventory", icon: Package, href: "/dashboard/marketplace", color: "text-[#7a5c10]", bg: "bg-[#7a5c10]/10" },
];

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
  setup,
  bookingSlug,
}: DashboardPageProps) {
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [setupDismissed, setSetupDismissed] = useState(true); // default true to avoid flash

  useEffect(() => {
    setSetupDismissed(localStorage.getItem("tc:setup-banner-dismissed") === "true");
  }, []);

  function dismissSetup() {
    localStorage.setItem("tc:setup-banner-dismissed", "true");
    setSetupDismissed(true);
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.includes(a.id));

  // Setup banner visibility
  const setupComplete = setup
    ? !!setup.studioName && !!setup.locationArea && setup.socialCount > 0 && setup.hasPolicies && setup.hasDeposits
    : true;
  const showSetup = !!setup && !setupComplete && !setupDismissed;

  // Primary stats (top 4)
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

  const PRIMARY_STATS = [
    {
      label: "Revenue Today", value: revTodayDisplay, sub: revVsYesterday, trend: revTrend,
      icon: TrendingUp, iconColor: "text-[#4e6b51]", iconBg: "bg-[#4e6b51]/10",
    },
    {
      label: "Appointments", value: String(stats.appointmentsToday),
      sub: `${stats.appointmentsRemaining} remaining today`, trend: "neutral" as Trend,
      icon: CalendarDays, iconColor: "text-blush", iconBg: "bg-blush/10",
    },
    {
      label: "Active Clients", value: String(stats.activeClientsThisMonth),
      sub: `+${stats.newClientsThisWeek} this week`,
      trend: stats.newClientsThisWeek > 0 ? ("up" as Trend) : ("neutral" as Trend),
      icon: Users, iconColor: "text-accent", iconBg: "bg-accent/10",
    },
    {
      label: "Waitlist", value: String(stats.waitlistTotal),
      sub: `${stats.waitlistNotContacted} not contacted`, trend: "neutral" as Trend,
      icon: ListOrdered, iconColor: "text-[#7a5c10]", iconBg: "bg-[#7a5c10]/10",
    },
  ];

  const SECONDARY_STATS = [
    {
      label: "Outstanding", value: formatDollars(stats.outstandingCents),
      sub: `${stats.unpaidInvoiceCount} unpaid invoice${stats.unpaidInvoiceCount !== 1 ? "s" : ""}`,
      trend: stats.outstandingCents > 0 ? ("down" as Trend) : ("neutral" as Trend),
      icon: DollarSign, iconColor: "text-destructive", iconBg: "bg-destructive/10",
    },
    {
      label: "Open Inquiries", value: String(stats.openInquiries),
      sub: `${stats.newInquiriesToday} new today`, trend: "neutral" as Trend,
      icon: MessageSquare, iconColor: "text-[#5b8a8a]", iconBg: "bg-[#5b8a8a]/10",
    },
    {
      label: "Low Stock", value: String(lowStockCount),
      sub: stats.lowStockSupplies > 0
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
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted mt-0.5">{today}</p>
        </div>
        {bookingSlug && (
          <a
            href={`https://tcreative.studio/book/${bookingSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-surface text-foreground transition-colors shrink-0"
          >
            My booking site <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>

      {/* ── Setup banner ─────────────────────────────────────────────── */}
      {showSetup && (
        <SetupBanner setup={setup} bookingSlug={bookingSlug ?? "tcreativestudio"} onDismiss={dismissSetup} />
      )}

      {/* ── Quick actions ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {QUICK_ACTIONS.map(({ label, icon: Icon, href, color, bg }) => (
          <Link
            key={label}
            href={href}
            className="relative group flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-surface border border-border hover:border-foreground/20 hover:shadow-sm transition-all text-center"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
              <Icon className={cn("w-4 h-4", color)} />
            </div>
            <span className="text-xs font-medium text-foreground">{label}</span>
            {label === "Inventory" && lowStockCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-[#7a5c10] text-white text-[9px] font-semibold leading-none">
                {lowStockCount}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[...PRIMARY_STATS, ...SECONDARY_STATS].map((stat) => (
          <StatCard key={stat.label} {...stat} compact />
        ))}
      </div>

      {/* ── Alerts ──────────────────────────────────────────────────── */}
      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => {
            const styles = {
              warning: { bar: "bg-[#7a5c10]", bg: "bg-[#7a5c10]/5 border-[#7a5c10]/20", text: "text-[#7a5c10]", Icon: AlertTriangle },
              error: { bar: "bg-destructive", bg: "bg-destructive/5 border-destructive/20", text: "text-destructive", Icon: AlertCircle },
              info: { bar: "bg-accent", bg: "bg-accent/5 border-accent/20", text: "text-accent", Icon: Info },
            }[alert.type];

            return (
              <div
                key={alert.id}
                className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border text-sm", styles.bg)}
              >
                <div className={cn("w-1 self-stretch rounded-full shrink-0", styles.bar)} />
                <styles.Icon className={cn("w-4 h-4 shrink-0", styles.text)} />
                <p className="flex-1 text-foreground text-sm">{alert.message}</p>
                <Link href={alert.href} className={cn("text-xs font-medium shrink-0 hover:underline", styles.text)}>
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
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <Card className="xl:col-span-3 gap-0 py-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Today&apos;s Schedule</CardTitle>
              <Link href="/dashboard/bookings" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {todayBookings.length > 0 ? (
              todayBookings.map((booking) => <BookingRow key={booking.id} booking={booking} />)
            ) : (
              <EmptyState
                icon={CalendarX}
                message="No appointments today"
                detail="New bookings will appear here once confirmed."
                actionLabel="New Booking"
                actionHref="/dashboard/bookings"
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2 gap-0 py-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Inquiries</CardTitle>
              <Link href="/dashboard/inquiries" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {inquiries.length > 0 ? (
              inquiries.map((inquiry) => <InquiryRow key={inquiry.id} inquiry={inquiry} />)
            ) : (
              <EmptyState
                icon={Inbox}
                message="No open inquiries"
                detail="Inquiries from your website and social links show up here."
                actionLabel="View all"
                actionHref="/dashboard/inquiries"
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue chart ───────────────────────────────────────────── */}
      <Card className="gap-0 py-0">
        <CardHeader className="pb-0 pt-4 px-5">
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
        <CardContent className="px-5 pb-4 pt-3">
          <RevenueChart data={weeklyRevenue} />
        </CardContent>
      </Card>

      {/* ── Staff today + Recent clients ────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
        <Card className="xl:col-span-2 gap-0 py-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Team Today</CardTitle>
              <Link href="/dashboard/assistants" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                Full roster <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {teamToday.length > 0 ? (
              teamToday.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5 py-2.5 border-b border-border/50 last:border-0">
                  <Avatar size="sm">
                    <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                      {s.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", s.status === "on_leave" ? "text-muted" : "text-foreground")}>
                      {s.name}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{s.role}</p>
                  </div>
                  {s.status === "on_leave" ? (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full border bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20 shrink-0">
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
              <EmptyState
                icon={Users}
                message="No shifts scheduled today"
                detail="Team members will appear here when they have shifts."
                actionLabel="Manage roster"
                actionHref="/dashboard/assistants"
              />
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-3 gap-0 py-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Clients</CardTitle>
              <Link href="/dashboard/clients" className="text-xs text-accent hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {recentClients.length > 0 ? (
              recentClients.map((client) => <ClientRow key={client.id} client={client} />)
            ) : (
              <EmptyState
                icon={Users}
                message="No recent clients"
                detail="New clients will appear here as they sign up or book."
                actionLabel="View all clients"
                actionHref="/dashboard/clients"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
