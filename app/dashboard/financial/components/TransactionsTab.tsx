/**
 * Transactions tab — DB-wired payment transaction table with search & filter.
 *
 * Receives `PaymentRow[]` from the server (via `getPayments()`).
 * Supports client/service text search and category chip filters.
 *
 * Payment statuses from Square (`paid`, `pending`, `failed`, `refunded`,
 * `partially_refunded`) are mapped to colour-coded badges.
 * Payment methods (`square_card`, `square_cash`, etc.) are mapped to
 * human-readable labels.
 *
 * @module financial/components/TransactionsTab
 * @see {@link ../actions.ts} — `PaymentRow` type
 */
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PaymentRow } from "../actions";

const CATEGORY_FILTERS = ["All", "Lash", "Jewelry", "Consulting", "Crochet"];

function paymentStatusConfig(status: string) {
  switch (status) {
    case "paid":
      return { label: "Paid", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "refunded":
    case "partially_refunded":
      return { label: "Refunded", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "failed":
      return {
        label: "Failed",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    default:
      return { label: status, className: "bg-foreground/8 text-muted border-foreground/10" };
  }
}

function methodLabel(method: string | null) {
  const map: Record<string, string> = {
    square_card: "Card",
    square_cash: "Cash App",
    square_wallet: "Wallet",
    square_gift_card: "Gift Card",
    square_other: "Other",
    cash: "Cash",
  };
  return method ? (map[method] ?? method) : "—";
}

function categoryMatchesFilter(category: string | null, filter: string) {
  if (filter === "All") return true;
  const map: Record<string, string> = {
    lash: "Lash",
    jewelry: "Jewelry",
    consulting: "Consulting",
    crochet: "Crochet",
  };
  return category ? map[category] === filter : false;
}

export function TransactionsTab({
  payments,
  onRefund,
}: {
  payments: PaymentRow[];
  onRefund?: (payment: PaymentRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filtered = payments.filter((p) => {
    const matchSearch =
      !search ||
      p.client.toLowerCase().includes(search.toLowerCase()) ||
      p.service.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryMatchesFilter(p.category, categoryFilter);
    return matchSearch && matchCategory;
  });

  return (
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
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                    Status
                  </th>
                  <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5 w-16"></th>
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
                        <span className="text-xs text-muted">{methodLabel(payment.method)}</span>
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <p className="text-sm font-semibold text-foreground tabular-nums">
                          ${payment.amount}
                        </p>
                        {payment.tip > 0 && (
                          <p className="text-[10px] text-muted tabular-nums">+${payment.tip} tip</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-4 md:px-5 py-3 text-center align-middle">
                        {onRefund &&
                          (payment.status === "paid" ||
                            payment.status === "partially_refunded") && (
                            <button
                              onClick={() => onRefund(payment)}
                              className="text-[11px] text-muted hover:text-destructive transition-colors font-medium"
                            >
                              Refund
                            </button>
                          )}
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
  );
}
