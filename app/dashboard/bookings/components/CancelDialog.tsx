"use client";

import { Dialog, Field, Textarea, DialogFooter } from "@/components/ui/dialog";
import type { Booking } from "../BookingsPage";

export function CancelDialog({
  target,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  target: Booking | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Cancel Booking"
      description={target ? `Cancel ${target.service} for ${target.client}?` : ""}
    >
      <Field label="Reason (optional)">
        <Textarea
          rows={2}
          placeholder="Why is this booking being cancelled?"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
        />
      </Field>
      <DialogFooter
        onCancel={onClose}
        onConfirm={onConfirm}
        confirmLabel="Cancel Booking"
        destructive
      />
    </Dialog>
  );
}
