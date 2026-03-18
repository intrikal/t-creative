"use client";

/**
 * EditFieldsDialog — configure the ordered list of fields inside a client form.
 *
 * Fields are editable inline (label text, type, required flag) and can be
 * reordered by drag-and-drop in a future phase. For now, fields are ordered
 * by their position in the array, which matches the order they were added.
 *
 * Saving calls `updateFormFields` to persist the array to the `fields` JSONB column,
 * then fires `onSaved` so the parent can update its local ClientForm state.
 *
 * @param form    - The form being edited (used for title and to seed default fields).
 * @param onSaved - Called with the updated field list after a successful save.
 * @param onClose - Called to dismiss the dialog (cancel or after save).
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { updateFormFields } from "../form-actions";
import { FIELD_TYPE_LABELS, DEFAULT_FIELDS } from "../types";
import type { ClientForm, FieldType, FormField } from "../types";

export function EditFieldsDialog({
  form,
  onSaved,
  onClose,
}: {
  form: ClientForm;
  onSaved: (fields: FormField[]) => void;
  onClose: () => void;
}) {
  // Seed from saved fields if they exist, otherwise use type-appropriate defaults.
  const [fields, setFields] = useState<FormField[]>(form.fields ?? DEFAULT_FIELDS[form.type] ?? []);
  const [saving, setSaving] = useState(false);

  function toggleRequired(id: number) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: !f.required } : f)));
  }

  function removeField(id: number) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  function addField() {
    // Use Date.now() as a stable-enough client-side ID for new fields.
    setFields((prev) => [
      ...prev,
      { id: Date.now(), label: "New Field", type: "text", required: false },
    ]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateFormFields(form.id, fields);
      onSaved(fields);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit Fields — ${form.name}`}
      description="Configure the fields clients see when filling out this form."
      size="lg"
    >
      <div className="space-y-2">
        {fields.map((field, idx) => (
          <div
            key={field.id}
            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 group"
          >
            {/* Position number — read-only indicator */}
            <span className="text-[10px] text-muted/50 tabular-nums w-4 shrink-0">{idx + 1}</span>

            {/* Editable label text */}
            <input
              className="flex-1 text-sm text-foreground bg-transparent border-none outline-none min-w-0"
              value={field.label}
              onChange={(e) =>
                setFields((prev) =>
                  prev.map((f) => (f.id === field.id ? { ...f, label: e.target.value } : f)),
                )
              }
            />

            {/* Field type picker */}
            <select
              className="text-xs text-muted bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 shrink-0"
              value={field.type}
              onChange={(e) =>
                setFields((prev) =>
                  prev.map((f) =>
                    f.id === field.id ? { ...f, type: e.target.value as FieldType } : f,
                  ),
                )
              }
            >
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>

            {/* Required toggle — compact checkbox + label */}
            <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={field.required}
                onChange={() => toggleRequired(field.id)}
                className="accent-accent w-3.5 h-3.5"
              />
              Req
            </label>

            {/* Remove field — only visible on row hover */}
            <button
              onClick={() => removeField(field.id)}
              className="p-1 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              title="Remove field"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {/* Add field button */}
        <button
          onClick={addField}
          className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Field
        </button>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : "Save Fields"}
        disabled={saving}
      />
    </Dialog>
  );
}
