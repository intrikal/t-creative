/**
 * Client Lifetime Value — top 10 clients by total spend.
 *
 * @module analytics/components/ClientLtvSection
 * @see {@link ../actions.ts} — `ClientLifetimeValue` type, `getClientLifetimeValues()`
 */
"use client";

import { DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientLifetimeValue } from "../actions";

export function ClientLtvSection({ clients }: { clients: ClientLifetimeValue[] }) {
  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted" /> Client Lifetime Value
        </CardTitle>
        <p className="text-xs text-muted mt-0.5">Top 10 clients by total spend</p>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {clients.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">No payment data yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5 w-6">
                  #
                </th>
                <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Client
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                  Transactions
                </th>
                <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-muted px-5 pb-2.5">
                  Total Spend
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr
                  key={c.clientId}
                  className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                >
                  <td className="px-5 py-3 text-[11px] text-muted/50 align-middle">{i + 1}</td>
                  <td className="px-3 py-3 align-middle">
                    <span className="text-sm text-foreground">{c.name}</span>
                  </td>
                  <td className="px-3 py-3 text-right align-middle">
                    <span className="text-xs text-muted tabular-nums">{c.transactionCount}</span>
                  </td>
                  <td className="px-5 py-3 text-right align-middle">
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      ${c.totalSpend.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
