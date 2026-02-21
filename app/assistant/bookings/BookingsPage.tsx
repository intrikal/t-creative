"use client";

import { useState } from "react";
import { Search, Clock, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface Booking {
  id: number;
  date: string;
  time: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  clientPhone: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  notes?: string;
}

const BOOKINGS: Booking[] = [
  {
    id: 1,
    date: "Today",
    time: "10:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Maya R.",
    clientInitials: "MR",
    clientPhone: "(404) 555-0192",
    status: "completed",
    durationMin: 90,
    price: 75,
    notes: "Prefers natural look, no drama curl.",
  },
  {
    id: 2,
    date: "Today",
    time: "12:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Priya K.",
    clientInitials: "PK",
    clientPhone: "(404) 555-0148",
    status: "in_progress",
    durationMin: 120,
    price: 140,
  },
  {
    id: 3,
    date: "Today",
    time: "2:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Chloe T.",
    clientInitials: "CT",
    clientPhone: "(404) 555-0173",
    status: "confirmed",
    durationMin: 75,
    price: 75,
  },
  {
    id: 4,
    date: "Today",
    time: "4:30 PM",
    service: "Lash Removal + Rebook",
    category: "lash",
    client: "Amy L.",
    clientInitials: "AL",
    clientPhone: "(404) 555-0109",
    status: "confirmed",
    durationMin: 45,
    price: 35,
  },
  {
    id: 5,
    date: "Feb 22",
    time: "11:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Dana W.",
    clientInitials: "DW",
    clientPhone: "(404) 555-0161",
    status: "confirmed",
    durationMin: 90,
    price: 75,
  },
  {
    id: 6,
    date: "Feb 22",
    time: "2:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Nia B.",
    clientInitials: "NB",
    clientPhone: "(404) 555-0135",
    status: "confirmed",
    durationMin: 120,
    price: 140,
  },
  {
    id: 7,
    date: "Feb 24",
    time: "10:30 AM",
    service: "Hybrid Lashes — Full Set",
    category: "lash",
    client: "Kira M.",
    clientInitials: "KM",
    clientPhone: "(404) 555-0187",
    status: "confirmed",
    durationMin: 90,
    price: 120,
  },
  {
    id: 8,
    date: "Feb 15",
    time: "11:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Lena P.",
    clientInitials: "LP",
    clientPhone: "(404) 555-0122",
    status: "completed",
    durationMin: 120,
    price: 140,
    notes: "Loves extra fluffy. Book her for fill in 3 weeks.",
  },
  {
    id: 9,
    date: "Feb 14",
    time: "10:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Tasha N.",
    clientInitials: "TN",
    clientPhone: "(404) 555-0144",
    status: "completed",
    durationMin: 90,
    price: 75,
  },
  {
    id: 10,
    date: "Feb 10",
    time: "1:00 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Zoe G.",
    clientInitials: "ZG",
    clientPhone: "(404) 555-0156",
    status: "no_show",
    durationMin: 90,
    price: 75,
  },
  {
    id: 11,
    date: "Feb 8",
    time: "3:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Jasmin C.",
    clientInitials: "JC",
    clientPhone: "(404) 555-0178",
    status: "cancelled",
    durationMin: 120,
    price: 140,
  },
  {
    id: 12,
    date: "Feb 5",
    time: "10:00 AM",
    service: "Lash Tint + Lift",
    category: "lash",
    client: "Aisha R.",
    clientInitials: "AR",
    clientPhone: "(404) 555-0133",
    status: "completed",
    durationMin: 60,
    price: 65,
  },
];

const STATUS_FILTERS = ["All", "Upcoming", "Completed", "Cancelled"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function statusConfig(status: BookingStatus) {
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

function categoryDot(cat: ServiceCategory) {
  return {
    lash: "bg-[#c4907a]",
    jewelry: "bg-[#d4a574]",
    crochet: "bg-[#7ba3a3]",
    consulting: "bg-[#5b8a8a]",
  }[cat];
}

export function AssistantBookingsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = BOOKINGS.filter((b) => {
    const matchSearch =
      b.client.toLowerCase().includes(search.toLowerCase()) ||
      b.service.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "All"
        ? true
        : statusFilter === "Upcoming"
          ? ["confirmed", "pending", "in_progress"].includes(b.status)
          : statusFilter === "Completed"
            ? b.status === "completed"
            : ["cancelled", "no_show"].includes(b.status);
    return matchSearch && matchStatus;
  });

  const upcomingCount = BOOKINGS.filter((b) =>
    ["confirmed", "pending", "in_progress"].includes(b.status),
  ).length;
  const completedCount = BOOKINGS.filter((b) => b.status === "completed").length;
  const totalRevenue = BOOKINGS.filter((b) => b.status === "completed").reduce(
    (s, b) => s + b.price,
    0,
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Bookings</h1>
        <p className="text-sm text-muted mt-0.5">Your appointment history and upcoming sessions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Upcoming", value: upcomingCount },
          { label: "Completed", value: completedCount },
          { label: "Revenue", value: `$${totalRevenue}` },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client or service…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
          />
        </div>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                statusFilter === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings list */}
      <Card className="gap-0">
        <CardContent className="px-0 py-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-12">No bookings found.</p>
          ) : (
            filtered.map((b) => {
              const sts = statusConfig(b.status);
              const isExpanded = expanded === b.id;
              return (
                <div key={b.id} className="border-b border-border/40 last:border-0">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : b.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface/60 transition-colors text-left"
                  >
                    <div className="flex flex-col items-center gap-1 shrink-0 w-14">
                      <span className={cn("w-1.5 h-1.5 rounded-full", categoryDot(b.category))} />
                      <span className="text-[10px] text-muted font-medium">{b.date}</span>
                      <span className="text-[10px] text-muted/60">{b.time}</span>
                    </div>
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                        {b.clientInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{b.service}</p>
                      <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        {b.client}
                        <span className="flex items-center gap-0.5 text-muted/60">
                          <Clock className="w-2.5 h-2.5" />
                          {b.durationMin}m
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-semibold text-foreground hidden sm:block">
                        ${b.price}
                      </span>
                      <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                        {sts.label}
                      </Badge>
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-surface/30 space-y-2 border-t border-border/30">
                      <div className="flex items-center gap-2 pt-3">
                        <Phone className="w-3 h-3 text-muted" />
                        <span className="text-xs text-muted">{b.clientPhone}</span>
                      </div>
                      {b.notes && (
                        <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 border border-border/50 italic">
                          &ldquo;{b.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
