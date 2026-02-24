"use client";

/**
 * FormsTab.tsx — Client forms & waivers management panel for the Services dashboard.
 *
 * Contains three components:
 * - `EditFieldsDialog` — modal for configuring a form's field list (stored as JSONB).
 * - `NewFormDialog`    — modal for creating a new form (name, type, applies-to, required).
 * - `FormsTab`         — the full tab panel with the accordion-style form list.
 *
 * ## Data flow
 * `FormsTab` receives initial DB rows (`FormRow[]`) and converts them to UI-friendly
 * `ClientForm[]` objects on first render. All mutations call server actions then
 * patch local state for optimistic UI.
 *
 * ## Fields JSONB pattern
 * Each form's fields are stored in `client_forms.fields` as a JSONB array.
 * Drizzle infers this as `unknown`. We cast it to `FormField[] | null` in `dbToForm`
 * and maintain the typed list in component state. When saved, the array is passed
 * as-is to `updateFormFields` (which accepts `unknown`), so the cast is safe.
 *
 * ## Default fields
 * When a form's `fields` column is null (just created), `EditFieldsDialog` seeds the
 * list from `DEFAULT_FIELDS[form.type]`. This ensures a sensible starting point
 * without requiring the admin to build from scratch.
 */

import { useState } from "react";
import { Plus, Pencil, Trash2, FileText, Tag, ChevronDown, AlertCircle } from "lucide-react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { FormRow, FormInput } from "../form-actions";
import { createForm, deleteForm, toggleFormActive, updateFormFields } from "../form-actions";
import {
  FORM_TYPE_CONFIG,
  FIELD_TYPE_LABELS,
  DEFAULT_FIELDS,
  APPLIES_TO_OPTIONS,
  dbToForm,
} from "../types";
import type { ClientForm, FormType, FieldType, FormField, NewFormData } from "../types";
import { Toggle } from "./Toggle";

/* ------------------------------------------------------------------ */
/*  EditFieldsDialog                                                   */
/* ------------------------------------------------------------------ */

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
function EditFieldsDialog({
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

/* ------------------------------------------------------------------ */
/*  NewFormDialog                                                      */
/* ------------------------------------------------------------------ */

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
function NewFormDialog({
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

  function toggleAppliesTo(val: string) {
    setForm((prev) => {
      // "All" is mutually exclusive with specific categories.
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

/* ------------------------------------------------------------------ */
/*  FormsTab                                                           */
/* ------------------------------------------------------------------ */

/**
 * FormsTab — accordion-style list of client forms with CRUD controls.
 *
 * Each form row expands to reveal description, "Edit Fields", and "Delete" actions.
 * The active toggle is visible in the collapsed row for quick enable/disable without
 * needing to expand the accordion.
 *
 * @param initialForms - Server-fetched form rows to hydrate the initial list.
 */
export function FormsTab({ initialForms }: { initialForms: FormRow[] }) {
  const [forms, setForms] = useState<ClientForm[]>(() => initialForms.map(dbToForm));
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [editFieldsTarget, setEditFieldsTarget] = useState<ClientForm | null>(null);

  async function handleToggleActive(id: number) {
    const f = forms.find((x) => x.id === id);
    if (!f) return;
    await toggleFormActive(id, !f.active);
    setForms((prev) => prev.map((x) => (x.id === id ? { ...x, active: !x.active } : x)));
  }

  async function handleNewForm(data: NewFormData) {
    const input: FormInput = {
      name: data.name,
      type: data.type,
      description: data.description,
      appliesTo: data.appliesTo,
      required: data.required,
      isActive: true,
    };
    const row = await createForm(input);
    setForms((prev) => [...prev, dbToForm(row)]);
  }

  async function handleDelete(id: number) {
    await deleteForm(id);
    setForms((prev) => prev.filter((f) => f.id !== id));
  }

  const activeCount = forms.filter((f) => f.active).length;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Forms & Waivers</h2>
          <p className="text-xs text-muted mt-0.5">
            Intake forms, consent forms, and liability waivers sent before appointments.
          </p>
        </div>
        <button
          onClick={() => setNewFormOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Form
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Total Forms</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{forms.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Active</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{activeCount}</p>
        </div>
      </div>

      {/* Empty state */}
      {forms.length === 0 && (
        <p className="text-sm text-muted text-center py-10">
          No forms yet. Create one to send before appointments.
        </p>
      )}

      {/* Accordion-style form list */}
      <div className="space-y-2">
        {forms.map((f) => {
          const cfg = FORM_TYPE_CONFIG[f.type];
          const expanded = expandedId === f.id;
          return (
            <div
              key={f.id}
              className={cn(
                "bg-background border rounded-xl overflow-hidden transition-all",
                f.active ? "border-border" : "border-border/40 opacity-60",
              )}
            >
              {/* Collapsed row — clickable to expand */}
              <div
                className="group flex items-center gap-3 p-4 cursor-pointer hover:bg-foreground/3 transition-colors"
                onClick={() => setExpandedId(expanded ? null : f.id)}
              >
                <FileText className="w-4 h-4 text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{f.name}</p>
                    {/* Type badge */}
                    <span
                      className={cn(
                        "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                        cfg.color,
                        cfg.bg,
                      )}
                    >
                      {cfg.label}
                    </span>
                    {/* Required indicator */}
                    {f.required && (
                      <span className="flex items-center gap-0.5 text-[10px] text-[#c4907a]">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {f.appliesTo.map((a) => (
                      <span key={a} className="text-[10px] text-muted">
                        {a}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted">·</span>
                    <span className="text-[10px] text-muted">Updated {f.lastUpdated}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Edit pencil — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditFieldsTarget(f);
                      }}
                      className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                      title="Edit fields"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <Toggle on={f.active} onChange={() => handleToggleActive(f.id)} />
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 text-muted transition-transform",
                      expanded && "rotate-180",
                    )}
                  />
                </div>
              </div>

              {/* Expanded panel */}
              {expanded && (
                <div className="px-4 pb-4 border-t border-border/50">
                  <p className="text-xs text-muted mt-3 leading-relaxed">{f.description}</p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button
                      onClick={() => setEditFieldsTarget(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Edit Fields
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/5 border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dialogs */}
      <NewFormDialog
        open={newFormOpen}
        onClose={() => setNewFormOpen(false)}
        onSave={handleNewForm}
      />
      {editFieldsTarget && (
        <EditFieldsDialog
          form={editFieldsTarget}
          onSaved={(fields) =>
            setForms((prev) =>
              prev.map((f) => (f.id === editFieldsTarget.id ? { ...f, fields } : f)),
            )
          }
          onClose={() => setEditFieldsTarget(null)}
        />
      )}
    </div>
  );
}
