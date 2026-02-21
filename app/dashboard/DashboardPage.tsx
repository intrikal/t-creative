"use client";

import type React from "react";

/**
 * DashboardPage — Trini's admin overview.
 *
 * All data is hardcoded for now. When server actions / API routes are wired
 * up, replace each `MOCK_*` constant with the appropriate `fetch` / server
 * action call in the parent `page.tsx` (which can remain a Server Component).
 *
 * Layout (desktop):
 *   ┌─────────────────────────────────────────────┐
 *   │  4 stat cards (grid)                        │
 *   ├─────────────────────┬───────────────────────┤
 *   │  Today's Schedule   │  Pending Inquiries    │
 *   ├─────────────────────┴───────────────────────┤
 *   │  Revenue — last 7 days (D3 bar chart)       │
 *   ├─────────────────────────────────────────────┤
 *   │  Recent Clients                             │
 *   └─────────────────────────────────────────────┘
 */

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
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RevenueChart } from "./RevenueChart";

/* ------------------------------------------------------------------ */
/*  Hardcoded mock data — replace with real queries later              */
/* ------------------------------------------------------------------ */

type Trend = "up" | "down" | "neutral";

const MOCK_STATS: {
  label: string;
  value: string;
  sub: string;
  trend: Trend;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
}[] = [
  {
    label: "Revenue Today",
    value: "$1,240",
    sub: "+12% vs yesterday",
    trend: "up",
    icon: TrendingUp,
    iconColor: "text-[#4e6b51]",
    iconBg: "bg-[#4e6b51]/10",
  },
  {
    label: "Appointments",
    value: "6",
    sub: "2 remaining today",
    trend: "neutral",
    icon: CalendarDays,
    iconColor: "text-blush",
    iconBg: "bg-blush/10",
  },
  {
    label: "Active Clients",
    value: "48",
    sub: "+3 this week",
    trend: "up",
    icon: Users,
    iconColor: "text-accent",
    iconBg: "bg-accent/10",
  },
  {
    label: "Open Inquiries",
    value: "3",
    sub: "1 new today",
    trend: "neutral",
    icon: MessageSquare,
    iconColor: "text-[#7a5c10]",
    iconBg: "bg-[#7a5c10]/10",
  },
];

type BookingStatus = "completed" | "in_progress" | "confirmed" | "pending" | "cancelled";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface Booking {
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

const MOCK_BOOKINGS: Booking[] = [
  {
    id: 1,
    time: "10:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Sarah M.",
    clientInitials: "SM",
    staff: "Trini",
    status: "completed",
    durationMin: 120,
  },
  {
    id: 2,
    time: "12:00 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Maya R.",
    clientInitials: "MR",
    staff: "Trini",
    status: "in_progress",
    durationMin: 90,
  },
  {
    id: 3,
    time: "1:00 PM",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    client: "Priya K.",
    clientInitials: "PK",
    staff: "Jasmine",
    status: "confirmed",
    durationMin: 45,
  },
  {
    id: 4,
    time: "2:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Chloe T.",
    clientInitials: "CT",
    staff: "Trini",
    status: "confirmed",
    durationMin: 75,
  },
  {
    id: 5,
    time: "4:00 PM",
    service: "Business Consulting",
    category: "consulting",
    client: "Marcus B.",
    clientInitials: "MB",
    staff: "Trini",
    status: "confirmed",
    durationMin: 60,
    location: "Virtual",
  },
  {
    id: 6,
    time: "5:30 PM",
    service: "Custom Crochet Pickup",
    category: "crochet",
    client: "Amy L.",
    clientInitials: "AL",
    staff: "Trini",
    status: "pending",
    durationMin: 30,
  },
];

type InquiryStatus = "new" | "read" | "replied" | "archived";

interface Inquiry {
  id: number;
  name: string;
  initials: string;
  interest: ServiceCategory;
  message: string;
  time: string;
  status: InquiryStatus;
}

const MOCK_INQUIRIES: Inquiry[] = [
  {
    id: 1,
    name: "Jordan Lee",
    initials: "JL",
    interest: "lash",
    message:
      "Hi! I'm interested in a full set of volume lashes for my graduation next month. Do you have availability in late March?",
    time: "1 hour ago",
    status: "new",
  },
  {
    id: 2,
    name: "Camille Foster",
    initials: "CF",
    interest: "jewelry",
    message:
      "Do you do matching sets? I'd love permanent jewelry for me and my sister as a birthday gift.",
    time: "3 hours ago",
    status: "new",
  },
  {
    id: 3,
    name: "Marcus Webb",
    initials: "MW",
    interest: "consulting",
    message:
      "I'm launching a beauty brand and need help structuring HR processes for a small team of 5.",
    time: "Yesterday",
    status: "read",
  },
];

type ClientSource = "instagram" | "word_of_mouth" | "google_search" | "referral" | "website_direct";

interface RecentClient {
  id: number;
  name: string;
  initials: string;
  source: ClientSource;
  joinedAgo: string;
  vip: boolean;
  services: ServiceCategory[];
}

const MOCK_RECENT_CLIENTS: RecentClient[] = [
  {
    id: 1,
    name: "Amara Johnson",
    initials: "AJ",
    source: "instagram",
    joinedAgo: "2 hours ago",
    vip: false,
    services: ["lash"],
  },
  {
    id: 2,
    name: "Destiny Cruz",
    initials: "DC",
    source: "referral",
    joinedAgo: "Yesterday",
    vip: true,
    services: ["lash", "jewelry"],
  },
  {
    id: 3,
    name: "Keisha Williams",
    initials: "KW",
    source: "word_of_mouth",
    joinedAgo: "2 days ago",
    vip: false,
    services: ["crochet"],
  },
  {
    id: 4,
    name: "Tanya Brown",
    initials: "TB",
    source: "google_search",
    joinedAgo: "3 days ago",
    vip: false,
    services: ["consulting"],
  },
  {
    id: 5,
    name: "Nina Patel",
    initials: "NP",
    source: "instagram",
    joinedAgo: "4 days ago",
    vip: true,
    services: ["jewelry"],
  },
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

function sourceBadge(source: ClientSource) {
  switch (source) {
    case "instagram":
      return { label: "Instagram", className: "bg-pink-50 text-pink-700 border-pink-100" };
    case "word_of_mouth":
      return { label: "Word of Mouth", className: "bg-teal-50 text-teal-700 border-teal-100" };
    case "google_search":
      return { label: "Google", className: "bg-blue-50 text-blue-700 border-blue-100" };
    case "referral":
      return { label: "Referral", className: "bg-amber-50 text-amber-700 border-amber-100" };
    case "website_direct":
      return { label: "Website", className: "bg-stone-50 text-stone-600 border-stone-100" };
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

function categoryLabel(category: ServiceCategory) {
  return { lash: "Lash", jewelry: "Jewelry", crochet: "Crochet", consulting: "Consulting" }[
    category
  ];
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
}: (typeof MOCK_STATS)[number]) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-semibold text-foreground tracking-tight">{value}</p>
            <div className="flex items-center gap-1 text-xs text-muted">
              {trend === "up" && <TrendingUp className="w-3 h-3 text-[#4e6b51]" />}
              {trend === "down" && <TrendingDown className="w-3 h-3 text-destructive" />}
              <span>{sub}</span>
            </div>
          </div>
          <div className={cn("rounded-xl p-2.5 shrink-0", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
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
      {/* Category dot + time */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
        <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.category))} />
        <span className="text-xs text-muted font-medium tabular-nums">{booking.time}</span>
      </div>

      {/* Client avatar */}
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
          {booking.clientInitials}
        </AvatarFallback>
      </Avatar>

      {/* Service + client */}
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

      {/* Staff + duration — hidden on small mobile */}
      <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
        <span className="text-xs text-muted">{booking.staff}</span>
        <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {booking.durationMin}m
        </span>
      </div>

      {/* Status badge */}
      <Badge className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}>
        {status.label}
      </Badge>
    </div>
  );
}

function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
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
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border",
              "bg-foreground/5 text-muted border-foreground/8",
            )}
          >
            {categoryLabel(inquiry.interest)}
          </span>
        </div>
        <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">{inquiry.message}</p>
        <p className="text-[10px] text-muted/60 mt-1">{inquiry.time}</p>
      </div>
    </div>
  );
}

function ClientRow({ client }: { client: RecentClient }) {
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

export function DashboardPage() {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          Good morning, Trini ✦
        </h1>
        <p className="text-sm text-muted mt-0.5">{today}</p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {MOCK_STATS.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {/* ── Schedule + Inquiries ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Today's schedule — wider column */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Today&apos;s Schedule</CardTitle>
              <button className="text-xs text-accent hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {MOCK_BOOKINGS.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </CardContent>
        </Card>

        {/* Pending inquiries — narrower column */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Inquiries</CardTitle>
              <button className="text-xs text-accent hover:underline flex items-center gap-0.5">
                View all <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-2">
            {MOCK_INQUIRIES.map((inquiry) => (
              <InquiryRow key={inquiry.id} inquiry={inquiry} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Revenue chart ──────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-sm font-semibold">Revenue — Last 7 Days</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Total: <span className="font-medium text-foreground">$9,030</span>
                <span className="ml-2 text-[#4e6b51]">↑ 8% vs prior week</span>
              </p>
            </div>
            {/* Legend */}
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
          <RevenueChart />
        </CardContent>
      </Card>

      {/* ── Recent clients ─────────────────────────────────────────── */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Recent Clients</CardTitle>
            <button className="text-xs text-accent hover:underline flex items-center gap-0.5">
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-4 pt-2">
          {MOCK_RECENT_CLIENTS.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
