/**
 * Deposit collection tracking — expected vs collected deposits,
 * plus a list of pending deposits with "Send Link" action buttons.
 *
 * @module financial/components/DepositTrackingSection
 * @see {@link ../actions.ts} — `DepositStats` type, `getDepositStats()`
 */
"use client";

import { useState, useTransition } from "react";
import { Shield, Link2, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DepositStats } from "../actions";
import { createPaymentLink } from "../payment-actions";

export function DepositTrackingSection({ data }: { data: DepositStats }) {
  const [isPending, startTransition] = useTransition();
  const [sentIds, setSentIds] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);

  function handleSendLink(bookingId: number, depositInCents: number) {
    setActiveId(bookingId);
    startTransition(async () => {
      const result = await createPaymentLink({
        bookingId,
        amountInCents: depositInCents,
        type: "deposit",
      });
      if (result.success && result.url) {
        await navigator.clipboard.writeText(result.url);
        setSentIds((prev) => new Set(prev).add(bookingId));
      }
      setActiveId(null);
    });
  }

  return (
    <Card className="gap-0">
      <CardHeader className="pt-5 pb-0 px-5">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted" /> Deposit Collection
        </CardTitle>
        <p className="text-xs text-muted mt-0.5">Last 90 days — bookings requiring a deposit</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-4">
        {data.bookingsNeedingDeposit === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No deposit-requiring bookings found.
          </p>
        ) : (
          <div className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-2xl font-semibold text-foreground tabular-nums">
                  {data.collectionRate}%
                </span>
                <span className="text-xs text-muted">
                  ${data.totalCollected.toLocaleString()} / ${data.totalExpected.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#4e6b51] transition-all"
                  style={{ width: `${data.collectionRate}%` }}
                />
              </div>
            </div>

            {/* Counts */}
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-muted">Bookings needing deposit: </span>
                <span className="font-medium text-foreground tabular-nums">
                  {data.bookingsNeedingDeposit}
                </span>
              </div>
              <div>
                <span className="text-muted">Deposits collected: </span>
                <span className="font-medium text-foreground tabular-nums">
                  {data.bookingsWithDeposit}
                </span>
              </div>
            </div>

            {/* Pending deposits list */}
            {data.pendingDeposits.length > 0 && (
              <div className="border-t border-border/40 pt-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Awaiting Deposit</p>
                {data.pendingDeposits.map((dep) => {
                  const isSent = sentIds.has(dep.bookingId);
                  const isLoading = isPending && activeId === dep.bookingId;

                  return (
                    <div
                      key={dep.bookingId}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-surface border border-border/40"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {dep.clientName}
                        </p>
                        <p className="text-[10px] text-muted truncate">
                          {dep.serviceName} — {dep.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-xs font-medium text-foreground tabular-nums">
                          ${(dep.depositRequiredInCents / 100).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleSendLink(dep.bookingId, dep.depositRequiredInCents)}
                          disabled={isLoading || isSent}
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-50 bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border/60"
                        >
                          {isSent ? (
                            <>
                              <Check className="w-3 h-3 text-[#4e6b51]" /> Copied
                            </>
                          ) : isLoading ? (
                            "..."
                          ) : (
                            <>
                              <Link2 className="w-3 h-3" /> Send Link
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
