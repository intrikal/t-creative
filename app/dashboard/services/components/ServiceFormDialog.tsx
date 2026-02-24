"use client";

/**
 * ServiceFormDialog.tsx — Add / Edit service modal for the Services dashboard.
 *
 * Renders a controlled dialog form for creating or updating a service in the
 * `services` table. The dialog is "uncontrolled on mount" — it reads `initial`
 * once when `open` transitions to `true` and does not sync to prop changes
 * after that, which keeps form edits stable if the parent re-renders.
 *
 * ## Fields
 * - Name (required)
 * - Category (required; "training" is intentionally excluded from the picker
 *   because training courses are managed as a separate product type)
 * - Description
 * - Duration (minutes; 0 = project-based / no fixed duration)
 * - Price ($)
 * - Deposit ($; 0 = no deposit)
 * - Active toggle
 *
 * ## Parent responsibility
 * The parent (`ServicesPage`) owns the optimistic state update. After `onSave`
 * fires, the parent calls `createService` / `updateService` and patches its
 * local `services` array — no re-fetch required.
 */

import { useState } from "react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { CAT_CONFIG, BLANK_SERVICE_FORM } from "../types";
import type { Category, ServiceFormData } from "../types";
import { Toggle } from "./Toggle";

/**
 * ServiceFormDialog — modal form for adding or editing a service.
 *
 * @param open    - Whether the dialog is visible.
 * @param onClose - Called when the user cancels or closes the dialog.
 * @param initial - Pre-populated form values for edit mode. Pass `null` for add mode.
 * @param onSave  - Called with the validated form data when the user confirms.
 *                  The parent is responsible for persisting and updating state.
 */
export function ServiceFormDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: ServiceFormData | null;
  onSave: (data: ServiceFormData) => void;
}) {
  const [form, setForm] = useState<ServiceFormData>(initial ?? BLANK_SERVICE_FORM);

  // Early return keeps the component out of the DOM when closed (saves memory, resets state).
  if (!open) return null;

  function set<K extends keyof ServiceFormData>(key: K, val: ServiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  const isEdit = !!initial;
  const canSave = form.name.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Service" : "Add Service"}
      description={isEdit ? "Update service details." : "Add a new service to your menu."}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Service Name" required>
            <Input
              placeholder="e.g. Classic Full Set"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>
          <Field label="Category" required>
            <Select
              value={form.category}
              onChange={(e) => set("category", e.target.value as Category)}
            >
              {/* Training is excluded — courses are not standard bookable services */}
              {(Object.keys(CAT_CONFIG) as Category[])
                .filter((c) => c !== "training")
                .map((c) => (
                  <option key={c} value={c}>
                    {CAT_CONFIG[c].label}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={2}
            placeholder="Brief description shown to clients…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Duration (min)" hint="0 = project-based">
            <Input
              type="number"
              min={0}
              step={15}
              value={form.durationMin}
              onChange={(e) => set("durationMin", Number(e.target.value))}
            />
          </Field>
          <Field label="Price ($)" required>
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </Field>
          <Field label="Deposit ($)" hint="0 = no deposit required">
            <Input
              type="number"
              min={0}
              value={form.depositDollars}
              onChange={(e) => set("depositDollars", Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between py-1 border-t border-border/50">
          <div>
            <p className="text-sm font-medium text-foreground">Active</p>
            <p className="text-xs text-muted mt-0.5">
              Inactive services won&apos;t appear on your booking page
            </p>
          </div>
          <Toggle on={form.active} onChange={(v) => set("active", v)} />
        </div>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (canSave) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel={isEdit ? "Save Changes" : "Add Service"}
        disabled={!canSave}
      />
    </Dialog>
  );
}
