import {
  TrendingUp,
  CalendarDays,
  Users,
  ListOrdered,
  DollarSign,
  MessageSquare,
  Package,
} from "lucide-react";
import { formatDollars } from "../admin-dashboard-helpers";
import type { Trend } from "../admin-dashboard-types";
import { getAdminStatsAndAlerts } from "../admin-home-queries";
import { AdminAlertBanners } from "../components/AdminAlertBanners";
import { StatCard } from "../components/AdminStatCard";

export async function AdminStatsSection({ locationId }: { locationId?: number }) {
  const { stats, alerts, lowStockCount } = await getAdminStatsAndAlerts(locationId);

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

  const ALL_STATS = [
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

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {ALL_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} compact />
        ))}
      </div>
      {alerts.length > 0 && <AdminAlertBanners alerts={alerts} />}
    </>
  );
}
