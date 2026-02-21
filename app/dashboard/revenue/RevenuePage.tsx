"use client";

/**
 * RevenuePage — Revenue analytics and payment transaction history.
 *
 * Backed by `payments` table (Square-synced). All data is hardcoded for now.
 * Replace MOCK_* with server actions / fetch when API is ready.
 */

import { useState } from "react";
import { TrendingUp, DollarSign, CreditCard, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "product" | "training";
type PaymentStatus = "completed" | "pending" | "refunded" | "failed";
type PaymentMethod = "card" | "cash" | "square" | "afterpay";

interface Payment {
  id: number;
  date: string;
  client: string;
  service: string;
  category: ServiceCategory;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  tip?: number;
}

const MOCK_PAYMENTS: Payment[] = [
  {
    id: 1,
    date: "Today, 10:00 AM",
    client: "Sarah Mitchell",
    service: "Volume Lashes — Full Set",
    category: "lash",
    amount: 180,
    tip: 20,
    method: "card",
    status: "completed",
  },
  {
    id: 2,
    date: "Today, 12:00 PM",
    client: "Maya Robinson",
    service: "Classic Lash Fill",
    category: "lash",
    amount: 95,
    tip: 10,
    method: "square",
    status: "pending",
  },
  {
    id: 3,
    date: "Today, 1:00 PM",
    client: "Priya Kumar",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    amount: 65,
    method: "card",
    status: "completed",
  },
  {
    id: 4,
    date: "Feb 19, 11:00 AM",
    client: "Destiny Cruz",
    service: "Mega Volume Lashes",
    category: "lash",
    amount: 220,
    tip: 30,
    method: "card",
    status: "completed",
  },
  {
    id: 5,
    date: "Feb 19, 2:00 PM",
    client: "Nina Patel",
    service: "Permanent Jewelry Chain",
    category: "jewelry",
    amount: 85,
    method: "square",
    status: "completed",
  },
  {
    id: 6,
    date: "Feb 18, 10:00 AM",
    client: "Amara Johnson",
    service: "Volume Lashes — Full Set",
    category: "lash",
    amount: 180,
    tip: 25,
    method: "card",
    status: "completed",
  },
  {
    id: 7,
    date: "Feb 18, 12:30 PM",
    client: "Camille Foster",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    amount: 65,
    method: "cash",
    status: "completed",
  },
  {
    id: 8,
    date: "Feb 18, 3:00 PM",
    client: "Marcus Banks",
    service: "Business Consulting",
    category: "consulting",
    amount: 150,
    method: "square",
    status: "completed",
  },
  {
    id: 9,
    date: "Feb 17, 10:00 AM",
    client: "Jordan Lee",
    service: "Classic Lash Fill",
    category: "lash",
    amount: 95,
    tip: 15,
    method: "afterpay",
    status: "completed",
  },
  {
    id: 10,
    date: "Feb 17, 1:30 PM",
    client: "Keisha Williams",
    service: "Crochet Braid Install",
    category: "crochet",
    amount: 120,
    method: "cash",
    status: "completed",
  },
  {
    id: 11,
    date: "Feb 16, 11:00 AM",
    client: "Aaliyah Washington",
    service: "HR Consulting — 90 min",
    category: "consulting",
    amount: 200,
    method: "square",
    status: "completed",
  },
  {
    id: 12,
    date: "Feb 16, 3:00 PM",
    client: "Tiffany Brown",
    service: "Volume Lashes — Full Set",
    category: "lash",
    amount: 180,
    tip: 20,
    method: "card",
    status: "completed",
  },
  {
    id: 13,
    date: "Feb 15, 10:00 AM",
    client: "Amy Lin",
    service: "Custom Crochet Set",
    category: "crochet",
    amount: 95,
    method: "card",
    status: "completed",
  },
  {
    id: 14,
    date: "Feb 15, 2:00 PM",
    client: "Tamara Price",
    service: "Lash Aftercare Kit x10",
    category: "product",
    amount: 180,
    method: "square",
    status: "completed",
  },
  {
    id: 15,
    date: "Feb 14, 9:00 AM",
    client: "Nina Patel",
    service: "Classic Lash Fill",
    category: "lash",
    amount: 95,
    tip: 10,
    method: "card",
    status: "refunded",
  },
  {
    id: 16,
    date: "Feb 14, 1:00 PM",
    client: "Renee Jackson",
    service: "Permanent Jewelry Gift Box",
    category: "jewelry",
    amount: 180,
    method: "card",
    status: "completed",
  },
  {
    id: 17,
    date: "Feb 13, 11:00 AM",
    client: "Aisha Thomas",
    service: "Lash Extension Masterclass — Deposit",
    category: "training",
    amount: 250,
    method: "square",
    status: "completed",
  },
];

const CATEGORY_BREAKDOWN = [
  { category: "Lash Services", amount: 4890, pct: 54, color: "bg-[#c4907a]" },
  { category: "Jewelry", amount: 1840, pct: 20, color: "bg-[#d4a574]" },
  { category: "Consulting", amount: 1350, pct: 15, color: "bg-[#5b8a8a]" },
  { category: "Crochet", amount: 620, pct: 7, color: "bg-[#7ba3a3]" },
  { category: "Products", amount: 240, pct: 3, color: "bg-[#8fa89c]" },
  { category: "Training", amount: 90, pct: 1, color: "bg-[#b4ccc6]" },
];

const WEEKLY_BARS = [
  { day: "Mon", amount: 890 },
  { day: "Tue", amount: 1240 },
  { day: "Wed", amount: 680 },
  { day: "Thu", amount: 1560 },
  { day: "Fri", amount: 2100 },
  { day: "Sat", amount: 1980 },
  { day: "Sun", amount: 580 },
];

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

function paymentStatusConfig(status: PaymentStatus) {
  switch (status) {
    case "completed":
      return { label: "Paid", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "refunded":
      return { label: "Refunded", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "failed":
      return {
        label: "Failed",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

function methodLabel(method: PaymentMethod) {
  return { card: "Card", cash: "Cash", square: "Square", afterpay: "Afterpay" }[method];
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function RevenuePage() {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("7d");

  const maxBar = Math.max(...WEEKLY_BARS.map((b) => b.amount));
  const totalWeek = WEEKLY_BARS.reduce((s, b) => s + b.amount, 0);
  const totalTips = MOCK_PAYMENTS.filter((p) => p.status === "completed").reduce(
    (s, p) => s + (p.tip ?? 0),
    0,
  );
  const totalRevenue = MOCK_PAYMENTS.filter((p) => p.status === "completed").reduce(
    (s, p) => s + p.amount,
    0,
  );

  const filtered = MOCK_PAYMENTS.filter(
    (p) =>
      !search ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.service.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Revenue</h1>
          <p className="text-sm text-muted mt-0.5">Payments and earnings overview</p>
        </div>
        <div className="flex gap-1">
          {["7d", "30d", "90d"].map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                range === r
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Total</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-[#4e6b51] mt-0.5">↑ 8% vs prior period</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                This Week
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${totalWeek.toLocaleString()}</p>
            <p className="text-xs text-muted mt-0.5">7 days</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Tips
            </p>
            <p className="text-2xl font-semibold text-foreground">${totalTips}</p>
            <p className="text-xs text-muted mt-0.5">gratuity collected</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg Ticket
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              $
              {Math.round(
                totalRevenue / MOCK_PAYMENTS.filter((p) => p.status === "completed").length,
              )}
            </p>
            <p className="text-xs text-muted mt-0.5">per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bar chart */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Daily Revenue — This Week</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            <div className="flex items-end gap-2 h-36">
              {WEEKLY_BARS.map((bar, i) => (
                <div key={bar.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted font-medium tabular-nums">
                    ${(bar.amount / 1000).toFixed(1)}k
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t-sm transition-all",
                      i === 4 ? "bg-[#c4907a]" : "bg-[#e8c4b8]",
                    )}
                    style={{ height: `${(bar.amount / maxBar) * 100}%` }}
                  />
                  <span className="text-[10px] text-muted">{bar.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">By Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-3">
            {CATEGORY_BREAKDOWN.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">{cat.category}</span>
                  <span className="text-xs font-medium text-foreground">
                    ${cat.amount.toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", cat.color)}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card className="gap-0">
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold">Transactions</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-3">
          {filtered.map((payment) => {
            const status = paymentStatusConfig(payment.status);
            return (
              <div
                key={payment.id}
                className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{payment.client}</p>
                  <p className="text-xs text-muted mt-0.5">{payment.service}</p>
                  <p className="text-[10px] text-muted/60 mt-0.5">
                    {payment.date} · {methodLabel(payment.method)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-foreground">${payment.amount}</p>
                  {payment.tip && <p className="text-[10px] text-muted">+${payment.tip} tip</p>}
                </div>

                <Badge
                  className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
                >
                  {status.label}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
