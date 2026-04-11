"use client";

/**
 * EditFieldsDialog — configure the ordered list of fields inside a client form.
 *
 * Fields are editable inline (label text, type, required flag) and reorderable
 * via drag-and-drop. The display order matches the array position — dragging a
 * field moves it within the array, and that order is persisted on save.
 *
 * Saving calls `updateFormFields` to persist the array to the `fields` JSONB column,
 * then fires `onSaved` so the parent can update its local ClientForm state.
 *
 * @param form    - The form being edited (used for title and to seed default fields).
 * @param onSaved - Called with the updated field list after a successful save.
 * @param onClose - Called to dismiss the dialog (cancel or after save).
 */

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { updateFormFields } from "../form-actions";
import { FIELD_TYPE_LABELS, DEFAULT_FIELDS } from "../types";
import type { ClientForm, FieldType, FormField } from "../types";

/** Props for a single draggable field row inside the sortable list. */
interface SortableFieldRowProps {
  field: FormField;
  index: number;
  onLabelChange: (id: number, label: string) => void;
  onTypeChange: (id: number, type: FieldType) => void;
  onToggleRequired: (id: number) => void;
  onRemove: (id: number) => void;
}

/** SortableFieldRow — a single draggable field row with a grab handle. */
function SortableFieldRow({
  field,
  index,
  onLabelChange,
  onTypeChange,
  onToggleRequired,
  onRemove,
}: SortableFieldRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging && {
      scale: "1.02",
      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
      zIndex: 50,
      position: "relative" as const,
    }),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40 group"
      aria-roledescription="sortable"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing p-0.5 rounded text-muted/40 hover:text-muted transition-colors shrink-0 touch-none"
        aria-label={`Reorder field: ${field.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      {/* Position number */}
      <span className="text-[10px] text-muted/50 tabular-nums w-4 shrink-0">{index + 1}</span>

      {/* Editable label text */}
      <input
        className="flex-1 text-sm text-foreground bg-transparent border-none outline-none min-w-0"
        value={field.label}
        onChange={(e) => onLabelChange(field.id, e.target.value)}
      />

      {/* Field type picker */}
      <select
        className="text-xs text-muted bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30 shrink-0"
        value={field.type}
        onChange={(e) => onTypeChange(field.id, e.target.value as FieldType)}
      >
        {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
          <option key={t} value={t}>
            {FIELD_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      {/* Required toggle */}
      <label className="flex items-center gap-1.5 text-xs text-muted shrink-0 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={field.required}
          onChange={() => onToggleRequired(field.id)}
          className="accent-accent w-3.5 h-3.5"
        />
        Req
      </label>

      {/* Remove field */}
      <button
        onClick={() => onRemove(field.id)}
        className="p-1 rounded-lg text-muted hover:text-destructive hover:bg-destructive/8 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        title="Remove field"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function EditFieldsDialog({
  form,
  onSaved,
  onClose,
}: {
  form: ClientForm;
  onSaved: (fields: FormField[]) => void;
  onClose: () => void;
}) {
  /**
   * Field list for the form being edited. Seeded from saved fields if they
   * exist, otherwise from type-appropriate defaults so admins don't start
   * from scratch.
   */
  const [fields, setFields] = useState<FormField[]>(form.fields ?? DEFAULT_FIELDS[form.type] ?? []);
  /** Whether the save action is in flight. */
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    setFields(arrayMove(fields, oldIndex, newIndex));
  }

  function handleLabelChange(id: number, label: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, label } : f)));
  }

  function handleTypeChange(id: number, type: FieldType) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, type } : f)));
  }

  /** toggleRequired — flips the required flag on a field using .map() to find it by ID. */
  function toggleRequired(id: number) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, required: !f.required } : f)));
  }

  /** removeField — filters out a field by ID from the local array. */
  function removeField(id: number) {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }

  /**
   * addField — appends a new blank field with a Date.now() ID.
   * Date.now() is sufficient as a client-side ID because fields are only
   * identified by array position in the JSONB column, not by a DB PK.
   */
  function addField() {
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field, idx) => (
              <SortableFieldRow
                key={field.id}
                field={field}
                index={idx}
                onLabelChange={handleLabelChange}
                onTypeChange={handleTypeChange}
                onToggleRequired={toggleRequired}
                onRemove={removeField}
              />
            ))}
          </SortableContext>
        </DndContext>

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
