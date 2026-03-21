/**
 * Service Categories tab — CRUD for the `service_categories` lookup table.
 *
 * Displays a sortable list of categories with inline editing. Admin can
 * add, edit, reorder, toggle active/inactive, and delete categories.
 *
 * @module settings/components/ServiceCategoriesTab
 */
"use client";

import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ServiceCategoryRow } from "../service-categories-actions";
import { deleteServiceCategory, saveServiceCategory } from "../service-categories-actions";
import { INPUT_CLASS, StatefulSaveButton, Toggle } from "./shared";

type EditingCategory = Omit<ServiceCategoryRow, "id"> & { id?: number };

const EMPTY: EditingCategory = { name: "", slug: "", displayOrder: 0, isActive: true };

export function ServiceCategoriesTab({ initial }: { initial: ServiceCategoryRow[] }) {
  /** Live list of categories, patched optimistically after CRUD operations. */
  const [categories, setCategories] = useState<ServiceCategoryRow[]>(initial);
  /** The category currently being created/edited (null = form hidden). */
  const [editing, setEditing] = useState<EditingCategory | null>(null);
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);
  /** Briefly true after a successful save to show "Saved!" feedback. */
  const [saved, setSaved] = useState(false);
  /** ID of the category currently being deleted (to show loading state). */
  const [deleting, setDeleting] = useState<number | null>(null);

  /** Populate the edit form with an existing category's data. */
  function startEdit(cat: ServiceCategoryRow) {
    setEditing({ ...cat });
  }

  /**
   * startAdd — opens the form for a new category.
   * Auto-assigns displayOrder to max+1 so the new category sorts last.
   * Uses .reduce() to find the highest existing order value.
   */
  function startAdd() {
    const maxOrder = categories.reduce((max, c) => Math.max(max, c.displayOrder), 0);
    setEditing({ ...EMPTY, displayOrder: maxOrder + 1 });
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await saveServiceCategory(editing);

      // Optimistic update
      if (editing.id) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...editing, id: editing.id! } : c)),
        );
      } else {
        // Refetch to get the assigned id
        const { getServiceCategories } = await import("../service-categories-actions");
        setCategories(await getServiceCategories());
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await deleteServiceCategory(id);
      setCategories((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  // Sort categories by displayOrder for consistent rendering.
  // Spread into a new array to avoid mutating the state array.
  const sorted = [...categories].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Service Categories</h2>
          <p className="text-xs text-muted mt-0.5">
            Manage the categories used to organize services across your site
          </p>
        </div>
        <button
          onClick={startAdd}
          disabled={!!editing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>

      {/* Editing form */}
      {editing && (
        <Card>
          <CardContent className="px-5 pb-5 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                {editing.id ? "Edit Category" : "New Category"}
              </p>
              <button
                onClick={() => setEditing(null)}
                className="p-1 text-muted hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Name</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing((prev) => prev && { ...prev, name: e.target.value })}
                  placeholder="e.g. Lash Extensions"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Slug</label>
                <input
                  type="text"
                  value={editing.slug}
                  onChange={(e) =>
                    setEditing(
                      (prev) =>
                        prev && {
                          ...prev,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                        },
                    )
                  }
                  placeholder="e.g. lash"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Display Order</label>
                <input
                  type="number"
                  value={editing.displayOrder}
                  onChange={(e) =>
                    setEditing(
                      (prev) =>
                        prev && { ...prev, displayOrder: parseInt(e.target.value, 10) || 0 },
                    )
                  }
                  className={cn(INPUT_CLASS, "max-w-[120px]")}
                />
              </div>
              <div className="flex items-end pb-1">
                <div className="flex items-center gap-2">
                  <Toggle
                    on={editing.isActive}
                    onChange={(v) => setEditing((prev) => prev && { ...prev, isActive: v })}
                    aria-label="Active"
                  />
                  <span className="text-xs text-muted">Active</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <StatefulSaveButton
                label={editing.id ? "Update" : "Create"}
                saving={saving}
                saved={saved}
                onSave={handleSave}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category list */}
      <Card>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted">
              No categories yet. Click &ldquo;Add&rdquo; to create one.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sorted.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center gap-3 px-5 py-3 group hover:bg-foreground/[0.02] transition-colors"
                >
                  <GripVertical className="w-4 h-4 text-muted/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{cat.name}</span>
                    <span className="ml-2 text-xs text-muted font-mono">{cat.slug}</span>
                  </div>
                  <span className="text-xs text-muted tabular-nums">#{cat.displayOrder}</span>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded-full",
                      cat.isActive
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-foreground/5 text-muted",
                    )}
                  >
                    {cat.isActive ? "Active" : "Inactive"}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(cat)}
                      disabled={!!editing}
                      className="p-1.5 rounded-md text-muted hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={deleting === cat.id}
                      className="p-1.5 rounded-md text-muted hover:text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
