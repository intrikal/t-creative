"use client";

import { useState } from "react";
import { Dialog, Field, Input, Select, DialogFooter } from "@/components/ui/dialog";
import type { SupplyForm } from "./helpers";

export function SupplyDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: SupplyForm;
  onSave: (form: SupplyForm) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<SupplyForm>(initial);
  const set =
    (field: keyof SupplyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  const valid = form.name.trim() !== "" && form.unit.trim() !== "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.name ? "Edit Supply" : "Add Supply"}
      description="Track a supply used in your services."
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Item name" required>
          <Input
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. Lash Glue (Sensitive)"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" required>
            <Select value={form.category} onChange={set("category")}>
              <option value="Lash">Lash</option>
              <option value="Jewelry">Jewelry</option>
              <option value="Aftercare">Aftercare</option>
              <option value="Other">Other</option>
            </Select>
          </Field>
          <Field label="Unit" required hint="e.g. bottles, trays, rolls">
            <Input value={form.unit} onChange={set("unit")} placeholder="e.g. bottles" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Current stock">
            <Input
              type="number"
              value={form.stock}
              onChange={set("stock")}
              placeholder="0"
              min={0}
            />
          </Field>
          <Field label="Reorder point" hint="Alert when stock hits this level">
            <Input
              type="number"
              value={form.reorder}
              onChange={set("reorder")}
              placeholder="e.g. 3"
              min={0}
            />
          </Field>
        </div>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => onSave(form)}
          confirmLabel={saving ? "Saving…" : initial.name ? "Save changes" : "Add supply"}
          disabled={!valid || saving}
        />
      </div>
    </Dialog>
  );
}
