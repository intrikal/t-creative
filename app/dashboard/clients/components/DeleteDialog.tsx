/**
 * Destructive confirmation dialog for permanently deleting a client.
 * Warns that bookings and loyalty history will also be removed.
 *
 * Parent: app/dashboard/clients/ClientsPage.tsx (via ClientCard actions)
 */
"use client";

import { Dialog, DialogFooter } from "@/components/ui/dialog";
import type { Client } from "../ClientsPage";

export function DeleteDialog({
  target,
  onConfirm,
  onClose,
}: {
  target: Client | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Delete Client"
      description={
        target
          ? `Permanently delete ${target.name}? This will also remove their bookings and loyalty history. This cannot be undone.`
          : ""
      }
    >
      <DialogFooter onCancel={onClose} onConfirm={onConfirm} confirmLabel="Delete" destructive />
    </Dialog>
  );
}
