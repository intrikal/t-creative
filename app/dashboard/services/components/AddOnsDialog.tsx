"use client";

/**
 * AddOnsDialog.tsx — Manage add-ons for a specific service.
 *
 * Displays all add-ons belonging to a service, and provides inline create/edit
 * and delete controls. The dialog fetches add-ons on mount via `getAddOns` and
 * maintains its own local list for optimistic updates.
 *
 * ## Loading strategy
 * There is intentionally no loading spinner — add-ons appear as soon as the
 * `useEffect` fetch resolves, which is typically instantaneous on localhost and
 * fast on production. The list starts empty and populates in the background,
 * preventing a flicker or "Loading…" state.
 *
 * ## Inline form
 * Instead of a nested dialog, the create/edit form renders inline within the
 * same dialog pane. This avoids z-index layering issues and keeps the interaction
 * within a single focus context for accessibility.
 */

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Dialog, Field, Input, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  getAddOns,
  createAddOn,
  updateAddOn,
  deleteAddOn,
  toggleAddOnActive,
} from "../addon-actions";
import type { AddOnRow, AddOnInput } from "../addon-actions";
import type { Service } from "../types";
import { Toggle } from "./Toggle";

/** Local form state for the inline add-on create/edit form. */
type AddOnFormState = { name: string; price: number; minutes: number };
const BLANK_ADDON: AddOnFormState = { name: "", price: 0, minutes: 0 };

/**
 * AddOnsDialog — manages optional add-ons for a parent service.
 *
 * @param service - The parent service whose add-ons are being managed.
 * @param onClose - Called when the user closes the dialog (Done button or backdrop).
 */
export function AddOnsDialog({ service, onClose }: { service: Service; onClose: () => void }) {
  const [addOns, setAddOns] = useState<AddOnRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<AddOnRow | null>(null);
  const [form, setForm] = useState<AddOnFormState>(BLANK_ADDON);
  const [saving, setSaving] = useState(false);

  // Fetch add-ons for this service when the dialog mounts.
  // The empty dependency array ensures this only runs once per dialog open.
  useEffect(() => {
    getAddOns(service.id).then(setAddOns);
  }, [service.id]);

  function openNew() {
    setEditTarget(null);
    setForm(BLANK_ADDON);
    setShowForm(true);
  }

  function openEdit(a: AddOnRow) {
    setEditTarget(a);
    setForm({ name: a.name, price: a.priceInCents / 100, minutes: a.additionalMinutes });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    const input: AddOnInput = {
      name: form.name.trim(),
      priceInCents: Math.round(form.price * 100),
      additionalMinutes: form.minutes,
    };
    try {
      if (editTarget) {
        const updated = await updateAddOn(editTarget.id, input);
        setAddOns((prev) => prev.map((a) => (a.id === editTarget.id ? updated : a)));
      } else {
        const created = await createAddOn(service.id, input);
        setAddOns((prev) => [...prev, created]);
      }
      setShowForm(false);
      setEditTarget(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await deleteAddOn(id);
    setAddOns((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleToggle(id: number, current: boolean) {
    await toggleAddOnActive(id, !current);
    setAddOns((prev) => prev.map((a) => (a.id === id ? { ...a, isActive: !current } : a)));
  }

  const canSave = form.name.trim().length > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Add-ons — ${service.name}`}
      description="Optional upgrades clients can select at booking."
      size="md"
    >
      <div className="space-y-2">
        {addOns.length === 0 && !showForm && (
          <p className="text-sm text-muted text-center py-4">No add-ons yet for this service.</p>
        )}

        {/* Existing add-ons list */}
        {addOns.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors",
              a.isActive
                ? "border-border bg-background"
                : "border-border/40 bg-surface/50 opacity-60",
            )}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
              <p className="text-xs text-muted mt-0.5">
                +${(a.priceInCents / 100).toFixed(0)}
                {a.additionalMinutes > 0 && ` · +${a.additionalMinutes}min`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => openEdit(a)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-foreground/8 transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(a.id)}
                className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <Toggle on={a.isActive} onChange={() => handleToggle(a.id, a.isActive)} />
            </div>
          </div>
        ))}

        {/* Inline create / edit form */}
        {showForm ? (
          <div className="border border-accent/30 bg-accent/3 rounded-xl p-3 space-y-3 mt-1">
            <p className="text-xs font-semibold text-foreground">
              {editTarget ? "Edit Add-on" : "New Add-on"}
            </p>
            <Field label="Name" required>
              <Input
                placeholder="e.g. Under-eye patches"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price ($)">
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Extra mins">
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={form.minutes}
                  onChange={(e) => setForm((p) => ({ ...p, minutes: Number(e.target.value) }))}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditTarget(null);
                }}
                className="flex-1 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave || saving}
                className="flex-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors"
              >
                {saving ? "Saving…" : editTarget ? "Save" : "Add"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={openNew}
            className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add add-on
          </button>
        )}
      </div>

      <DialogFooter onCancel={onClose} onConfirm={onClose} confirmLabel="Done" />
    </Dialog>
  );
}
