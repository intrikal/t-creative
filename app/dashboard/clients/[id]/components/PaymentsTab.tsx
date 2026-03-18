/**
 * @module PaymentsTab
 * Payment history with summary cards for total paid, tips, and refunds,
 * plus a detailed list of individual payment records.
 */

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, formatCents, statusBadge } from "./helpers";
import type { ClientDetailData } from "./types";

interface PaymentsTabProps {
  data: ClientDetailData;
}

export function PaymentsTab({ data }: PaymentsTabProps) {
  if (data.payments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted">No payment records</p>
      </div>
    );
  }

  const totalPaid = data.payments
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amountInCents, 0);
  const totalTips = data.payments.reduce((s, p) => s + p.tipInCents, 0);
  const totalRefunded = data.payments.reduce((s, p) => s + p.refundedInCents, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Total Paid
            </p>
            <p className="text-xl font-semibold text-foreground">{formatCents(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Tips
            </p>
            <p className="text-xl font-semibold text-foreground">{formatCents(totalTips)}</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
              Refunded
            </p>
            <p className="text-xl font-semibold text-foreground">{formatCents(totalRefunded)}</p>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        {data.payments.map((p) => (
          <Card key={p.id} className="py-0">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge
                    className={cn(
                      "border text-[10px] px-1.5 py-0.5 font-medium",
                      statusBadge(p.status),
                    )}
                  >
                    {p.status}
                  </Badge>
                  {p.method && (
                    <span className="text-xs text-muted capitalize">
                      {p.method.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {p.paidAt ? formatDateTime(p.paidAt) : formatDateTime(p.createdAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-foreground">
                  {formatCents(p.amountInCents)}
                </p>
                {p.tipInCents > 0 && (
                  <p className="text-[10px] text-muted">+{formatCents(p.tipInCents)} tip</p>
                )}
                {p.refundedInCents > 0 && (
                  <p className="text-[10px] text-orange-600">
                    -{formatCents(p.refundedInCents)} refund
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
