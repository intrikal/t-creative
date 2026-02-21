"use client";

/**
 * RevenuePage — Revenue analytics and payment transaction history.
 *
 * Backed by `payments` table (Square-synced). All data is hardcoded for now.
 * Replace MOCK_* with server actions / fetch when API is ready.
 */

import { useState } from "react";
import {
  TrendingUp,
  DollarSign,
  CreditCard,
  Search,
  TrendingDown,
  FileText,
  Receipt,
  Gift,
  Tag,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "product" | "training";
type PaymentStatus = "completed" | "pending" | "refunded" | "failed";
type PaymentMethod = "card" | "cash" | "square" | "afterpay";
type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
type GiftCardStatus = "active" | "redeemed" | "expired";

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

interface Invoice {
  id: number;
  number: string;
  client: string;
  services: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
}

interface Expense {
  id: number;
  date: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
  receipt: boolean;
}

interface GiftCard {
  id: number;
  code: string;
  purchasedBy: string;
  recipient: string;
  originalAmount: number;
  balance: number;
  purchasedDate: string;
  expiryDate: string;
  status: GiftCardStatus;
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

const MOCK_INVOICES: Invoice[] = [
  {
    id: 1,
    number: "INV-006",
    client: "Amara Johnson",
    services: "Volume Lashes — Full Set",
    issueDate: "Feb 20",
    dueDate: "Feb 27",
    amount: 180,
    status: "paid",
  },
  {
    id: 2,
    number: "INV-005",
    client: "Marcus Banks",
    services: "Business Consulting",
    issueDate: "Feb 18",
    dueDate: "Feb 25",
    amount: 150,
    status: "sent",
  },
  {
    id: 3,
    number: "INV-004",
    client: "Keisha Williams",
    services: "Permanent Jewelry Party",
    issueDate: "Feb 14",
    dueDate: "Feb 21",
    amount: 200,
    status: "overdue",
  },
  {
    id: 4,
    number: "INV-003",
    client: "Aaliyah Washington",
    services: "HR Consulting — 90 min",
    issueDate: "Feb 16",
    dueDate: "Feb 23",
    amount: 200,
    status: "paid",
  },
  {
    id: 5,
    number: "INV-002",
    client: "Jordan Lee",
    services: "Classic Lash Fill",
    issueDate: "Feb 17",
    dueDate: "Feb 24",
    amount: 95,
    status: "paid",
  },
  {
    id: 6,
    number: "INV-001",
    client: "Destiny Cruz",
    services: "Mega Volume Lashes",
    issueDate: "Feb 25",
    dueDate: "Mar 4",
    amount: 220,
    status: "draft",
  },
];

const MOCK_EXPENSES: Expense[] = [
  {
    id: 1,
    date: "Feb 15",
    category: "Supplies",
    description: "Lash adhesive, trays, micropore tape — monthly stock",
    vendor: "Beauty Supply Co",
    amount: 287,
    receipt: true,
  },
  {
    id: 2,
    date: "Feb 1",
    category: "Rent",
    description: "Monthly studio rental",
    vendor: "Atlanta Studios LLC",
    amount: 1200,
    receipt: true,
  },
  {
    id: 3,
    date: "Feb 10",
    category: "Marketing",
    description: "Instagram ads — February campaign",
    vendor: "Meta",
    amount: 85,
    receipt: true,
  },
  {
    id: 4,
    date: "Feb 8",
    category: "Equipment",
    description: "Ring light — LED lash lamp",
    vendor: "Amazon",
    amount: 124,
    receipt: true,
  },
  {
    id: 5,
    date: "Feb 1",
    category: "Software",
    description: "Booking & scheduling software",
    vendor: "Square",
    amount: 49,
    receipt: false,
  },
  {
    id: 6,
    date: "Feb 12",
    category: "Travel",
    description: "Client consultation — travel reimbursement",
    vendor: "Personal",
    amount: 32,
    receipt: false,
  },
];

const MOCK_GIFT_CARDS: GiftCard[] = [
  {
    id: 1,
    code: "TC-GC-001",
    purchasedBy: "Tanya Brown",
    recipient: "Mia Lee",
    originalAmount: 100,
    balance: 100,
    purchasedDate: "Jan 15",
    expiryDate: "Jul 15, 2026",
    status: "active",
  },
  {
    id: 2,
    code: "TC-GC-002",
    purchasedBy: "Jordan Lee",
    recipient: "Jordan Lee",
    originalAmount: 50,
    balance: 25,
    purchasedDate: "Feb 1",
    expiryDate: "Aug 1, 2026",
    status: "active",
  },
  {
    id: 3,
    code: "TC-GC-003",
    purchasedBy: "Marcus Banks",
    recipient: "Camille Banks",
    originalAmount: 150,
    balance: 0,
    purchasedDate: "Jan 20",
    expiryDate: "Jul 20, 2026",
    status: "redeemed",
  },
  {
    id: 4,
    code: "TC-GC-004",
    purchasedBy: "Amy Lin",
    recipient: "Diana Chen",
    originalAmount: 75,
    balance: 75,
    purchasedDate: "Dec 15, 2024",
    expiryDate: "Jun 15, 2026",
    status: "active",
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

const CATEGORY_FILTERS = [
  "All",
  "Lash",
  "Jewelry",
  "Consulting",
  "Crochet",
  "Products",
  "Training",
];

const FINANCIAL_TABS = [
  "Transactions",
  "Invoices",
  "Expenses",
  "Gift Cards",
  "Promotions",
] as const;
type FinancialTab = (typeof FINANCIAL_TABS)[number];

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

function invoiceStatusConfig(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return { label: "Paid", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "sent":
      return { label: "Sent", className: "bg-foreground/8 text-foreground border-foreground/15" };
    case "draft":
      return { label: "Draft", className: "bg-foreground/5 text-muted border-foreground/10" };
    case "overdue":
      return {
        label: "Overdue",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

function giftCardStatusConfig(status: GiftCardStatus) {
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "redeemed":
      return { label: "Redeemed", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "expired":
      return {
        label: "Expired",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

function methodLabel(method: PaymentMethod) {
  return { card: "Card", cash: "Cash", square: "Square", afterpay: "Afterpay" }[method];
}

function categoryMatchesFilter(category: ServiceCategory, filter: string) {
  if (filter === "All") return true;
  const map: Record<ServiceCategory, string> = {
    lash: "Lash",
    jewelry: "Jewelry",
    consulting: "Consulting",
    crochet: "Crochet",
    product: "Products",
    training: "Training",
  };
  return map[category] === filter;
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function FinancialPage() {
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("7d");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tab, setTab] = useState<FinancialTab>("Transactions");
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [modal, setModal] = useState<"invoice" | "expense" | "giftcard" | "promo" | null>(null);
  const closeModal = () => setModal(null);

  const maxBar = Math.max(...WEEKLY_BARS.map((b) => b.amount));
  const gridLines = [2000, 1500, 1000, 500];
  const totalWeek = WEEKLY_BARS.reduce((s, b) => s + b.amount, 0);
  const totalTips = MOCK_PAYMENTS.filter((p) => p.status === "completed").reduce(
    (s, p) => s + (p.tip ?? 0),
    0,
  );
  const completedPayments = MOCK_PAYMENTS.filter((p) => p.status === "completed");
  const totalRevenue = completedPayments.reduce((s, p) => s + p.amount, 0);

  const filtered = MOCK_PAYMENTS.filter((p) => {
    const matchSearch =
      !search ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.service.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryMatchesFilter(p.category, categoryFilter);
    return matchSearch && matchCategory;
  });

  const totalExpenses = MOCK_EXPENSES.reduce((s, e) => s + e.amount, 0);
  const totalGiftCardValue = MOCK_GIFT_CARDS.reduce((s, g) => s + g.originalAmount, 0);
  const activeGiftCards = MOCK_GIFT_CARDS.filter((g) => g.status === "active").length;
  const outstandingInvoices = MOCK_INVOICES.filter(
    (i) => i.status === "sent" || i.status === "overdue",
  ).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Financial</h1>
          <p className="text-sm text-muted mt-0.5">Payments, transactions, and earnings</p>
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
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Total Revenue
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${totalRevenue.toLocaleString()}
            </p>
            <p className="text-xs text-[#4e6b51] mt-1 flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" /> 8% vs prior period
            </p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                This Week
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${totalWeek.toLocaleString()}</p>
            <p className="text-xs text-muted mt-1">7-day rolling</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tips</p>
            </div>
            <p className="text-2xl font-semibold text-foreground">${totalTips}</p>
            <p className="text-xs text-muted mt-1">gratuity collected</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-3.5 h-3.5 text-muted" />
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                Avg Ticket
              </p>
            </div>
            <p className="text-2xl font-semibold text-foreground">
              ${Math.round(totalRevenue / completedPayments.length)}
            </p>
            <p className="text-xs text-muted mt-1">per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Bar chart */}
        <Card className="xl:col-span-3 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Daily Revenue — This Week</CardTitle>
              <span className="text-xs text-muted">${totalWeek.toLocaleString()} total</span>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-4">
            {/* Bar + gridline area — labels sit outside so % heights work */}
            <div className="relative h-44">
              {gridLines.map((line) => (
                <div
                  key={line}
                  className="absolute left-0 right-0 flex items-center gap-2"
                  style={{ bottom: `${(line / maxBar) * 100}%` }}
                >
                  <span className="text-[9px] text-muted/50 tabular-nums w-10 text-right shrink-0">
                    ${(line / 1000).toFixed(1)}k
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/40" />
                </div>
              ))}
              <div className="absolute inset-0 pl-12 flex items-end gap-2">
                {WEEKLY_BARS.map((bar, i) => (
                  <div
                    key={bar.day}
                    className="relative flex-1 flex flex-col items-center justify-end h-full"
                    onMouseEnter={() => setHoveredBar(i)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {hoveredBar === i && (
                      <div className="absolute bottom-full mb-1.5 z-10 pointer-events-none">
                        <div className="bg-foreground text-background text-[10px] font-semibold rounded-md px-2 py-1 whitespace-nowrap shadow-sm">
                          ${bar.amount.toLocaleString()}
                        </div>
                        <div className="w-1.5 h-1.5 bg-foreground rotate-45 mx-auto -mt-1" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "w-full rounded-t transition-all cursor-default",
                        i === 4 ? "bg-[#c4907a]" : "bg-[#e8c4b8]",
                        hoveredBar === i && "brightness-90",
                      )}
                      style={{ height: `${(bar.amount / maxBar) * 100}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Day labels row */}
            <div className="flex gap-2 pl-12 mt-1.5">
              {WEEKLY_BARS.map((bar) => (
                <div key={bar.day} className="flex-1 text-center">
                  <span className="text-[10px] text-muted">{bar.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Category breakdown */}
        <Card className="xl:col-span-2 gap-0">
          <CardHeader className="pb-0 pt-5 px-5">
            <CardTitle className="text-sm font-semibold">Revenue by Category</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-3 space-y-3.5">
            {CATEGORY_BREAKDOWN.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground">{cat.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted">{cat.pct}%</span>
                    <span className="text-xs font-medium text-foreground tabular-nums">
                      ${cat.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", cat.color)}
                    style={{ width: `${cat.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {FINANCIAL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Transactions ── */}
      {tab === "Transactions" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <CardTitle className="text-sm font-semibold shrink-0">Transactions</CardTitle>
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:ml-auto w-full sm:w-auto">
                <div className="flex gap-1 flex-wrap">
                  {CATEGORY_FILTERS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setCategoryFilter(f)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                        categoryFilter === f
                          ? "bg-foreground text-background"
                          : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="relative shrink-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                  <input
                    type="text"
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted w-full sm:w-40"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted text-center py-10">No transactions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5 whitespace-nowrap">
                        Date
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                        Client
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                        Service
                      </th>
                      <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                        Method
                      </th>
                      <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 whitespace-nowrap">
                        Amount
                      </th>
                      <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payment) => {
                      const status = paymentStatusConfig(payment.status);
                      return (
                        <tr
                          key={payment.id}
                          className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                        >
                          <td className="px-4 md:px-5 py-3 text-xs text-muted whitespace-nowrap align-middle">
                            {payment.date}
                          </td>
                          <td className="px-3 py-3 align-middle">
                            <span className="text-sm font-medium text-foreground">
                              {payment.client}
                            </span>
                          </td>
                          <td className="px-3 py-3 hidden md:table-cell align-middle">
                            <span className="text-xs text-muted">{payment.service}</span>
                          </td>
                          <td className="px-3 py-3 hidden lg:table-cell align-middle">
                            <span className="text-xs text-muted">
                              {methodLabel(payment.method)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right align-middle">
                            <p className="text-sm font-semibold text-foreground tabular-nums">
                              ${payment.amount}
                            </p>
                            {payment.tip && (
                              <p className="text-[10px] text-muted tabular-nums">
                                +${payment.tip} tip
                              </p>
                            )}
                          </td>
                          <td className="px-4 md:px-5 py-3 text-center align-middle">
                            <Badge
                              className={cn("border text-[10px] px-1.5 py-0.5", status.className)}
                            >
                              {status.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Invoices ── */}
      {tab === "Invoices" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted" /> Invoices
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  ${outstandingInvoices.toLocaleString()} outstanding
                </span>
                <button
                  onClick={() => setModal("invoice")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                >
                  + New Invoice
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      #
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Client
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                      Services
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Issued
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Due
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Amount
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_INVOICES.map((inv) => {
                    const status = invoiceStatusConfig(inv.status);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-4 md:px-5 py-3 text-xs text-muted font-mono align-middle">
                          {inv.number}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="text-sm font-medium text-foreground">{inv.client}</span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell align-middle">
                          <span className="text-xs text-muted">{inv.services}</span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell align-middle">
                          <span className="text-xs text-muted">{inv.issueDate}</span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span
                            className={cn(
                              "text-xs",
                              inv.status === "overdue"
                                ? "text-destructive font-medium"
                                : "text-muted",
                            )}
                          >
                            {inv.dueDate}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            ${inv.amount}
                          </span>
                        </td>
                        <td className="px-4 md:px-5 py-3 text-center align-middle">
                          <Badge
                            className={cn("border text-[10px] px-1.5 py-0.5", status.className)}
                          >
                            {status.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Expenses ── */}
      {tab === "Expenses" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-muted" /> Expenses
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  ${totalExpenses.toLocaleString()} this month
                </span>
                <button
                  onClick={() => setModal("expense")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                >
                  + Log Expense
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Date
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Category
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                      Description
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Vendor
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Amount
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Receipt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_EXPENSES.map((exp) => (
                    <tr
                      key={exp.id}
                      className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                    >
                      <td className="px-4 md:px-5 py-3 text-xs text-muted align-middle whitespace-nowrap">
                        {exp.date}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="text-xs font-medium text-foreground">{exp.category}</span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell align-middle">
                        <span className="text-xs text-muted">{exp.description}</span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell align-middle">
                        <span className="text-xs text-muted">{exp.vendor}</span>
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          ${exp.amount.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 md:px-5 py-3 text-center align-middle">
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            exp.receipt ? "text-[#4e6b51]" : "text-muted",
                          )}
                        >
                          {exp.receipt ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-surface/40">
                    <td
                      colSpan={4}
                      className="px-4 md:px-5 py-2.5 text-xs font-semibold text-foreground hidden lg:table-cell"
                    >
                      Total
                    </td>
                    <td
                      colSpan={4}
                      className="px-4 md:px-5 py-2.5 text-xs font-semibold text-foreground lg:hidden"
                    >
                      Total
                    </td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold text-foreground tabular-nums">
                      ${totalExpenses.toLocaleString()}
                    </td>
                    <td className="px-4 md:px-5 py-2.5" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Gift Cards ── */}
      {tab === "Gift Cards" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Gift className="w-4 h-4 text-muted" /> Gift Cards
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted">
                  {activeGiftCards} active · ${totalGiftCardValue} issued
                </span>
                <button
                  onClick={() => setModal("giftcard")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
                >
                  + Issue Gift Card
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Code
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                      Purchased By
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Recipient
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Value
                    </th>
                    <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Balance
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Expires
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_GIFT_CARDS.map((gc) => {
                    const status = giftCardStatusConfig(gc.status);
                    return (
                      <tr
                        key={gc.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <span className="text-xs font-mono text-foreground">{gc.code}</span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell align-middle">
                          <span className="text-xs text-muted">{gc.purchasedBy}</span>
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="text-sm font-medium text-foreground">
                            {gc.recipient}
                          </span>
                          <p className="text-[10px] text-muted mt-0.5">{gc.purchasedDate}</p>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            ${gc.originalAmount}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right align-middle">
                          <span
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              gc.balance === 0 ? "text-muted" : "text-foreground",
                            )}
                          >
                            ${gc.balance}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell align-middle">
                          <span className="text-xs text-muted">{gc.expiryDate}</span>
                        </td>
                        <td className="px-4 md:px-5 py-3 text-center align-middle">
                          <Badge
                            className={cn("border text-[10px] px-1.5 py-0.5", status.className)}
                          >
                            {status.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Modals ── */}

      <Dialog
        open={modal === "invoice"}
        onClose={closeModal}
        title="New Invoice"
        description="Send an invoice to a client for services rendered."
      >
        <div className="space-y-4">
          <Field label="Client" required>
            <Input placeholder="Search client name…" />
          </Field>
          <Field label="Services / Description" required>
            <Textarea rows={2} placeholder="e.g. Volume Lashes — Full Set" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount ($)" required>
              <Input type="number" placeholder="0.00" min={0} step={0.01} />
            </Field>
            <Field label="Due Date" required>
              <Input type="date" />
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} placeholder="Any additional notes for the client…" />
          </Field>
          <DialogFooter onCancel={closeModal} onConfirm={closeModal} confirmLabel="Send Invoice" />
        </div>
      </Dialog>

      <Dialog
        open={modal === "expense"}
        onClose={closeModal}
        title="Log Expense"
        description="Record a business expense for your records."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required>
              <Input type="date" />
            </Field>
            <Field label="Category" required>
              <Select>
                <option value="">Select…</option>
                {["Supplies", "Rent", "Marketing", "Equipment", "Software", "Travel", "Other"].map(
                  (c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ),
                )}
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Input placeholder="e.g. Monthly lash supply restock" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor">
              <Input placeholder="e.g. Beauty Supply Co" />
            </Field>
            <Field label="Amount ($)" required>
              <Input type="number" placeholder="0.00" min={0} step={0.01} />
            </Field>
          </div>
          <Field label="Receipt">
            <Select>
              <option value="yes">Receipt attached</option>
              <option value="no">No receipt</option>
            </Select>
          </Field>
          <DialogFooter onCancel={closeModal} onConfirm={closeModal} confirmLabel="Log Expense" />
        </div>
      </Dialog>

      <Dialog
        open={modal === "giftcard"}
        onClose={closeModal}
        title="Issue Gift Card"
        description="Create a new gift card for a client or recipient."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchased By" required>
              <Input placeholder="Client name or email" />
            </Field>
            <Field label="Recipient">
              <Input placeholder="Recipient name (if different)" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount ($)" required>
              <Input type="number" placeholder="0.00" min={1} step={1} />
            </Field>
            <Field label="Expiry Date">
              <Input type="date" />
            </Field>
          </div>
          <Field label="Payment Method" required>
            <Select>
              <option value="">Select…</option>
              <option value="card">Card</option>
              <option value="cash">Cash</option>
              <option value="square">Square</option>
            </Select>
          </Field>
          <Field label="Notes">
            <Input placeholder="e.g. Birthday gift, include card" />
          </Field>
          <DialogFooter
            onCancel={closeModal}
            onConfirm={closeModal}
            confirmLabel="Issue Gift Card"
          />
        </div>
      </Dialog>

      <Dialog
        open={modal === "promo"}
        onClose={closeModal}
        title="New Promotion"
        description="Create a discount code or offer for your clients."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Promo Code" required>
              <Input placeholder="e.g. SUMMER25" style={{ textTransform: "uppercase" }} />
            </Field>
            <Field label="Discount Type" required>
              <Select>
                <option value="percent">Percentage (%)</option>
                <option value="fixed">Fixed amount ($)</option>
                <option value="bogo">Buy one get one</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount Value" required>
              <Input type="number" placeholder="e.g. 20" min={1} />
            </Field>
            <Field label="Max Uses">
              <Input type="number" placeholder="Leave blank for unlimited" min={1} />
            </Field>
          </div>
          <Field label="Applies To">
            <Select>
              <option value="all">All services</option>
              <option value="lash">Lash services only</option>
              <option value="jewelry">Jewelry only</option>
              <option value="crochet">Crochet only</option>
              <option value="consulting">Consulting only</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date">
              <Input type="date" />
            </Field>
            <Field label="End Date">
              <Input type="date" />
            </Field>
          </div>
          <Field label="Description">
            <Input placeholder="Brief note about this promo…" />
          </Field>
          <DialogFooter onCancel={closeModal} onConfirm={closeModal} confirmLabel="Create Promo" />
        </div>
      </Dialog>

      {/* ── Promotions ── */}
      {tab === "Promotions" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Promotions & Discount Codes</h2>
              <p className="text-xs text-muted mt-0.5">
                Create discount codes, seasonal offers, and referral bonuses.
              </p>
            </div>
            <button
              onClick={() => setModal("promo")}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              <Tag className="w-3.5 h-3.5" />
              New Promo
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Active Promos", value: "4" },
              { label: "Total Redemptions", value: "38" },
              { label: "Revenue from Promos", value: "$2,140" },
            ].map((s) => (
              <div key={s.label} className="bg-background border border-border rounded-xl p-3">
                <p className="text-[10px] text-muted uppercase tracking-wide font-medium">
                  {s.label}
                </p>
                <p className="text-2xl font-semibold text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              {
                code: "NEWCLIENT20",
                value: "20%",
                description: "New client first appointment discount",
                uses: 14,
                maxUses: null as number | null,
                expires: "No expiry",
                active: true,
              },
              {
                code: "REFERFRIEND",
                value: "$15",
                description: "Referral reward — $15 off for referrer",
                uses: 9,
                maxUses: 50 as number | null,
                expires: "Dec 31, 2025",
                active: true,
              },
              {
                code: "VDAY25",
                value: "25%",
                description: "Valentine's Day lash special",
                uses: 8,
                maxUses: 20 as number | null,
                expires: "Feb 14, 2025",
                active: false,
              },
              {
                code: "LASH2FOR1",
                value: "2-for-1",
                description: "Second lash fill free when booked same day",
                uses: 7,
                maxUses: null as number | null,
                expires: "Mar 31, 2025",
                active: true,
              },
              {
                code: "TRAINING15",
                value: "15%",
                description: "Student discount for training courses",
                uses: 0,
                maxUses: null as number | null,
                expires: "No expiry",
                active: true,
              },
            ].map((p) => (
              <div
                key={p.code}
                className={cn(
                  "bg-background border rounded-xl p-4 flex flex-col gap-3",
                  p.active ? "border-border" : "border-border/40 opacity-60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-foreground">
                        {p.code}
                      </span>
                      <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
                        {p.value}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{p.description}</p>
                  </div>
                  <button className="p-1.5 text-muted hover:text-destructive hover:bg-destructive/8 rounded-lg transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-muted flex-wrap">
                  <span>
                    {p.uses}
                    {p.maxUses ? `/${p.maxUses}` : ""} uses
                  </span>
                  <span>Expires: {p.expires}</span>
                  <span className={cn("font-medium", p.active ? "text-[#4e6b51]" : "text-muted")}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
