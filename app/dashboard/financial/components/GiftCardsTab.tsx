/**
 * Gift Cards tab — DB-wired gift card table with status badges.
 *
 * Receives `GiftCardRow[]` from `getGiftCards()` via parent props.
 *
 * @module financial/components/GiftCardsTab
 * @see {@link ../actions.ts} — `GiftCardRow` type, `getGiftCards()`
 */
"use client";

import { Gift } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GiftCardRow } from "../actions";

function giftCardStatusConfig(status: string) {
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
    default:
      return { label: status, className: "bg-foreground/5 text-muted border-foreground/10" };
  }
}

export function GiftCardsTab({
  giftCards,
  onIssueGiftCard,
}: {
  giftCards: GiftCardRow[];
  onIssueGiftCard: () => void;
}) {
  const totalGiftCardValue = giftCards.reduce((s, g) => s + g.originalAmount, 0);
  const activeGiftCards = giftCards.filter((g) => g.status === "active").length;

  return (
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
              onClick={onIssueGiftCard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              + Issue Gift Card
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-3">
        {giftCards.length === 0 ? (
          <p className="text-sm text-muted text-center py-12">No gift cards issued yet.</p>
        ) : (
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
                {giftCards.map((gc) => {
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
                        <span className="text-xs text-muted">{gc.purchasedBy ?? "Walk-in"}</span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span className="text-sm font-medium text-foreground">
                          {gc.recipientName ?? "—"}
                        </span>
                        <p className="text-[10px] text-muted mt-0.5">{gc.purchasedAt}</p>
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
                        <span className="text-xs text-muted">{gc.expiresAt ?? "No expiry"}</span>
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
