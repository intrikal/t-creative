"use client";

import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { Booking } from "../BookingsPage";

export function DeleteDialog({
  target,
  onConfirm,
  onClose,
}: {
  target: Booking | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Delete Booking"
      description={
        target
          ? `Permanently delete ${target.service} for ${target.client}? This cannot be undone.`
          : ""
      }
    >
      <DialogFooter onCancel={onClose} onConfirm={onConfirm} confirmLabel="Delete" destructive />
    </Dialog>
  );
}
