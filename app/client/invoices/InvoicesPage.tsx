"use client";

import { useState } from "react";
import {
  Download,
  Receipt,
  ShoppingBag,
  GraduationCap,
  CalendarCheck,
  Filter,
  Search,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types & data                                                        */
/* ------------------------------------------------------------------ */

type InvoiceType = "appointment" | "shop" | "training" | "deposit";
type InvoiceStatus = "paid" | "pending" | "refunded";

interface Invoice {
  id: string;
  date: string;
  type: InvoiceType;
  description: string;
  amount: string;
  status: InvoiceStatus;
}

const INVOICES: Invoice[] = [
  {
    id: "INV-0041",
    date: "Feb 14, 2026",
    type: "appointment",
    description: "Full Set — Classic Lashes · Tanya",
    amount: "$120.00",
    status: "paid",
  },
  {
    id: "INV-0039",
    date: "Jan 25, 2026",
    type: "shop",
    description: "Lash Aftercare Kit × 1",
    amount: "$18.00",
    status: "paid",
  },
  {
    id: "INV-0037",
    date: "Jan 10, 2026",
    type: "appointment",
    description: "Lash Fill — Classic · Tanya",
    amount: "$65.00",
    status: "paid",
  },
  {
    id: "INV-0035",
    date: "Dec 22, 2025",
    type: "appointment",
    description: "Permanent Jewelry — Bracelet · Tanya",
    amount: "$55.00",
    status: "paid",
  },
  {
    id: "INV-0031",
    date: "Dec 2, 2025",
    type: "shop",
    description: "T Creative Lash Cleanser × 2",
    amount: "$28.00",
    status: "paid",
  },
  {
    id: "INV-0028",
    date: "Nov 15, 2025",
    type: "training",
    description: "Classic Lash Certification — Deposit",
    amount: "$100.00",
    status: "paid",
  },
  {
    id: "INV-0027",
    date: "Nov 15, 2025",
    type: "appointment",
    description: "Lash Fill — Classic · Tanya",
    amount: "$65.00",
    status: "paid",
  },
  {
    id: "INV-0022",
    date: "Oct 14, 2025",
    type: "shop",
    description: "Lash Spoolie Set × 1 · Lash Cleanser × 1",
    amount: "$19.00",
    status: "paid",
  },
  {
    id: "INV-0018",
    date: "Oct 1, 2025",
    type: "appointment",
    description: "Full Set — Classic Lashes · Tanya",
    amount: "$120.00",
    status: "paid",
  },
  {
    id: "INV-0015",
    date: "Sep 12, 2025",
    type: "deposit",
    description: "Appointment Deposit — Permanent Jewelry",
    amount: "$25.00",
    status: "refunded",
  },
];

const TYPE_CONFIG: Record<
  InvoiceType,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
  }
> = {
  appointment: {
    label: "Appointment",
    icon: CalendarCheck,
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
  },
  shop: {
    label: "Shop Order",
    icon: ShoppingBag,
    iconBg: "bg-[#4e6b51]/10",
    iconColor: "text-[#4e6b51]",
  },
  training: {
    label: "Training",
    icon: GraduationCap,
    iconBg: "bg-[#7ba3a3]/10",
    iconColor: "text-[#4a7a7a]",
  },
  deposit: {
    label: "Deposit",
    icon: Receipt,
    iconBg: "bg-[#d4a574]/10",
    iconColor: "text-[#a07040]",
  },
};

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  paid: {
    label: "Paid",
    color: "text-[#4e6b51]",
    bg: "bg-[#4e6b51]/10",
    border: "border-[#4e6b51]/20",
  },
  pending: {
    label: "Pending",
    color: "text-[#a07040]",
    bg: "bg-[#d4a574]/10",
    border: "border-[#d4a574]/20",
  },
  refunded: {
    label: "Refunded",
    color: "text-muted",
    bg: "bg-foreground/5",
    border: "border-border",
  },
};

/* ------------------------------------------------------------------ */
/*  Summary stats                                                       */
/* ------------------------------------------------------------------ */

function StatPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-[11px] text-muted font-medium uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientInvoicesPage() {
  const [filterType, setFilterType] = useState<"all" | InvoiceType>("all");
  const [search, setSearch] = useState("");

  const filtered = INVOICES.filter((inv) => {
    if (filterType !== "all" && inv.type !== filterType) return false;
    if (
      search &&
      !inv.description.toLowerCase().includes(search.toLowerCase()) &&
      !inv.id.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const totalPaid = INVOICES.filter((i) => i.status === "paid").reduce(
    (sum, i) => sum + parseFloat(i.amount.replace("$", "")),
    0,
  );

  const totalVisits = INVOICES.filter(
    (i) => i.type === "appointment" && i.status === "paid",
  ).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Invoices</h1>
        <p className="text-sm text-muted mt-0.5">Your payment history with T Creative Studio</p>
      </div>

      {/* Summary strip */}
      <Card className="gap-0">
        <CardContent className="px-5 py-4">
          <div className="flex flex-wrap gap-6">
            <StatPill label="Total Spent" value={`$${totalPaid.toFixed(2)}`} sub="All time" />
            <div className="w-px bg-border" />
            <StatPill label="Appointments" value={String(totalVisits)} sub="Paid visits" />
            <div className="w-px bg-border" />
            <StatPill label="Invoices" value={String(INVOICES.length)} sub="Total records" />
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
          <input
            type="text"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/40"
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1 flex-wrap">
          {(["all", "appointment", "shop", "training", "deposit"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filterType === f
                  ? "bg-foreground/8 text-foreground"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f === "all" ? "All" : TYPE_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <Receipt className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((invoice) => {
            const t = TYPE_CONFIG[invoice.type];
            const s = STATUS_CONFIG[invoice.status];
            return (
              <Card key={invoice.id} className="gap-0">
                <CardContent className="px-5 py-3.5 flex items-center gap-3">
                  {/* Icon */}
                  <div
                    className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      t.iconBg,
                    )}
                  >
                    <t.icon className={cn("w-4 h-4", t.iconColor)} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-semibold text-foreground">{invoice.id}</p>
                      <span
                        className={cn(
                          "text-[10px] font-medium border px-1.5 py-0.5 rounded-full",
                          s.color,
                          s.bg,
                          s.border,
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 truncate">{invoice.description}</p>
                    <p className="text-[11px] text-muted/60 mt-0.5">
                      {invoice.date} · {t.label}
                    </p>
                  </div>

                  {/* Amount + download */}
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-bold text-foreground">{invoice.amount}</p>
                    <button
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                      title="Download receipt"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
