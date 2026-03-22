"use client";

/**
 * FormsTab.tsx — Client forms & waivers management panel for the Services dashboard.
 *
 * The full tab panel with the accordion-style form list. Dialog components
 * are split into separate files:
 * - `EditFieldsDialog` — modal for configuring a form's field list (stored as JSONB).
 * - `NewFormDialog`    — modal for creating a new form (name, type, applies-to, required).
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
import { cn } from "@/lib/utils";
import type { FormRow, FormInput } from "@/lib/types/services.types";
import { createForm, deleteForm, toggleFormActive } from "../form-actions";
import { FORM_TYPE_CONFIG, dbToForm } from "../types";
import type { ClientForm, NewFormData } from "../types";
import { Toggle } from "./Toggle";
import { EditFieldsDialog } from "./EditFieldsDialog";
import { NewFormDialog } from "./NewFormDialog";

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
  /** Local forms list, initialized by mapping DB rows to UI-friendly objects via dbToForm. */
  const [forms, setForms] = useState<ClientForm[]>(() => initialForms.map(dbToForm));
  /** ID of the currently expanded accordion row (null = all collapsed). */
  const [expandedId, setExpandedId] = useState<number | null>(null);
  /** Whether the NewFormDialog is open. */
  const [newFormOpen, setNewFormOpen] = useState(false);
  /** The form whose fields are being edited in EditFieldsDialog (null = closed). */
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

  /** Number of active forms — displayed in the stat card. */
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
