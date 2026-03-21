"use client";

/**
 * NewFormDialog — creates a new client form (name, type, applies-to scope, required flag).
 *
 * The dialog does NOT configure form fields — that is handled by `EditFieldsDialog`
 * after creation. This two-step approach matches the mental model: first define
 * what the form is, then configure what it asks.
 *
 * @param open    - Controls dialog visibility.
 * @param onClose - Called on cancel or after successful save.
 * @param onSave  - Called with the validated form metadata; parent persists and updates state.
 */

import { useState } from "react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { APPLIES_TO_OPTIONS } from "../types";
import type { FormType, NewFormData } from "../types";

export function NewFormDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (f: NewFormData) => void;
}) {
  const [form, setForm] = useState<NewFormData>({
    name: "",
    type: "intake",
    appliesTo: ["All"],
    description: "",
    required: false,
  });

  if (!open) return null;

  /**
   * toggleAppliesTo — toggles a service category in the "applies to" multi-select.
   * "All" is mutually exclusive: selecting it clears specific categories.
   * Selecting a specific category removes "All" and toggles the category.
   * Uses .filter() to remove conflicting values, then spread to add the new one.
   */
  function toggleAppliesTo(val: string) {
    setForm((prev) => {
      if (val === "All") return { ...prev, appliesTo: ["All"] };
      const without = prev.appliesTo.filter((a) => a !== "All" && a !== val);
      return { ...prev, appliesTo: prev.appliesTo.includes(val) ? without : [...without, val] };
    });
  }

  const canSave = form.name.trim() && form.appliesTo.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Form"
      description="Create a new intake form, waiver, or consent form."
      size="md"
    >
      <div className="space-y-4">
        <Field label="Form Name" required>
          <Input
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. New Client Intake"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Form Type" required>
            <Select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FormType }))}
            >
              <option value="intake">Intake</option>
              <option value="waiver">Waiver</option>
              <option value="consent">Consent</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>

          <Field label="Applies To" required>
            <div className="flex flex-wrap gap-1 mt-1">
              {APPLIES_TO_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggleAppliesTo(opt)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                    form.appliesTo.includes(opt)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface border-border text-muted hover:text-foreground",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="Description">
          <Textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="What does this form collect?"
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.required}
            onChange={(e) => setForm((p) => ({ ...p, required: e.target.checked }))}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-foreground">Required before appointment</span>
        </label>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (canSave) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel="Create Form"
        disabled={!canSave}
      />
    </Dialog>
  );
}
