"use client";

/**
 * IntakeFormsTab — Admin UI for managing per-service intake form definitions.
 *
 * Provides a list of intake form definitions with inline field builder,
 * service assignment, and active toggle.
 */

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntakeFormField } from "@/db/schema";
import {
  createIntakeFormDefinition,
  updateIntakeFormFields,
  updateIntakeFormDefinition,
  deleteIntakeFormDefinition,
  toggleIntakeFormActive,
  type IntakeFormDefinitionRow,
} from "../intake-form-actions";

/* ------------------------------------------------------------------ */
/*  Types & constants                                                  */
/* ------------------------------------------------------------------ */

type ServiceOption = { id: number; name: string };

const FIELD_TYPE_LABELS: Record<IntakeFormField["type"], string> = {
  text: "Short text",
  textarea: "Long text",
  select: "Dropdown",
  multiselect: "Multi-select",
  checkbox: "Checkbox",
  date: "Date",
};

/* ------------------------------------------------------------------ */
/*  IntakeFormsTab                                                     */
/* ------------------------------------------------------------------ */

export function IntakeFormsTab({
  initialDefinitions,
  services,
}: {
  initialDefinitions: IntakeFormDefinitionRow[];
  services: ServiceOption[];
}) {
  const [definitions, setDefinitions] = useState(initialDefinitions);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  /* ── New form state ── */
  const [newName, setNewName] = useState("");
  const [newServiceId, setNewServiceId] = useState<number | null>(null);
  const [newDescription, setNewDescription] = useState("");
  const [newFields, setNewFields] = useState<IntakeFormField[]>([
    { id: crypto.randomUUID(), label: "", type: "text", required: true },
  ]);

  function resetNew() {
    setNewName("");
    setNewServiceId(null);
    setNewDescription("");
    setNewFields([
      { id: crypto.randomUUID(), label: "", type: "text", required: true },
    ]);
    setCreating(false);
  }

  async function handleCreate() {
    if (!newName.trim() || newFields.some((f) => !f.label.trim())) return;
    const row = await createIntakeFormDefinition({
      name: newName.trim(),
      serviceId: newServiceId,
      description: newDescription.trim() || undefined,
      fields: newFields.map((f) => ({ ...f, label: f.label.trim() })),
    });
    setDefinitions((prev) => [row, ...prev]);
    resetNew();
  }

  async function handleToggleActive(id: number) {
    const def = definitions.find((d) => d.id === id);
    if (!def) return;
    await toggleIntakeFormActive(id, !def.isActive);
    setDefinitions((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isActive: !d.isActive } : d)),
    );
  }

  async function handleDelete(id: number) {
    await deleteIntakeFormDefinition(id);
    setDefinitions((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Intake Forms</h2>
          <p className="text-xs text-muted mt-0.5">
            Custom intake forms shown to clients before booking. Assign to a service or leave global.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Intake Form
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Total</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{definitions.length}</p>
        </div>
        <div className="bg-background border border-border rounded-xl p-3">
          <p className="text-[10px] text-muted uppercase tracking-wide font-medium">Active</p>
          <p className="text-2xl font-semibold text-foreground mt-1">
            {definitions.filter((d) => d.isActive).length}
          </p>
        </div>
      </div>

      {/* Create form inline */}
      {creating && (
        <div className="bg-background border border-accent/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">New Intake Form</p>
          <input
            type="text"
            placeholder="Form name (e.g. Lash Intake)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          <select
            value={newServiceId ?? ""}
            onChange={(e) =>
              setNewServiceId(e.target.value ? Number(e.target.value) : null)
            }
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-accent/30"
          >
            <option value="">All services (global)</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Description (optional)"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/30 resize-none"
          />

          {/* Field builder */}
          <FieldBuilder fields={newFields} onChange={setNewFields} />

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={resetNew}
              className="px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || newFields.length === 0}
              className="px-4 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {definitions.length === 0 && !creating && (
        <p className="text-sm text-muted text-center py-10">
          No intake forms yet. Create one to collect info before appointments.
        </p>
      )}

      {/* Definition list */}
      <div className="space-y-2">
        {definitions.map((def) => {
          const expanded = expandedId === def.id;
          const serviceName =
            services.find((s) => s.id === def.serviceId)?.name ?? "All services";
          const fields = (def.fields ?? []) as IntakeFormField[];
          return (
            <DefinitionCard
              key={def.id}
              def={def}
              serviceName={serviceName}
              fields={fields}
              expanded={expanded}
              onToggleExpand={() =>
                setExpandedId(expanded ? null : def.id)
              }
              onToggleActive={() => handleToggleActive(def.id)}
              onDelete={() => handleDelete(def.id)}
              onFieldsSaved={(updated) =>
                setDefinitions((prev) =>
                  prev.map((d) =>
                    d.id === def.id
                      ? { ...d, fields: updated, version: d.version + 1 }
                      : d,
                  ),
                )
              }
            />
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DefinitionCard                                                     */
/* ------------------------------------------------------------------ */

function DefinitionCard({
  def,
  serviceName,
  fields,
  expanded,
  onToggleExpand,
  onToggleActive,
  onDelete,
  onFieldsSaved,
}: {
  def: IntakeFormDefinitionRow;
  serviceName: string;
  fields: IntakeFormField[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onFieldsSaved: (fields: IntakeFormField[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState<IntakeFormField[]>(fields);
  const [saving, setSaving] = useState(false);

  async function handleSaveFields() {
    setSaving(true);
    try {
      await updateIntakeFormFields({ id: def.id, fields: editFields });
      onFieldsSaved(editFields);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={cn(
        "bg-background border rounded-xl overflow-hidden transition-all",
        def.isActive ? "border-border" : "border-border/40 opacity-60",
      )}
    >
      {/* Header row */}
      <div
        className="group flex items-center gap-3 p-4 cursor-pointer hover:bg-foreground/3 transition-colors"
        onClick={onToggleExpand}
      >
        <ClipboardList className="w-4 h-4 text-muted shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground">{def.name}</p>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
              v{def.version}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted">
            <span>{serviceName}</span>
            <span>·</span>
            <span>{fields.length} fields</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive();
            }}
            className={cn(
              "relative w-8 h-4 rounded-full transition-colors",
              def.isActive ? "bg-accent" : "bg-border",
            )}
          >
            <div
              className={cn(
                "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                def.isActive ? "translate-x-4.5" : "translate-x-0.5",
              )}
            />
          </button>
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
        <div className="px-4 pb-4 border-t border-border/50 space-y-3">
          {def.description && (
            <p className="text-xs text-muted mt-3 leading-relaxed">
              {def.description}
            </p>
          )}

          {!editing ? (
            <>
              {/* Read-only field preview */}
              <div className="space-y-1.5 mt-3">
                {fields.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-surface/40 border border-border/50"
                  >
                    <span className="font-medium text-foreground flex-1">
                      {f.label}
                      {f.required && (
                        <span className="text-destructive ml-0.5">*</span>
                      )}
                    </span>
                    <span className="text-muted">
                      {FIELD_TYPE_LABELS[f.type]}
                    </span>
                    {f.options && f.options.length > 0 && (
                      <span className="text-muted/60">
                        ({f.options.length} options)
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => {
                    setEditFields(fields);
                    setEditing(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Fields
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/5 border border-destructive/20 rounded-lg hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            </>
          ) : (
            /* Inline field editor */
            <div className="mt-3 space-y-3">
              <FieldBuilder fields={editFields} onChange={setEditFields} />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setEditing(false)}
                  className="px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFields}
                  disabled={saving || editFields.length === 0}
                  className="px-4 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save Fields"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldBuilder — reusable inline field list editor                   */
/* ------------------------------------------------------------------ */

function FieldBuilder({
  fields,
  onChange,
}: {
  fields: IntakeFormField[];
  onChange: (fields: IntakeFormField[]) => void;
}) {
  function updateField(id: string, patch: Partial<IntakeFormField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function removeField(id: string) {
    onChange(fields.filter((f) => f.id !== id));
  }

  function addField() {
    onChange([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "text",
        required: false,
      },
    ]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted">Fields</p>
      {fields.map((field, idx) => (
        <div
          key={field.id}
          className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-surface/40"
        >
          <GripVertical className="w-3.5 h-3.5 text-muted/40 shrink-0 mt-2" />

          <div className="flex-1 space-y-2">
            <input
              type="text"
              placeholder="Field label"
              value={field.label}
              onChange={(e) => updateField(field.id, { label: e.target.value })}
              className="w-full text-sm text-foreground bg-transparent border-none outline-none placeholder:text-muted/60"
            />

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={field.type}
                onChange={(e) =>
                  updateField(field.id, {
                    type: e.target.value as IntakeFormField["type"],
                  })
                }
                className="text-xs text-muted bg-background border border-border rounded px-2 py-1 focus:outline-none"
              >
                {(
                  Object.keys(FIELD_TYPE_LABELS) as IntakeFormField["type"][]
                ).map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-1 text-xs text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    updateField(field.id, { required: e.target.checked })
                  }
                  className="accent-accent w-3 h-3"
                />
                Required
              </label>
            </div>

            {/* Options editor for select / multiselect */}
            {(field.type === "select" || field.type === "multiselect") && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted">
                  Options (one per line)
                </p>
                <textarea
                  value={(field.options ?? []).join("\n")}
                  onChange={(e) =>
                    updateField(field.id, {
                      options: e.target.value
                        .split("\n")
                        .filter((o) => o.trim()),
                    })
                  }
                  rows={3}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  className="w-full text-xs text-foreground bg-background border border-border rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
              </div>
            )}
          </div>

          <button
            onClick={() => removeField(field.id)}
            className="p-1 rounded text-muted hover:text-destructive hover:bg-destructive/8 transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <button
        onClick={addField}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Field
      </button>
    </div>
  );
}
