"use client";

/**
 * BookingsPage — Full bookings list with filters.
 *
 * All data is hardcoded. Replace MOCK_BOOKINGS with a server action / fetch
 * when the API is ready.
 */

import { useState } from "react";
import { CalendarDays, Clock, MapPin, Search, ChevronDown, Plus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

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
  staff: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  location?: string;
  notes?: string;
}

const MOCK_BOOKINGS: Booking[] = [
  {
    id: 1,
    date: "Today",
    time: "10:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Sarah Mitchell",
    clientInitials: "SM",
    clientPhone: "(404) 555-0101",
    staff: "Trini",
    status: "completed",
    durationMin: 120,
    price: 180,
  },
  {
    id: 2,
    date: "Today",
    time: "12:00 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Maya Robinson",
    clientInitials: "MR",
    clientPhone: "(404) 555-0102",
    staff: "Trini",
    status: "in_progress",
    durationMin: 90,
    price: 95,
  },
  {
    id: 3,
    date: "Today",
    time: "1:00 PM",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    client: "Priya Kumar",
    clientInitials: "PK",
    clientPhone: "(404) 555-0103",
    staff: "Jasmine",
    status: "confirmed",
    durationMin: 45,
    price: 65,
    location: "Studio",
  },
  {
    id: 4,
    date: "Today",
    time: "2:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Chloe Thompson",
    clientInitials: "CT",
    clientPhone: "(404) 555-0104",
    staff: "Trini",
    status: "confirmed",
    durationMin: 75,
    price: 95,
  },
  {
    id: 5,
    date: "Today",
    time: "4:00 PM",
    service: "Business Consulting",
    category: "consulting",
    client: "Marcus Banks",
    clientInitials: "MB",
    clientPhone: "(404) 555-0105",
    staff: "Trini",
    status: "confirmed",
    durationMin: 60,
    price: 150,
    location: "Virtual",
  },
  {
    id: 6,
    date: "Today",
    time: "5:30 PM",
    service: "Custom Crochet Pickup",
    category: "crochet",
    client: "Amy Lin",
    clientInitials: "AL",
    clientPhone: "(404) 555-0106",
    staff: "Trini",
    status: "pending",
    durationMin: 30,
    price: 40,
  },
  {
    id: 7,
    date: "Tomorrow",
    time: "9:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Tiffany Brown",
    clientInitials: "TB",
    clientPhone: "(404) 555-0107",
    staff: "Trini",
    status: "confirmed",
    durationMin: 120,
    price: 180,
  },
  {
    id: 8,
    date: "Tomorrow",
    time: "11:00 AM",
    service: "Mega Volume Lashes",
    category: "lash",
    client: "Destiny Cruz",
    clientInitials: "DC",
    clientPhone: "(404) 555-0108",
    staff: "Jasmine",
    status: "confirmed",
    durationMin: 150,
    price: 220,
  },
  {
    id: 9,
    date: "Tomorrow",
    time: "2:00 PM",
    service: "Permanent Jewelry Party",
    category: "jewelry",
    client: "Keisha Williams",
    clientInitials: "KW",
    clientPhone: "(404) 555-0109",
    staff: "Trini",
    status: "pending",
    durationMin: 90,
    price: 200,
    notes: "Party of 4, need extra supplies",
  },
  {
    id: 10,
    date: "Feb 22",
    time: "10:30 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Jordan Lee",
    clientInitials: "JL",
    clientPhone: "(404) 555-0110",
    staff: "Trini",
    status: "confirmed",
    durationMin: 75,
    price: 95,
  },
  {
    id: 11,
    date: "Feb 22",
    time: "1:30 PM",
    service: "HR Consulting",
    category: "consulting",
    client: "Aaliyah Washington",
    clientInitials: "AW",
    clientPhone: "(404) 555-0111",
    staff: "Trini",
    status: "confirmed",
    durationMin: 90,
    price: 200,
    location: "Virtual",
  },
  {
    id: 12,
    date: "Feb 19",
    time: "3:00 PM",
    service: "Volume Lashes — Fill",
    category: "lash",
    client: "Nina Patel",
    clientInitials: "NP",
    clientPhone: "(404) 555-0112",
    staff: "Jasmine",
    status: "cancelled",
    durationMin: 90,
    price: 130,
  },
  {
    id: 13,
    date: "Feb 18",
    time: "10:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Amara Johnson",
    clientInitials: "AJ",
    clientPhone: "(404) 555-0113",
    staff: "Trini",
    status: "completed",
    durationMin: 120,
    price: 180,
  },
  {
    id: 14,
    date: "Feb 18",
    time: "12:30 PM",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    client: "Camille Foster",
    clientInitials: "CF",
    clientPhone: "(404) 555-0114",
    staff: "Trini",
    status: "completed",
    durationMin: 45,
    price: 65,
  },
  {
    id: 15,
    date: "Feb 17",
    time: "11:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Tanya Brown",
    clientInitials: "TB2",
    clientPhone: "(404) 555-0115",
    staff: "Jasmine",
    status: "no_show",
    durationMin: 75,
    price: 95,
  },
];

const STATUS_FILTERS = [
  "All",
  "Confirmed",
  "Completed",
  "Pending",
  "Cancelled",
  "No Show",
] as const;

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

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
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function BookingsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const filtered = MOCK_BOOKINGS.filter((b) => {
    const matchSearch =
      !search ||
      b.client.toLowerCase().includes(search.toLowerCase()) ||
      b.service.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || statusConfig(b.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  const todayCount = MOCK_BOOKINGS.filter((b) => b.date === "Today").length;
  const pendingCount = MOCK_BOOKINGS.filter(
    (b) => b.status === "pending" || b.status === "confirmed",
  ).length;
  const revenue = MOCK_BOOKINGS.filter((b) => b.status === "completed").reduce(
    (s, b) => s + b.price,
    0,
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Bookings</h1>
          <p className="text-sm text-muted mt-0.5">Manage appointments and scheduling</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0">
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Today</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{todayCount}</p>
            <p className="text-xs text-muted mt-0.5">appointments</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Upcoming</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{pendingCount}</p>
            <p className="text-xs text-muted mt-0.5">confirmed + pending</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Collected
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              ${revenue.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">completed this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search client or service…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
            {/* Status filter tabs */}
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    statusFilter === s
                      ? "bg-foreground text-background"
                      : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No bookings found.</p>
          ) : (
            <div className="space-y-0">
              {filtered.map((booking) => {
                const status = statusConfig(booking.status);
                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    {/* Dot + date/time */}
                    <div className="flex flex-col items-center gap-1 shrink-0 w-20">
                      <span
                        className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.category))}
                      />
                      <span className="text-[10px] text-muted font-medium">{booking.date}</span>
                      <span className="text-[10px] text-muted/70 tabular-nums">{booking.time}</span>
                    </div>

                    {/* Avatar */}
                    <Avatar size="sm">
                      <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                        {booking.clientInitials}
                      </AvatarFallback>
                    </Avatar>

                    {/* Service + client */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {booking.service}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {booking.client}
                        {booking.location && (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {booking.location}
                          </span>
                        )}
                      </p>
                      {booking.notes && (
                        <p className="text-[10px] text-muted/60 mt-0.5 truncate">{booking.notes}</p>
                      )}
                    </div>

                    {/* Staff + duration */}
                    <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted">{booking.staff}</span>
                      <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {booking.durationMin}m
                      </span>
                    </div>

                    {/* Price */}
                    <span className="text-sm font-medium text-foreground shrink-0 hidden sm:block">
                      ${booking.price}
                    </span>

                    {/* Status */}
                    <Badge
                      className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
