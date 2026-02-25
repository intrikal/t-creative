"use client";

import { useState } from "react";
import { Search, Star, CalendarDays, Clock } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ServiceCategory = "lash" | "jewelry" | "crochet";

interface Client {
  id: number;
  name: string;
  initials: string;
  phone: string;
  email: string;
  lastService: string;
  lastServiceDate: string;
  services: ServiceCategory[];
  totalVisits: number;
  totalSpent: number;
  vip: boolean;
  notes?: string;
  nextAppointment?: string;
}

const CLIENTS: Client[] = [
  {
    id: 1,
    name: "Maya R.",
    initials: "MR",
    phone: "(404) 555-0192",
    email: "maya.r@email.com",
    lastService: "Classic Lash Fill",
    lastServiceDate: "Today",
    services: ["lash"],
    totalVisits: 12,
    totalSpent: 890,
    vip: true,
    nextAppointment: "Today 10:00 AM",
    notes: "Prefers natural look. No drama curl. Sensitive eyes — use sensitive glue.",
  },
  {
    id: 2,
    name: "Priya K.",
    initials: "PK",
    phone: "(404) 555-0148",
    email: "priya.k@email.com",
    lastService: "Volume Lashes Full Set",
    lastServiceDate: "Today",
    services: ["lash"],
    totalVisits: 3,
    totalSpent: 420,
    vip: false,
    nextAppointment: "Today 12:00 PM",
  },
  {
    id: 3,
    name: "Chloe T.",
    initials: "CT",
    phone: "(404) 555-0173",
    email: "chloe.t@email.com",
    lastService: "Classic Lash Fill",
    lastServiceDate: "Feb 8",
    services: ["lash"],
    totalVisits: 8,
    totalSpent: 600,
    vip: false,
    nextAppointment: "Today 2:30 PM",
  },
  {
    id: 4,
    name: "Amy L.",
    initials: "AL",
    phone: "(404) 555-0109",
    email: "amy.l@email.com",
    lastService: "Volume Lashes Full Set",
    lastServiceDate: "Jan 24",
    services: ["lash"],
    totalVisits: 6,
    totalSpent: 840,
    vip: true,
    nextAppointment: "Today 4:30 PM",
    notes: "Always books volume. Prefers D curl. Wants lashes to look dramatic.",
  },
  {
    id: 5,
    name: "Dana W.",
    initials: "DW",
    phone: "(404) 555-0161",
    email: "dana.w@email.com",
    lastService: "Classic Lash Fill",
    lastServiceDate: "Feb 1",
    services: ["lash"],
    totalVisits: 4,
    totalSpent: 300,
    vip: false,
    nextAppointment: "Feb 22",
  },
  {
    id: 6,
    name: "Nia B.",
    initials: "NB",
    phone: "(404) 555-0135",
    email: "nia.b@email.com",
    lastService: "Volume Lashes Full Set",
    lastServiceDate: "Jan 28",
    services: ["lash"],
    totalVisits: 5,
    totalSpent: 700,
    vip: false,
    nextAppointment: "Feb 22",
  },
  {
    id: 7,
    name: "Kira M.",
    initials: "KM",
    phone: "(404) 555-0187",
    email: "kira.m@email.com",
    lastService: "Hybrid Lashes Full Set",
    lastServiceDate: "Feb 3",
    services: ["lash"],
    totalVisits: 7,
    totalSpent: 840,
    vip: true,
    nextAppointment: "Feb 24",
  },
  {
    id: 8,
    name: "Lena P.",
    initials: "LP",
    phone: "(404) 555-0122",
    email: "lena.p@email.com",
    lastService: "Volume Lashes Full Set",
    lastServiceDate: "Feb 15",
    services: ["lash"],
    totalVisits: 9,
    totalSpent: 1260,
    vip: true,
    notes: "Loves extra fluffy. Book her for fill in 3 weeks.",
  },
  {
    id: 9,
    name: "Aisha R.",
    initials: "AR",
    phone: "(404) 555-0133",
    email: "aisha.r@email.com",
    lastService: "Lash Tint + Lift",
    lastServiceDate: "Feb 5",
    services: ["lash"],
    totalVisits: 5,
    totalSpent: 325,
    vip: false,
  },
  {
    id: 10,
    name: "Jordan L.",
    initials: "JL",
    phone: "(404) 555-0119",
    email: "jordan.l@email.com",
    lastService: "Classic Lash Fill",
    lastServiceDate: "Jan 30",
    services: ["lash"],
    totalVisits: 6,
    totalSpent: 450,
    vip: false,
    nextAppointment: "Feb 25",
  },
  {
    id: 11,
    name: "Camille F.",
    initials: "CF",
    phone: "(404) 555-0145",
    email: "camille.f@email.com",
    lastService: "Volume Lashes Full Set",
    lastServiceDate: "Jan 27",
    services: ["lash"],
    totalVisits: 4,
    totalSpent: 560,
    vip: false,
    nextAppointment: "Feb 26",
  },
  {
    id: 12,
    name: "Tasha N.",
    initials: "TN",
    phone: "(404) 555-0144",
    email: "tasha.n@email.com",
    lastService: "Classic Lash Fill",
    lastServiceDate: "Feb 14",
    services: ["lash"],
    totalVisits: 3,
    totalSpent: 225,
    vip: false,
  },
];

export function AssistantClientsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "vip" | "upcoming">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = CLIENTS.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" ? true : filter === "vip" ? c.vip : !!c.nextAppointment;
    return matchSearch && matchFilter;
  });

  function categoryDot(cat: ServiceCategory) {
    return { lash: "bg-[#c4907a]", jewelry: "bg-[#d4a574]", crochet: "bg-[#7ba3a3]" }[cat];
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Clients</h1>
        <p className="text-sm text-muted mt-0.5">
          {CLIENTS.length} clients you&apos;ve worked with
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Clients", value: CLIENTS.length },
          { label: "VIP Clients", value: CLIENTS.filter((c) => c.vip).length },
          {
            label: "Total Revenue",
            value: `$${CLIENTS.reduce((s, c) => s + c.totalSpent, 0).toLocaleString()}`,
          },
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
            placeholder="Search clients…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40 transition"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "vip", "upcoming"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize",
                filter === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      <Card className="gap-0">
        <CardContent className="px-0 py-0">
          {filtered.map((c) => {
            const isExpanded = expandedId === c.id;
            return (
              <div key={c.id} className="border-b border-border/40 last:border-0">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface/60 transition-colors text-left"
                >
                  <Avatar>
                    <AvatarFallback className="bg-surface text-muted text-xs font-semibold">
                      {c.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      {c.vip && <Star className="w-3 h-3 text-[#d4a574] fill-[#d4a574]" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted flex items-center gap-0.5">
                        <CalendarDays className="w-2.5 h-2.5" /> {c.lastServiceDate}
                      </span>
                      <span className="text-xs text-muted">{c.lastService}</span>
                      {c.services.map((s) => (
                        <span
                          key={s}
                          className={cn("w-1.5 h-1.5 rounded-full shrink-0", categoryDot(s))}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-xs font-semibold text-foreground">${c.totalSpent}</span>
                    <span className="text-[10px] text-muted">{c.totalVisits} visits</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4 bg-surface/30 border-t border-border/30 space-y-2 pt-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted">Phone</p>
                        <p className="text-foreground font-medium mt-0.5">{c.phone}</p>
                      </div>
                      <div>
                        <p className="text-muted">Email</p>
                        <p className="text-foreground font-medium mt-0.5 truncate">{c.email}</p>
                      </div>
                    </div>
                    {c.nextAppointment && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock className="w-3 h-3 text-accent" />
                        <span className="text-accent font-medium">Next: {c.nextAppointment}</span>
                      </div>
                    )}
                    {c.notes && (
                      <p className="text-xs text-muted bg-background rounded-lg px-3 py-2 border border-border/50 italic">
                        &ldquo;{c.notes}&rdquo;
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
