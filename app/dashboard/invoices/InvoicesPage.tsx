"use client";

import { useState, useMemo } from "react";
import {
  Receipt,
  ShoppingBag,
  GraduationCap,
  CalendarCheck,
  Search,
  FileText,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClientInvoiceRow, ClientInvoicesData, InvoiceType, InvoiceStatus } from "./actions";

/* ------------------------------------------------------------------ */
/*  Config                                                              */
/* ------------------------------------------------------------------ */

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
  invoice: {
    label: "Invoice",
    icon: FileText,
    iconBg: "bg-foreground/5",
    iconColor: "text-muted",
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
  overdue: {
    label: "Overdue",
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/20",
  },
  draft: {
    label: "Draft",
    color: "text-muted",
    bg: "bg-foreground/5",
    border: "border-border",
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

export function ClientInvoicesPage({ data }: { data: ClientInvoicesData }) {
  const [filterType, setFilterType] = useState<"all" | InvoiceType>("all");
  const [search, setSearch] = useState("");

  const allInvoices = data.invoiceRows;

  const filtered = useMemo(
    () =>
      allInvoices.filter((inv) => {
        if (filterType !== "all" && inv.type !== filterType) return false;
        if (
          search &&
          !inv.description.toLowerCase().includes(search.toLowerCase()) &&
          !inv.id.toLowerCase().includes(search.toLowerCase())
        )
          return false;
        return true;
      }),
    [allInvoices, filterType, search],
  );

  const totalPaid = allInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);

  const totalVisits = allInvoices.filter(
    (i) => i.type === "appointment" && i.status === "paid",
  ).length;

  const pendingCount = allInvoices.filter(
    (i) => i.status === "pending" || i.status === "overdue",
  ).length;

  // Which filter types actually have data
  const activeTypes = useMemo(() => {
    const types = new Set<InvoiceType>();
    for (const inv of allInvoices) types.add(inv.type);
    return types;
  }, [allInvoices]);

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
            <StatPill label="Invoices" value={String(allInvoices.length)} sub="Total records" />
            {pendingCount > 0 && (
              <>
                <div className="w-px bg-border" />
                <StatPill
                  label="Outstanding"
                  value={String(pendingCount)}
                  sub="Pending / overdue"
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Overdue banner */}
      {allInvoices.some((i) => i.status === "overdue") && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-destructive/20 bg-destructive/5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive font-medium">
            You have overdue invoices. Please contact T Creative Studio for assistance.
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
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

        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilterType("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterType === "all"
                ? "bg-foreground/8 text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            All
          </button>
          {(["appointment", "shop", "training", "deposit", "invoice"] as const)
            .filter((f) => activeTypes.has(f))
            .map((f) => (
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
                {TYPE_CONFIG[f].label}
              </button>
            ))}
        </div>
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl">
          <Receipt className="w-8 h-8 text-muted/40 mx-auto mb-2" />
          <p className="text-sm text-muted">
            {allInvoices.length === 0 ? "No invoices yet" : "No invoices found"}
          </p>
          {allInvoices.length === 0 && (
            <p className="text-xs text-muted/60 mt-1">
              Your payment history will appear here after your first appointment.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((invoice) => {
            const t = TYPE_CONFIG[invoice.type];
            const s = STATUS_CONFIG[invoice.status];
            return (
              <Card key={`${invoice.id}-${invoice.dateKey}`} className="gap-0">
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
                      {invoice.dueDate && invoice.status !== "paid" && (
                        <span className="text-destructive/70"> · Due {invoice.dueDate}</span>
                      )}
                    </p>
                  </div>

                  {/* Amount + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        invoice.status === "refunded"
                          ? "text-muted line-through"
                          : "text-foreground",
                      )}
                    >
                      ${invoice.amount.toFixed(2)}
                    </p>
                    {invoice.receiptUrl && (
                      <a
                        href={invoice.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/5 transition-colors"
                        title="View receipt"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
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
