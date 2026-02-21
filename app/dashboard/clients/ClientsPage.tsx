"use client";

/**
 * ClientsPage — Full client roster with search and filters.
 *
 * All data is hardcoded. Replace MOCK_CLIENTS with a server action / fetch
 * when the API is ready.
 */

import { useState } from "react";
import { Search, Star, Plus, Users, TrendingUp, Heart } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type ClientSource = "instagram" | "word_of_mouth" | "google_search" | "referral" | "website_direct";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting";

interface Client {
  id: number;
  name: string;
  initials: string;
  email: string;
  phone: string;
  source: ClientSource;
  joinedDate: string;
  vip: boolean;
  services: ServiceCategory[];
  totalBookings: number;
  totalSpent: number;
  lastVisit: string;
  notes?: string;
}

const MOCK_CLIENTS: Client[] = [
  {
    id: 1,
    name: "Amara Johnson",
    initials: "AJ",
    email: "amara@example.com",
    phone: "(404) 555-0201",
    source: "instagram",
    joinedDate: "Feb 18, 2025",
    vip: false,
    services: ["lash"],
    totalBookings: 4,
    totalSpent: 620,
    lastVisit: "Feb 18",
  },
  {
    id: 2,
    name: "Destiny Cruz",
    initials: "DC",
    email: "destiny@example.com",
    phone: "(404) 555-0202",
    source: "referral",
    joinedDate: "Jan 5, 2025",
    vip: true,
    services: ["lash", "jewelry"],
    totalBookings: 9,
    totalSpent: 1340,
    lastVisit: "Feb 15",
  },
  {
    id: 3,
    name: "Keisha Williams",
    initials: "KW",
    email: "keisha@example.com",
    phone: "(404) 555-0203",
    source: "word_of_mouth",
    joinedDate: "Jan 20, 2025",
    vip: false,
    services: ["crochet"],
    totalBookings: 3,
    totalSpent: 280,
    lastVisit: "Feb 10",
  },
  {
    id: 4,
    name: "Tanya Brown",
    initials: "TB",
    email: "tanya@example.com",
    phone: "(404) 555-0204",
    source: "google_search",
    joinedDate: "Dec 12, 2024",
    vip: false,
    services: ["consulting"],
    totalBookings: 2,
    totalSpent: 300,
    lastVisit: "Feb 5",
  },
  {
    id: 5,
    name: "Nina Patel",
    initials: "NP",
    email: "nina@example.com",
    phone: "(404) 555-0205",
    source: "instagram",
    joinedDate: "Nov 3, 2024",
    vip: true,
    services: ["jewelry"],
    totalBookings: 7,
    totalSpent: 890,
    lastVisit: "Feb 12",
    notes: "Prefers gold chains",
  },
  {
    id: 6,
    name: "Sarah Mitchell",
    initials: "SM",
    email: "sarah@example.com",
    phone: "(404) 555-0206",
    source: "referral",
    joinedDate: "Oct 18, 2024",
    vip: true,
    services: ["lash"],
    totalBookings: 12,
    totalSpent: 1980,
    lastVisit: "Today",
  },
  {
    id: 7,
    name: "Maya Robinson",
    initials: "MR",
    email: "maya@example.com",
    phone: "(404) 555-0207",
    source: "instagram",
    joinedDate: "Sep 22, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 8,
    totalSpent: 760,
    lastVisit: "Today",
  },
  {
    id: 8,
    name: "Priya Kumar",
    initials: "PK",
    email: "priya@example.com",
    phone: "(404) 555-0208",
    source: "google_search",
    joinedDate: "Aug 14, 2024",
    vip: false,
    services: ["jewelry"],
    totalBookings: 5,
    totalSpent: 445,
    lastVisit: "Today",
  },
  {
    id: 9,
    name: "Chloe Thompson",
    initials: "CT",
    email: "chloe@example.com",
    phone: "(404) 555-0209",
    source: "word_of_mouth",
    joinedDate: "Jul 30, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 10,
    totalSpent: 1150,
    lastVisit: "Today",
  },
  {
    id: 10,
    name: "Marcus Banks",
    initials: "MB",
    email: "marcus@example.com",
    phone: "(404) 555-0210",
    source: "instagram",
    joinedDate: "Jun 8, 2024",
    vip: false,
    services: ["consulting"],
    totalBookings: 4,
    totalSpent: 600,
    lastVisit: "Today",
  },
  {
    id: 11,
    name: "Amy Lin",
    initials: "AL",
    email: "amy@example.com",
    phone: "(404) 555-0211",
    source: "website_direct",
    joinedDate: "May 20, 2024",
    vip: false,
    services: ["crochet"],
    totalBookings: 6,
    totalSpent: 480,
    lastVisit: "Today",
  },
  {
    id: 12,
    name: "Jordan Lee",
    initials: "JL",
    email: "jordan@example.com",
    phone: "(404) 555-0212",
    source: "instagram",
    joinedDate: "Apr 11, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 3,
    totalSpent: 285,
    lastVisit: "Feb 22",
  },
  {
    id: 13,
    name: "Aaliyah Washington",
    initials: "AW",
    email: "aaliyah@example.com",
    phone: "(404) 555-0213",
    source: "referral",
    joinedDate: "Mar 5, 2024",
    vip: true,
    services: ["consulting", "lash"],
    totalBookings: 11,
    totalSpent: 2100,
    lastVisit: "Feb 22",
  },
  {
    id: 14,
    name: "Camille Foster",
    initials: "CF",
    email: "camille@example.com",
    phone: "(404) 555-0214",
    source: "instagram",
    joinedDate: "Feb 14, 2024",
    vip: false,
    services: ["jewelry"],
    totalBookings: 4,
    totalSpent: 310,
    lastVisit: "Feb 18",
  },
  {
    id: 15,
    name: "Tiffany Brown",
    initials: "TB2",
    email: "tiffany@example.com",
    phone: "(404) 555-0215",
    source: "google_search",
    joinedDate: "Jan 28, 2024",
    vip: false,
    services: ["lash"],
    totalBookings: 7,
    totalSpent: 1050,
    lastVisit: "Tomorrow",
  },
];

const SOURCE_FILTERS = [
  "All",
  "Instagram",
  "Referral",
  "Word of Mouth",
  "Google",
  "Website",
] as const;

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

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

function categoryLabel(category: ServiceCategory) {
  return { lash: "Lash", jewelry: "Jewelry", crochet: "Crochet", consulting: "Consulting" }[
    category
  ];
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function ClientsPage() {
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [vipOnly, setVipOnly] = useState(false);

  const filtered = MOCK_CLIENTS.filter((c) => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === "All" || sourceBadge(c.source).label === sourceFilter;
    const matchVip = !vipOnly || c.vip;
    return matchSearch && matchSource && matchVip;
  });

  const vipCount = MOCK_CLIENTS.filter((c) => c.vip).length;
  const avgSpend = Math.round(
    MOCK_CLIENTS.reduce((s, c) => s + c.totalSpent, 0) / MOCK_CLIENTS.length,
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Clients</h1>
          <p className="text-sm text-muted mt-0.5">{MOCK_CLIENTS.length} total clients</p>
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors shrink-0">
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">{MOCK_CLIENTS.length}</p>
            <p className="text-xs text-muted mt-0.5">+3 this week</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-3.5 h-3.5 text-[#d4a574]" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">VIP</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">{vipCount}</p>
            <p className="text-xs text-muted mt-0.5">top clients</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg Spend
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${avgSpend}</p>
            <p className="text-xs text-muted mt-0.5">per client</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {SOURCE_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSourceFilter(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    sourceFilter === s
                      ? "bg-foreground text-background"
                      : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                onClick={() => setVipOnly(!vipOnly)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
                  vipOnly
                    ? "bg-[#d4a574]/20 text-[#7a5c10] border border-[#d4a574]/30"
                    : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                )}
              >
                <Star className="w-3 h-3" />
                VIP
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 pt-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">No clients found.</p>
          ) : (
            <div>
              {filtered.map((client) => {
                const src = sourceBadge(client.source);
                return (
                  <div
                    key={client.id}
                    className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
                  >
                    <Avatar>
                      <AvatarFallback className="bg-surface text-muted text-xs font-semibold">
                        {client.initials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-foreground">{client.name}</span>
                        {client.vip && (
                          <Star
                            className="w-3 h-3 text-[#d4a574] fill-[#d4a574] shrink-0"
                            aria-label="VIP"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted">{client.email}</span>
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
                      {client.notes && (
                        <p className="text-[10px] text-muted/60 mt-0.5">{client.notes}</p>
                      )}
                    </div>

                    <div className="hidden lg:flex flex-col items-end gap-1 shrink-0 text-right">
                      <span className="text-xs text-foreground font-medium">
                        ${client.totalSpent.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted">{client.totalBookings} visits</span>
                    </div>

                    <div className="hidden md:flex flex-col items-end gap-1 shrink-0 text-right">
                      <span className="text-[10px] text-muted">Last visit</span>
                      <span className="text-xs text-foreground">{client.lastVisit}</span>
                    </div>
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
