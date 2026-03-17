/**
 * @file VenueFormDialog.tsx
 * @description Modal dialog for creating and editing saved venues with address,
 *   parking info, setup notes, and default travel fee.
 */

"use client";

import { useState } from "react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import type { VenueType } from "../actions";
import { VENUE_TYPE_LABELS } from "./helpers";
import type { VenueForm } from "./types";

export function VenueFormDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: VenueForm;
  onSave: (form: VenueForm) => void;
}) {
  const [form, setForm] = useState<VenueForm>(initial);
  const set =
    (field: keyof VenueForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.name ? "Edit Venue" : "New Venue"}
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Venue name" required>
          <Input
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. Valley Fair Pop-up, Main Studio"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.venueType} onChange={set("venueType")}>
              {(Object.entries(VENUE_TYPE_LABELS) as [VenueType, string][]).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default travel fee ($)" hint="Optional">
            <Input
              type="number"
              value={form.travelFee}
              onChange={set("travelFee")}
              placeholder="0"
              min={0}
            />
          </Field>
        </div>

        <Field label="Address">
          <Input
            value={form.address}
            onChange={set("address")}
            placeholder="Full street address for navigation"
          />
        </Field>

        <Field label="Parking info" hint="Optional">
          <Input
            value={form.parkingInfo}
            onChange={set("parkingInfo")}
            placeholder="e.g. Lot B, level 2, free 2 hrs"
          />
        </Field>

        <Field label="Setup notes" hint="Optional">
          <Textarea
            value={form.setupNotes}
            onChange={set("setupNotes")}
            rows={2}
            placeholder="Power needs, table layout, load-in instructions…"
          />
        </Field>

        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (form.name.trim()) {
              onSave(form);
              onClose();
            }
          }}
          confirmLabel={initial.name ? "Save venue" : "Add venue"}
          disabled={!form.name.trim()}
        />
      </div>
    </Dialog>
  );
}
