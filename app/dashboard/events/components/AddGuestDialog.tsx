/**
 * @file AddGuestDialog.tsx
 * @description Small modal dialog for adding a guest (name, service, paid status) to an event.
 */

"use client";

import { useState } from "react";
import { Dialog, Field, Input, DialogFooter } from "@/components/ui/dialog";

export function AddGuestDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (guest: { name: string; service: string; paid: boolean }) => void;
}) {
  /** Guest's full name (required). */
  const [name, setName] = useState("");
  /** Service the guest is receiving (optional, e.g. "Volume Lashes"). */
  const [service, setService] = useState("");
  /** Whether the guest has already paid. */
  const [paid, setPaid] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="Add Guest" size="sm">
      <div className="space-y-4" key={String(open)}>
        <Field label="Guest name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </Field>
        <Field label="Service">
          <Input
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. Volume Lashes"
          />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-foreground">Marked as paid</span>
        </label>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (name.trim()) {
              onAdd({ name, service, paid });
              onClose();
            }
          }}
          confirmLabel="Add guest"
          disabled={!name.trim()}
        />
      </div>
    </Dialog>
  );
}
