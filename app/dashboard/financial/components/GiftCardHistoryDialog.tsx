/**
 * Gift card transaction history dialog — shows all transactions for a single
 * gift card (purchases, redemptions, refunds, adjustments) in a timeline.
 *
 * Fetches transaction history via getGiftCardHistory() on open, using the
 * "loadedCardId !== card.id" render-time pattern to avoid re-fetching.
 *
 * Parent: app/dashboard/financial/components/GiftCardsTab.tsx
 *
 * State:
 *   transactions  — GiftCardTxRow[] for this card
 *   loading       — true while fetching
 *   loadedCardId  — prevents re-fetch on re-render
 *
 * Key operations:
 *   transactions.map() — renders each tx with icon (ArrowUpRight for credits,
 *     ArrowDownLeft for debits), amount, balance-after, badge, and metadata.
 *   TX_CONFIG — maps tx type strings to { label, icon, color } for display.
 *   isCredit = tx.amount > 0 — determines green vs red styling for the amount.
 */
"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { GiftCardRow, GiftCardTxRow } from "../actions";
import { getGiftCardHistory } from "../actions";

const TX_CONFIG: Record<string, { label: string; icon: typeof ArrowDownLeft; color: string }> = {
  purchase: { label: "Purchase", icon: ArrowUpRight, color: "text-[#4e6b51]" },
  redemption: { label: "Redemption", icon: ArrowDownLeft, color: "text-destructive" },
  refund: { label: "Refund", icon: RefreshCw, color: "text-amber-600" },
  adjustment: { label: "Adjustment", icon: Settings, color: "text-muted" },
};

export function GiftCardHistoryDialog({
  open,
  onClose,
  card,
}: {
  open: boolean;
  onClose: () => void;
  card: GiftCardRow;
}) {
  const [transactions, setTransactions] = useState<GiftCardTxRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedCardId, setLoadedCardId] = useState<number | null>(null);

  if (open && loadedCardId !== card.id) {
    setLoadedCardId(card.id);
    setLoading(true);
    setTransactions([]);
    getGiftCardHistory(card.id).then((rows) => {
      setTransactions(rows);
      setLoading(false);
    });
  }

  if (!open && loadedCardId !== null) {
    setLoadedCardId(null);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Gift Card ${card.code}`}
      description={`$${card.originalAmount} issued · $${card.balance} remaining`}
      size="lg"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-muted">Loading…</div>
      ) : transactions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted">No transactions recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => {
            const config = TX_CONFIG[tx.type] ?? TX_CONFIG.adjustment;
            const Icon = config.icon;
            const isCredit = tx.amount > 0;

            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/50 hover:bg-foreground/3 transition-colors"
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    isCredit ? "bg-[#4e6b51]/10" : "bg-destructive/10",
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        "border text-[10px] px-1.5 py-0.5",
                        isCredit
                          ? "bg-[#4e6b51]/10 text-[#4e6b51] border-[#4e6b51]/20"
                          : "bg-destructive/10 text-destructive border-destructive/20",
                      )}
                    >
                      {config.label}
                    </Badge>
                    {tx.bookingService && (
                      <span className="text-xs text-muted truncate">{tx.bookingService}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted">{tx.createdAt}</span>
                    {tx.performedByName && (
                      <span className="text-[10px] text-muted">by {tx.performedByName}</span>
                    )}
                  </div>
                  {tx.notes && (
                    <p className="text-[10px] text-muted/70 mt-0.5 truncate">{tx.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      isCredit ? "text-[#4e6b51]" : "text-destructive",
                    )}
                  >
                    {isCredit ? "+" : ""}${Math.abs(tx.amount)}
                  </p>
                  <p className="text-[10px] text-muted tabular-nums">${tx.balanceAfter} bal</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Done" />
    </Dialog>
  );
}
