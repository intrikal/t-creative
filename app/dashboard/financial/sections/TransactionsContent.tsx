"use client";

import { useState, useCallback } from "react";
import type { PaymentRow } from "../actions";
import { PaymentLinkDialog } from "../components/PaymentLinkDialog";
import { RecordPaymentDialog } from "../components/RecordPaymentDialog";
import { RefundDialog } from "../components/RefundDialog";
import { TransactionsTab } from "../components/TransactionsTab";
import type { BookingForPayment } from "../payment-actions";

export function TransactionsContent({
  payments,
  bookingsForPayment,
}: {
  payments: PaymentRow[];
  bookingsForPayment: BookingForPayment[];
}) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLinkBooking, setPaymentLinkBooking] = useState<BookingForPayment | null>(null);
  const [refundPayment, setRefundPayment] = useState<PaymentRow | null>(null);
  const handleRefund = useCallback((payment: PaymentRow) => {
    setRefundPayment(payment);
  }, []);

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {
            if (bookingsForPayment.length > 0) setPaymentLinkBooking(bookingsForPayment[0]);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface text-foreground border border-border hover:bg-foreground/5 transition-colors"
        >
          Send Payment Link
        </button>
        <button
          onClick={() => setPaymentDialogOpen(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          Record Payment
        </button>
      </div>
      <TransactionsTab payments={payments} onRefund={handleRefund} />
      <RecordPaymentDialog
        open={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        bookings={bookingsForPayment}
      />
      <RefundDialog
        open={!!refundPayment}
        onClose={() => setRefundPayment(null)}
        payment={refundPayment}
      />
      <PaymentLinkDialog
        open={!!paymentLinkBooking}
        onClose={() => setPaymentLinkBooking(null)}
        booking={paymentLinkBooking}
      />
    </>
  );
}
