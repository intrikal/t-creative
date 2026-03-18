"use client";

/** PlanDialog — create or edit a Lash Club membership plan. */

import { useState, useTransition } from "react";
import { Dialog, DialogFooter, Field, Input, Textarea } from "@/components/ui/dialog";
import { createMembershipPlan, updateMembershipPlan, type MembershipPlan } from "../actions";

type PlanForm = {
  name: string;
  slug: string;
  description: string;
  pricePerMonth: string;
  fillsPerCycle: string;
  productDiscountPercent: string;
  perks: string; // newline-separated
};

const EMPTY_PLAN_FORM: PlanForm = {
  name: "",
  slug: "",
  description: "",
  pricePerMonth: "",
  fillsPerCycle: "1",
  productDiscountPercent: "10",
  perks: "",
};

export function PlanDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: MembershipPlan | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<PlanForm>(
    editing
      ? {
          name: editing.name,
          slug: editing.slug,
          description: editing.description ?? "",
          pricePerMonth: String(editing.priceInCents / 100),
          fillsPerCycle: String(editing.fillsPerCycle),
          productDiscountPercent: String(editing.productDiscountPercent),
          perks: editing.perks.join("\n"),
        }
      : EMPTY_PLAN_FORM,
  );
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PlanForm>(key: K, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  // Auto-generate slug from name when creating
  function onNameChange(val: string) {
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: editing
        ? prev.slug
        : val
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
    }));
  }

  const priceInCents = Math.round((Number(form.pricePerMonth) || 0) * 100);
  const perks = form.perks
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const valid =
    form.name.trim() !== "" &&
    form.slug.trim() !== "" &&
    priceInCents > 0 &&
    Number(form.fillsPerCycle) >= 1;

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    try {
      startTransition(async () => {
        const payload = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          priceInCents,
          fillsPerCycle: Number(form.fillsPerCycle),
          productDiscountPercent: Number(form.productDiscountPercent) || 0,
          perks,
        };
        if (editing) {
          await updateMembershipPlan(editing.id, payload);
        } else {
          await createMembershipPlan({ ...payload, slug: form.slug.trim() });
        }
        onClose();
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Edit: ${editing.name}` : "New Membership Plan"}
      description={
        editing
          ? "Update this plan's details. Existing subscribers keep current entitlements until next renewal."
          : "Define a new Lash Club tier. Clients will be enrolled by admin — there's no self-serve checkout yet."
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan name" required>
            <Input
              placeholder="Lash Club"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </Field>
          <Field label="Slug" required hint="URL-safe identifier">
            <Input
              placeholder="lash-club"
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              disabled={!!editing}
            />
          </Field>
        </div>
        <Field label="Description">
          <Input
            placeholder="One fill per month + 10% off products"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price / month ($)" required>
            <Input
              type="number"
              min={0}
              step={5}
              placeholder="89"
              value={form.pricePerMonth}
              onChange={(e) => set("pricePerMonth", e.target.value)}
            />
          </Field>
          <Field label="Fills per cycle" required>
            <Input
              type="number"
              min={1}
              value={form.fillsPerCycle}
              onChange={(e) => set("fillsPerCycle", e.target.value)}
            />
          </Field>
          <Field label="Product discount (%)" hint="0 = none">
            <Input
              type="number"
              min={0}
              max={100}
              step={5}
              value={form.productDiscountPercent}
              onChange={(e) => set("productDiscountPercent", e.target.value)}
            />
          </Field>
        </div>
        <Field label="Perks" hint="One perk per line — shown on client's membership card">
          <Textarea
            rows={4}
            placeholder={"1 lash fill/month\n10% off all products\nPriority booking"}
            value={form.perks}
            onChange={(e) => set("perks", e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Saving…" : editing ? "Save Changes" : "Create Plan"}
        disabled={!valid || saving}
      />
    </Dialog>
  );
}
