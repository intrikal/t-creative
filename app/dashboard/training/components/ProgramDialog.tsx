/**
 * ProgramDialog — modal for creating or editing a training program.
 *
 * Used by the admin Training dashboard. Each field maps to useState so the
 * form is fully controlled. The dialog key includes `String(open)` so React
 * re-mounts the form inputs when the dialog re-opens, resetting to `initial`.
 *
 * ## Validation
 * Name must be non-empty and price must be provided. Defaults: 1 session,
 * 6 max spots, waitlist open.
 *
 * @module training/components/ProgramDialog
 */
"use client";

import { useState } from "react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import type { ProgramRow, ProgramType, ProgramFormData } from "@/lib/types/training.types";

export function ProgramDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: ProgramRow | null;
  onSave: (p: ProgramFormData) => void;
  saving: boolean;
}) {
  /** Program name (required). */
  const [name, setName] = useState(initial?.name ?? "");
  /** Program type (lash, jewelry, business, crochet). */
  const [type, setType] = useState<ProgramType>(initial?.type ?? "lash");
  /** Program price in dollars (stored as string for input binding). */
  const [price, setPrice] = useState(String(initial?.price ?? ""));
  /** Number of sessions included (stored as string for input binding). */
  const [sessions, setSessions] = useState(String(initial?.sessions ?? ""));
  /** Free-text program description. */
  const [description, setDescription] = useState(initial?.description ?? "");
  /** Whether the program is active (visible to clients). */
  const [active, setActive] = useState(initial?.active ?? true);
  /** Maximum enrollment capacity. */
  const [maxSpots, setMaxSpots] = useState(String(initial?.maxSpots ?? "6"));
  /** Whether the waitlist is accepting new sign-ups. */
  const [waitlistOpen, setWaitlistOpen] = useState(initial?.waitlistOpen ?? true);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit Program" : "New Program"}
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Program name" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Volume Lash Masterclass"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={type} onChange={(e) => setType(e.target.value as ProgramType)}>
              <option value="lash">Lash</option>
              <option value="jewelry">Jewelry</option>
              <option value="business">Business</option>
              <option value="crochet">Crochet</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={active ? "true" : "false"}
              onChange={(e) => setActive(e.target.value === "true")}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price ($)" required>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="800"
              min={0}
            />
          </Field>
          <Field label="Sessions" required>
            <Input
              type="number"
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
              placeholder="4"
              min={1}
            />
          </Field>
          <Field label="Max spots">
            <Input
              type="number"
              value={maxSpots}
              onChange={(e) => setMaxSpots(e.target.value)}
              placeholder="6"
              min={1}
            />
          </Field>
        </div>
        <Field label="Waitlist">
          <Select
            value={waitlistOpen ? "true" : "false"}
            onChange={(e) => setWaitlistOpen(e.target.value === "true")}
          >
            <option value="true">Open — accepting waitlist</option>
            <option value="false">Closed — no new waitlist sign-ups</option>
          </Select>
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What does this program cover?"
          />
        </Field>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!name.trim()) return;
            onSave({
              name: name.trim(),
              type,
              price: Number(price) || 0,
              sessions: Number(sessions) || 1,
              description,
              active,
              maxSpots: Number(maxSpots) || 6,
              waitlistOpen,
            });
          }}
          confirmLabel={initial ? "Save changes" : "Add program"}
          disabled={!name.trim() || !price || saving}
        />
      </div>
    </Dialog>
  );
}
