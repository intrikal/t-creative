"use client";

/**
 * ClientHomePage — the primary dashboard UI for authenticated clients.
 *
 * ## What
 * A rich, data-driven home screen that gives each client a personalized snapshot
 * of their relationship with T Creative Studio: upcoming appointments, visit
 * history, lifetime spend, loyalty tier, and a lash-fill reminder when their
 * last visit was more than 18 days ago.
 *
 * ## Why it exists (separation of concerns)
 * This is a pure Client Component responsible only for rendering. All data
 * fetching happens in the sibling Server Component (`app/client/page.tsx`),
 * which runs on the server, queries the database, and passes the result as
 * props. This split keeps sensitive database queries off the client bundle
 * and makes the UI independently testable with mock props.
 *
 * ## Key props (ClientHomePageProps)
 * @prop firstName          - Display name for the greeting ("Welcome back, Jane")
 * @prop memberSince        - Profile `createdAt` — drives the "Member Since" stat card
 * @prop totalVisits        - COUNT of completed bookings (all-time)
 * @prop lifetimeSpendCents - SUM of completed booking totals in cents
 * @prop monthSpendCents    - SUM of completed bookings this calendar month in cents
 * @prop loyaltyPoints      - Current signed balance from `loyalty_transactions`
 * @prop upcomingBookings   - Up to 3 pending/confirmed future appointments
 * @prop pastBookings       - Up to 4 most-recent completed appointments
 * @prop lastLashVisitDate  - `startsAt` of the most recent lash-category booking;
 *                            used to trigger the fill-reminder banner
 *
 * ## Loyalty tier logic
 * Tiers (Bronze → Silver → Gold → Platinum) are driven by the `TIERS` constant
 * and `getLoyaltyTier()`. The progress bar uses `loyaltyPct` = points / nextAt
 * capped at 100%, so it never overflows visually.
 *
 * ## Lash fill reminder
 * `fillReminderDaysAway()` returns how many days until the 21-day fill window
 * closes (null when not due). The banner only appears when the result is <= 3,
 * so clients see it during the 3-day "you should book soon" window.
 *
 * ## Related files
 * - app/client/page.tsx           — Server Component that fetches all props
 * - db/schema/users.ts            — `profiles` table (memberSince source)
 * - db/schema/loyalty.ts          — `loyalty_transactions` table (points source)
 */
import type React from "react";
import Link from "next/link";
import {
  CalendarCheck,
  MessageSquare,
  HeartHandshake,
  ChevronRight,
  Clock,
  Sparkles,
  Star,
  Gift,
  CalendarPlus,
  ShoppingBag,
  GraduationCap,
  AlertCircle,
  Receipt,
  Images,
  TrendingUp,
  DollarSign,
  CalendarDays,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface UpcomingBooking {
  id: number;
  startsAt: Date;
  durationMinutes: number;
  status: string;
  serviceName: string | null;
  staffName: string | null;
}

interface PastBooking {
  id: number;
  startsAt: Date;
  totalInCents: number;
  serviceName: string | null;
  serviceCategory: string | null;
  staffName: string | null;
}

export interface ClientHomePageProps {
  firstName: string;
  memberSince: Date | null;
  totalVisits: number;
  lifetimeSpendCents: number;
  monthSpendCents: number;
  loyaltyPoints: number;
  upcomingBookings: UpcomingBooking[];
  pastBookings: PastBooking[];
  lastLashVisitDate: Date | null;
}

/* ------------------------------------------------------------------ */
/*  Loyalty tier config                                                 */
/* ------------------------------------------------------------------ */

const TIERS = [
  { name: "Bronze", min: 0, nextName: "Silver", nextAt: 300, reward: "$10 off" },
  { name: "Silver", min: 300, nextName: "Gold", nextAt: 700, reward: "$25 off" },
  { name: "Gold", min: 700, nextName: "Platinum", nextAt: 1500, reward: "$50 off" },
  { name: "Platinum", min: 1500, nextName: null, nextAt: null, reward: "VIP perks" },
] as const;

function getLoyaltyTier(points: number) {
  return [...TIERS].reverse().find((t) => points >= t.min) ?? TIERS[0];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatMemberSince(date: Date | null): { label: string; sub: string } {
  if (!date) return { label: "—", sub: "" };
  const d = new Date(date);
  const year = d.getFullYear().toString().slice(-2);
  const label = `${MONTHS_SHORT[d.getMonth()]} '${year}`;
  const years = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
  const months = Math.floor((Date.now() - d.getTime()) / (30.44 * 24 * 3600 * 1000));
  const sub =
    years >= 1
      ? `${years} year${years > 1 ? "s" : ""}`
      : months >= 1
        ? `${months} month${months > 1 ? "s" : ""}`
        : "New member";
  return { label, sub };
}

function formatCents(cents: number): string {
  if (cents === 0) return "$0";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatApptDate(date: Date) {
  const d = new Date(date);
  return {
    dow: DAYS_SHORT[d.getDay()].toUpperCase(),
    day: d.getDate().toString(),
    month: MONTHS_SHORT[d.getMonth()],
  };
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fillReminderDaysAway(lastVisit: Date | null): number | null {
  if (!lastVisit) return null;
  const daysSince = Math.floor((Date.now() - new Date(lastVisit).getTime()) / (24 * 3600 * 1000));
  // Recommend fill every 14–21 days; remind when due date is within 3 days
  const dueInDays = 21 - daysSince;
  return dueInDays <= 3 ? dueInDays : null;
}

/* ------------------------------------------------------------------ */
/*  Quick actions                                                       */
/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { label: "Book a Service", icon: CalendarPlus, href: "/client/book" },
  { label: "My Bookings", icon: CalendarCheck, href: "/client/bookings" },
  { label: "Shop", icon: ShoppingBag, href: "/client/shop" },
  { label: "Gallery", icon: Images, href: "/client/gallery" },
  { label: "Training", icon: GraduationCap, href: "/client/training" },
  { label: "Aftercare", icon: HeartHandshake, href: "/client/aftercare" },
  { label: "Messages", icon: MessageSquare, href: "/client/messages" },
  { label: "Invoices", icon: Receipt, href: "/client/invoices" },
];

/* ------------------------------------------------------------------ */
/*  StatCard                                                            */
/* ------------------------------------------------------------------ */

interface StatCardProps {
  label: string;
  value: string;
  sub: string;
  trend?: "up" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}

function StatCard({ label, value, sub, trend, icon: Icon, iconColor, iconBg }: StatCardProps) {
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

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientHomePage({
  firstName,
  memberSince,
  totalVisits,
  lifetimeSpendCents,
  monthSpendCents,
  loyaltyPoints,
  upcomingBookings,
  pastBookings,
  lastLashVisitDate,
}: ClientHomePageProps) {
  const tier = getLoyaltyTier(loyaltyPoints);
  const nextRewardAt = tier.nextAt ?? loyaltyPoints;
  const ptsToNext = tier.nextAt ? Math.max(0, tier.nextAt - loyaltyPoints) : 0;
  const loyaltyPct = tier.nextAt
    ? Math.min(100, Math.round((loyaltyPoints / tier.nextAt) * 100))
    : 100;

  const memberSinceFmt = formatMemberSince(memberSince);
  const monthSpend =
    monthSpendCents > 0 ? `+${formatCents(monthSpendCents)} this month` : "this month";

  const fillDaysAway = fillReminderDaysAway(lastLashVisitDate);
  const lastLashFmt = lastLashVisitDate
    ? `${MONTHS_SHORT[new Date(lastLashVisitDate).getMonth()]} ${new Date(lastLashVisitDate).getDate()}`
    : null;

  const stats: StatCardProps[] = [
    {
      label: "Total Visits",
      value: totalVisits.toString(),
      sub: "all time",
      trend: "neutral",
      icon: CalendarDays,
      iconColor: "text-[#c4907a]",
      iconBg: "bg-[#c4907a]/10",
    },
    {
      label: "Lifetime Spend",
      value: formatCents(lifetimeSpendCents),
      sub: monthSpend,
      trend: monthSpendCents > 0 ? "up" : "neutral",
      icon: DollarSign,
      iconColor: "text-[#4e6b51]",
      iconBg: "bg-[#4e6b51]/10",
    },
    {
      label: "Loyalty Points",
      value: loyaltyPoints.toString(),
      sub: tier.nextAt ? `${ptsToNext} pts to next reward` : "Max tier reached",
      trend: "neutral",
      icon: Gift,
      iconColor: "text-[#d4a574]",
      iconBg: "bg-[#d4a574]/10",
    },
    {
      label: "Member Since",
      value: memberSinceFmt.label,
      sub: memberSinceFmt.sub,
      trend: "neutral",
      icon: Star,
      iconColor: "text-accent",
      iconBg: "bg-accent/10",
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Welcome back{firstName ? `, ${firstName}` : ""} ✦
        </h1>
        <p className="text-sm text-muted mt-0.5">Glad to have you at T Creative Studio</p>
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
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Fill reminder banner (only if lash fill is due soon) ────── */}
      {fillDaysAway !== null && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#c4907a]/30 bg-[#c4907a]/[0.06]">
          <AlertCircle className="w-4 h-4 text-[#c4907a] shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-foreground">
              Your lash fill is due{" "}
              {fillDaysAway <= 0
                ? "today"
                : fillDaysAway === 1
                  ? "tomorrow"
                  : `in ${fillDaysAway} days`}
            </span>
            {lastLashFmt && (
              <span className="text-xs text-muted ml-2 hidden sm:inline">
                Based on your last visit on {lastLashFmt}. Fills are recommended every 2–3 weeks.
              </span>
            )}
          </div>
          <Link
            href="/client/book"
            className="text-xs font-semibold text-[#96604a] hover:text-[#c4907a] transition-colors shrink-0 flex items-center gap-0.5 border border-[#c4907a]/30 rounded-lg px-3 py-1.5"
          >
            Book fill <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ── Two-column body ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Left column */}
        <div className="xl:col-span-3 space-y-4">
          {/* Upcoming appointment */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Upcoming Appointment</CardTitle>
                <Link
                  href="/client/bookings"
                  className="text-xs text-accent hover:underline flex items-center gap-0.5"
                >
                  All bookings <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-4 pt-3">
              {upcomingBookings.length === 0 ? (
                <div className="py-8 text-center">
                  <Sparkles className="w-6 h-6 text-muted/40 mx-auto mb-2" />
                  <p className="text-sm text-muted">No upcoming appointments</p>
                  <Link
                    href="/client/book"
                    className="text-xs text-accent hover:underline mt-1 inline-block"
                  >
                    Book a service
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((appt) => {
                    const { dow, day, month } = formatApptDate(appt.startsAt);
                    return (
                      <div
                        key={appt.id}
                        className="flex items-stretch gap-4 p-4 rounded-xl bg-accent/5 border border-accent/15"
                      >
                        {/* Date block */}
                        <div className="shrink-0 flex flex-col items-center justify-center text-center w-14 border-r border-accent/15 pr-4">
                          <p className="text-[10px] font-semibold text-accent uppercase tracking-wide">
                            {dow}
                          </p>
                          <p className="text-3xl font-bold text-foreground leading-none mt-0.5">
                            {day}
                          </p>
                          <p className="text-[10px] text-muted mt-0.5">{month}</p>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {appt.serviceName ?? "Appointment"}
                              </p>
                              {appt.staffName && (
                                <p className="text-xs text-muted mt-0.5">with {appt.staffName}</p>
                              )}
                            </div>
                            <Badge
                              className={cn(
                                "border text-[10px] px-1.5 py-0.5 shrink-0",
                                appt.status === "confirmed"
                                  ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20"
                                  : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20",
                              )}
                            >
                              {appt.status === "confirmed" ? "Confirmed" : "Pending"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 mt-3">
                            <span className="flex items-center gap-1 text-[11px] text-muted">
                              <Clock className="w-3 h-3" />
                              {formatTime(appt.startsAt)}
                            </span>
                            <span className="text-[11px] text-muted">
                              {appt.durationMinutes} min
                            </span>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button className="text-[11px] font-medium text-muted border border-border rounded-lg px-3 py-1.5 hover:border-foreground/20 hover:text-foreground transition-colors">
                              Reschedule
                            </button>
                            <button className="text-[11px] font-medium text-muted border border-border rounded-lg px-3 py-1.5 hover:border-destructive/30 hover:text-destructive transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent visit history */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-[#c4907a]" />
                  <CardTitle className="text-sm font-semibold">Visit History</CardTitle>
                </div>
                <Link
                  href="/client/bookings"
                  className="text-xs text-accent hover:underline flex items-center gap-0.5"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-2 pt-2">
              {pastBookings.length === 0 ? (
                <div className="py-8 text-center">
                  <Sparkles className="w-6 h-6 text-muted/40 mx-auto mb-2" />
                  <p className="text-sm text-muted">No visits yet</p>
                  <Link
                    href="/client/book"
                    className="text-xs text-accent hover:underline mt-1 inline-block"
                  >
                    Book your first service
                  </Link>
                </div>
              ) : (
                pastBookings.map((appt, i) => {
                  const d = new Date(appt.startsAt);
                  const dateFmt = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
                  return (
                    <div
                      key={appt.id}
                      className={cn(
                        "flex items-center gap-3 py-3",
                        i < pastBookings.length - 1 && "border-b border-border/40",
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-foreground/6 flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-muted/60" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {appt.serviceName ?? "Service"}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {appt.staffName ? `with ${appt.staffName} · ` : ""}
                          {dateFmt}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-foreground shrink-0">
                        {formatCents(appt.totalInCents)}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="xl:col-span-2 space-y-4">
          {/* Loyalty card */}
          <Card className="gap-0">
            <CardHeader className="pb-0 pt-5">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#d4a574]" />
                <CardTitle className="text-sm font-semibold">Loyalty Points</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3 space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-4xl font-bold text-foreground tracking-tight">
                    {loyaltyPoints}
                  </p>
                  <p className="text-xs text-muted mt-1">
                    {tier.nextAt ? `${ptsToNext} pts until your next reward` : "Max tier reached"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
                    {tier.name}
                  </p>
                  {tier.nextName && tier.nextAt && (
                    <p className="text-xs text-muted mt-0.5">
                      → {tier.nextName} at {tier.nextAt}
                    </p>
                  )}
                </div>
              </div>
              {tier.nextAt && (
                <div className="space-y-1">
                  <div className="w-full h-2.5 rounded-full bg-foreground/8">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#d4a574] to-[#c4907a] transition-all"
                      style={{ width: `${loyaltyPct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted/60">
                    <span>0</span>
                    <span>
                      {nextRewardAt} pts = {tier.reward}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted bg-surface rounded-lg px-3 py-2 border border-border leading-relaxed">
                Earn 1 point per $1 spent. Redeem at checkout for discounts.
              </p>
              <Link
                href="/client/shop"
                className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Shop now <ChevronRight className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          {/* Studio note */}
          <Card className="gap-0 border-accent/20 bg-accent/[0.02]">
            <CardContent className="px-5 py-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-accent font-bold text-[10px] tracking-tight">TC</span>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">From T Creative Studio</p>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  Thank you for being a loyal client! Don&apos;t forget to follow your aftercare
                  instructions after each visit to keep your lashes looking their best.
                </p>
                <Link
                  href="/client/aftercare"
                  className="text-xs text-accent hover:underline mt-1.5 inline-flex items-center gap-0.5"
                >
                  View aftercare guide <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
