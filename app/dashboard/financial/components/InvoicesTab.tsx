/**
 * Invoices tab — DB-wired invoice table with status badges.
 *
 * Receives `InvoiceRow[]` from `getInvoices()` via parent props.
 *
 * @module financial/components/InvoicesTab
 * @see {@link ../actions.ts} — `InvoiceRow` type, `getInvoices()`
 */
"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { InvoiceRow } from "../actions";

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

function invoiceStatusConfig(status: string) {
  switch (status as InvoiceStatus) {
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
    default:
      return { label: status, className: "bg-foreground/5 text-muted border-foreground/10" };
  }
}

export function InvoicesTab({
  invoices,
  onNewInvoice,
}: {
  invoices: InvoiceRow[];
  onNewInvoice: () => void;
}) {
  const outstandingInvoices = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + i.amount, 0);

  return (
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
              onClick={onNewInvoice}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              + New Invoice
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {invoices.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">
            No invoices yet. Create one to get started.
          </p>
        ) : (
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
                    Description
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
                {invoices.map((inv) => {
                  const status = invoiceStatusConfig(inv.status);
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors"
                    >
                      <td className="px-4 md:px-5 py-3 align-middle">
                        <span className="text-xs text-muted font-mono">{inv.number}</span>
                        {inv.isRecurring && (
                          <Badge className="ml-1.5 border text-[9px] px-1 py-0 bg-accent/10 text-accent border-accent/20">
                            Recurring
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="text-sm font-medium text-foreground">{inv.client}</span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell align-middle">
                        <span className="text-xs text-muted">{inv.description}</span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell align-middle">
                        <span className="text-xs text-muted">{inv.issuedAt ?? "—"}</span>
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
                          {inv.dueAt ?? "—"}
                        </span>
                        {inv.isRecurring && inv.nextDueAt && (
                          <p className="text-[10px] text-muted mt-0.5">Next: {inv.nextDueAt}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right align-middle">
                        <span className="text-sm font-semibold text-foreground tabular-nums">
                          ${inv.amount}
                        </span>
                      </td>
                      <td className="px-4 md:px-5 py-3 text-center align-middle">
                        <Badge className={cn("border text-[10px] px-1.5 py-0.5", status.className)}>
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
  );
}
