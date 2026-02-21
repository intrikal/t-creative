"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type BookingStatus = "completed" | "in_progress" | "confirmed" | "pending" | "cancelled";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface Appointment {
  id: number;
  date: string; // "2026-02-21"
  dayLabel: string; // "Sat, Feb 21"
  time: string;
  endTime: string;
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  location?: string;
  notes?: string;
}

const APPOINTMENTS: Appointment[] = [
  {
    id: 1,
    date: "2026-02-21",
    dayLabel: "Sat, Feb 21",
    time: "10:00 AM",
    endTime: "11:30 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Maya R.",
    clientInitials: "MR",
    status: "completed",
    durationMin: 90,
    price: 75,
  },
  {
    id: 2,
    date: "2026-02-21",
    dayLabel: "Sat, Feb 21",
    time: "12:00 PM",
    endTime: "2:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Priya K.",
    clientInitials: "PK",
    status: "in_progress",
    durationMin: 120,
    price: 140,
  },
  {
    id: 3,
    date: "2026-02-21",
    dayLabel: "Sat, Feb 21",
    time: "2:30 PM",
    endTime: "3:45 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Chloe T.",
    clientInitials: "CT",
    status: "confirmed",
    durationMin: 75,
    price: 75,
  },
  {
    id: 4,
    date: "2026-02-21",
    dayLabel: "Sat, Feb 21",
    time: "4:30 PM",
    endTime: "5:15 PM",
    service: "Lash Removal + Rebook",
    category: "lash",
    client: "Amy L.",
    clientInitials: "AL",
    status: "confirmed",
    durationMin: 45,
    price: 35,
  },
  {
    id: 5,
    date: "2026-02-22",
    dayLabel: "Sun, Feb 22",
    time: "11:00 AM",
    endTime: "12:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Dana W.",
    clientInitials: "DW",
    status: "confirmed",
    durationMin: 90,
    price: 75,
  },
  {
    id: 6,
    date: "2026-02-22",
    dayLabel: "Sun, Feb 22",
    time: "2:00 PM",
    endTime: "4:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Nia B.",
    clientInitials: "NB",
    status: "confirmed",
    durationMin: 120,
    price: 140,
  },
  {
    id: 7,
    date: "2026-02-24",
    dayLabel: "Tue, Feb 24",
    time: "10:30 AM",
    endTime: "12:00 PM",
    service: "Hybrid Lashes — Full Set",
    category: "lash",
    client: "Kira M.",
    clientInitials: "KM",
    status: "confirmed",
    durationMin: 90,
    price: 120,
  },
  {
    id: 8,
    date: "2026-02-24",
    dayLabel: "Tue, Feb 24",
    time: "1:00 PM",
    endTime: "2:15 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Toni S.",
    clientInitials: "TS",
    status: "confirmed",
    durationMin: 75,
    price: 75,
  },
  {
    id: 9,
    date: "2026-02-25",
    dayLabel: "Wed, Feb 25",
    time: "10:00 AM",
    endTime: "11:30 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Jordan L.",
    clientInitials: "JL",
    status: "confirmed",
    durationMin: 90,
    price: 75,
  },
  {
    id: 10,
    date: "2026-02-26",
    dayLabel: "Thu, Feb 26",
    time: "3:00 PM",
    endTime: "5:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Camille F.",
    clientInitials: "CF",
    status: "confirmed",
    durationMin: 120,
    price: 140,
  },
  {
    id: 11,
    date: "2026-02-26",
    dayLabel: "Thu, Feb 26",
    time: "5:30 PM",
    endTime: "6:15 PM",
    service: "Lash Tint + Lift",
    category: "lash",
    client: "Aisha R.",
    clientInitials: "AR",
    status: "confirmed",
    durationMin: 45,
    price: 65,
  },
  {
    id: 12,
    date: "2026-02-27",
    dayLabel: "Fri, Feb 27",
    time: "11:00 AM",
    endTime: "12:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Sade O.",
    clientInitials: "SO",
    status: "confirmed",
    durationMin: 90,
    price: 75,
  },
  {
    id: 13,
    date: "2026-02-28",
    dayLabel: "Sat, Feb 28",
    time: "10:00 AM",
    endTime: "11:30 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Mia T.",
    clientInitials: "MT",
    status: "pending",
    durationMin: 90,
    price: 75,
  },
  {
    id: 14,
    date: "2026-02-28",
    dayLabel: "Sat, Feb 28",
    time: "12:00 PM",
    endTime: "2:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Zara K.",
    clientInitials: "ZK",
    status: "pending",
    durationMin: 120,
    price: 140,
  },
];

const WEEK_DAYS = [
  "Sun, Feb 22",
  "Mon, Feb 23",
  "Tue, Feb 24",
  "Wed, Feb 25",
  "Thu, Feb 26",
  "Fri, Feb 27",
  "Sat, Feb 28",
];

function statusConfig(status: BookingStatus) {
  switch (status) {
    case "completed":
      return { label: "Done", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
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

function categoryDot(cat: ServiceCategory) {
  return {
    lash: "bg-[#c4907a]",
    jewelry: "bg-[#d4a574]",
    crochet: "bg-[#7ba3a3]",
    consulting: "bg-[#5b8a8a]",
  }[cat];
}

type View = "week" | "list";

export function AssistantSchedulePage() {
  const [view, setView] = useState<View>("list");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Group by day for list view
  const byDay = APPOINTMENTS.reduce<Record<string, Appointment[]>>((acc, a) => {
    (acc[a.dayLabel] ??= []).push(a);
    return acc;
  }, {});

  const todayAppts = APPOINTMENTS.filter((a) => a.dayLabel === "Sat, Feb 21");
  const todayRevenue = todayAppts.reduce((s, a) => s + a.price, 0);
  const weekRevenue = APPOINTMENTS.reduce((s, a) => s + a.price, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Schedule</h1>
          <p className="text-sm text-muted mt-0.5">Your upcoming appointments</p>
        </div>
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
          {(["list", "week"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                view === v
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Today", value: String(todayAppts.length), sub: "appointments" },
          { label: "Today's Revenue", value: `$${todayRevenue}`, sub: "projected" },
          { label: "This Week", value: String(APPOINTMENTS.length), sub: "total appointments" },
          { label: "Week Revenue", value: `$${weekRevenue}`, sub: "projected" },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
              <p className="text-[10px] text-muted/60">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Week nav (week view) */}
      {view === "week" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Week of Feb 22 – 28</CardTitle>
              <div className="flex items-center gap-1">
                <button className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-3">
            <div className="grid grid-cols-7 gap-2">
              {WEEK_DAYS.map((day) => {
                const appts = APPOINTMENTS.filter((a) => a.dayLabel === day);
                const short = day.split(",")[0];
                const num = day.split(" ").pop();
                return (
                  <div key={day} className="min-h-[120px]">
                    <div className="text-center mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {short}
                      </p>
                      <p className="text-sm font-semibold text-foreground">{num}</p>
                    </div>
                    <div className="space-y-1">
                      {appts.length === 0 ? (
                        <p className="text-[10px] text-muted/50 text-center">—</p>
                      ) : (
                        appts.map((a) => (
                          <div
                            key={a.id}
                            className={cn(
                              "rounded-md px-1.5 py-1 border text-[10px] leading-tight",
                              statusConfig(a.status).className,
                            )}
                          >
                            <p className="font-semibold truncate">{a.time}</p>
                            <p className="truncate opacity-80">{a.client}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-5">
          {Object.entries(byDay).map(([day, appts]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-2">
                <p className="text-xs font-semibold text-foreground">{day}</p>
                {day === today && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                    Today
                  </span>
                )}
                <span className="text-xs text-muted">
                  {appts.length} appointment{appts.length !== 1 ? "s" : ""} · $
                  {appts.reduce((s, a) => s + a.price, 0)}
                </span>
              </div>
              <Card className="gap-0">
                <CardContent className="px-0 py-0">
                  {appts.map((a) => {
                    const sts = statusConfig(a.status);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 px-5 py-3.5 border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1 shrink-0 w-16">
                          <span
                            className={cn("w-1.5 h-1.5 rounded-full", categoryDot(a.category))}
                          />
                          <span className="text-xs text-muted font-medium tabular-nums">
                            {a.time}
                          </span>
                        </div>
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                            {a.clientInitials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {a.service}
                          </p>
                          <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                            {a.client}
                            <span className="flex items-center gap-0.5 text-muted/60">
                              <Clock className="w-2.5 h-2.5" />
                              {a.durationMin}m
                            </span>
                            {a.location && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5" />
                                {a.location}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-foreground hidden sm:block">
                            ${a.price}
                          </span>
                          <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                            {sts.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
