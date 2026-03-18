"use client";

/** CreateMembershipDialog — enroll a client in a Lash Club membership. */

import { useState, useTransition } from "react";
import { Dialog, DialogFooter, Field, Select, Textarea } from "@/components/ui/dialog";
import { createMembership, type MembershipPlan } from "../actions";
import { formatCents } from "./membership-helpers";

export function CreateMembershipDialog({
  open,
  onClose,
  clients,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  plans: MembershipPlan[];
}) {
  const [isPending, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const activePlans = plans.filter((p) => p.isActive);
  const selectedPlan = activePlans.find((p) => String(p.id) === planId);
  const valid = clientId !== "" && planId !== "";

  async function handleSave() {
    if (!valid) return;
    setSaving(true);
    try {
      startTransition(async () => {
        await createMembership({ clientId, planId: Number(planId), notes: notes || undefined });
        setClientId("");
        setPlanId("");
        setNotes("");
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
      title="New Membership"
      description="Enroll a client in a Lash Club membership. Their cycle starts today."
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" required>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan" required>
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
              <option value="">Select plan…</option>
              {activePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatCents(p.priceInCents)}/mo
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {selectedPlan && (
          <div className="rounded-lg bg-foreground/4 px-3 py-2.5 text-xs text-muted space-y-1">
            <p>
              <span className="font-medium text-foreground">{selectedPlan.fillsPerCycle}</span> fill
              {selectedPlan.fillsPerCycle !== 1 ? "s" : ""} per 30-day cycle
            </p>
            {selectedPlan.productDiscountPercent > 0 && (
              <p>
                <span className="font-medium text-foreground">
                  {selectedPlan.productDiscountPercent}%
                </span>{" "}
                off all retail products
              </p>
            )}
          </div>
        )}
        <Field label="Notes" hint="Payment method, receipt, or any special terms">
          <Textarea
            rows={2}
            placeholder="Paid via Square on Mar 15…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={handleSave}
        confirmLabel={saving ? "Enrolling…" : "Enroll Client"}
        disabled={!valid || saving}
      />
    </Dialog>
  );
}
