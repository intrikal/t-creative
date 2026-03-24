"use client";

import { type ReactNode, useState } from "react";
import { ExportButton } from "@/components/ExportButton";
import { cn } from "@/lib/utils";

const FINANCIAL_TABS = [
  "Revenue",
  "Transactions",
  "Invoices",
  "Expenses",
  "Gift Cards",
  "Promotions",
] as const;
type FinancialTab = (typeof FINANCIAL_TABS)[number];

export function FinancialShell({
  overview,
  revenue,
  transactions,
  invoices,
  expenses,
  giftCards,
  promotions,
}: {
  overview: ReactNode;
  revenue: ReactNode;
  transactions: ReactNode;
  invoices: ReactNode;
  expenses: ReactNode;
  giftCards: ReactNode;
  promotions: ReactNode;
}) {
  const [range, setRange] = useState("7d");
  const [tab, setTab] = useState<FinancialTab>("Revenue");

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Financial
          </h1>
          <p className="text-sm text-muted mt-0.5">Payments, transactions, and earnings</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
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
      </div>

      {/* Overview (stat cards, charts, sections) */}
      {overview}

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {FINANCIAL_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground hover:border-border",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content — show/hide via CSS so server-streamed Suspense
          boundaries resolve independently without re-mounting on tab switch */}
      <div style={{ display: tab === "Revenue" ? "block" : "none" }}>{revenue}</div>
      <div style={{ display: tab === "Transactions" ? "block" : "none" }}>{transactions}</div>
      <div style={{ display: tab === "Invoices" ? "block" : "none" }}>{invoices}</div>
      <div style={{ display: tab === "Expenses" ? "block" : "none" }}>{expenses}</div>
      <div style={{ display: tab === "Gift Cards" ? "block" : "none" }}>{giftCards}</div>
      <div style={{ display: tab === "Promotions" ? "block" : "none" }}>{promotions}</div>
    </div>
  );
}
