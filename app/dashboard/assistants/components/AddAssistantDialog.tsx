/**
 * AddAssistantDialog — Form dialog for onboarding a new assistant.
 *
 * Collects name, role, contact info, status, specialties, certifications,
 * commission type (percentage vs flat-fee), commission rate, and tip-split
 * percentage. All monetary values are stored in cents on the backend; the
 * form accepts human-friendly dollar amounts and converts on save.
 */
"use client";

import { useState } from "react";
import { Dialog, Field, Input, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { CommissionType } from "../actions";
import type { AssistantStatus, Skill, ShiftDay } from "../AssistantsPage";

export interface AssistantFormData {
  firstName: string;
  lastName: string;
  role: string;
  phone: string;
  email: string;
  status: AssistantStatus;
  specialties: string;
  shifts: string;
  certifications: string;
  commissionType: CommissionType;
  commissionRate: number;
  commissionFlatFee: number;
  tipSplitPercent: number;
}

export function AddAssistantDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: AssistantFormData) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<AssistantStatus>("active");
  const [specialties, setSpecialties] = useState("");
  const [shifts, setShifts] = useState("");
  const [certs, setCerts] = useState("");
  const [commissionType, setCommissionType] = useState<CommissionType>("percentage");
  const [commissionRate, setCommissionRate] = useState("60");
  const [commissionFlatFee, setCommissionFlatFee] = useState("0");
  const [tipSplitPercent, setTipSplitPercent] = useState("100");

  return (
    <Dialog open={open} onClose={onClose} title="Add Assistant" size="lg">
      <div className="space-y-4" key={String(open)}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Jasmine"
              autoFocus
              aria-required="true"
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Carter"
              aria-required="true"
            />
          </Field>
        </div>
        <Field label="Role / title" required>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Lead Lash Technician"
            aria-required="true"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 000-0000"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Field>
        </div>
        <Field label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as AssistantStatus)}>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <Field
          label="Specialties"
          hint="Comma-separated: lash, jewelry, crochet, consulting, training, events, admin"
        >
          <Input
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="lash, training"
          />
        </Field>
        <Field label="Certifications" hint="Comma-separated">
          <Input
            value={certs}
            onChange={(e) => setCerts(e.target.value)}
            placeholder="Volume Lashes Pro, Lash Lift Certified"
          />
        </Field>

        {/* Commission section */}
        <div className="space-y-3 bg-surface/60 rounded-xl p-3 border border-border/60">
          <p className="text-xs font-semibold text-foreground">Commission & Tip Settings</p>

          <fieldset>
            <legend className="text-sm font-medium text-foreground">Commission type</legend>
            <div className="flex gap-2 mt-1" role="radiogroup">
              {(["percentage", "flat_fee"] as CommissionType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={commissionType === t}
                  onClick={() => setCommissionType(t)}
                  className={cn(
                    "flex-1 text-xs py-1.5 rounded-lg border transition-colors font-medium",
                    commissionType === t
                      ? "bg-accent text-white border-accent"
                      : "bg-background text-muted border-border hover:border-foreground/20",
                  )}
                >
                  {t === "percentage" ? "% of Revenue" : "Flat / Session"}
                </button>
              ))}
            </div>
          </fieldset>

          {commissionType === "percentage" ? (
            <Field
              label="Commission rate (%)"
              hint="Percentage of booking revenue paid to this assistant"
            >
              <Input
                type="number"
                min="0"
                max="100"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="60"
              />
            </Field>
          ) : (
            <Field
              label="Flat fee per session ($)"
              hint="Fixed dollar amount paid per completed session"
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                value={commissionFlatFee}
                onChange={(e) => setCommissionFlatFee(e.target.value)}
                placeholder="50.00"
              />
            </Field>
          )}

          <Field
            label="Tip split (%)"
            hint="Percentage of client tips this assistant keeps (100 = keeps all, 50 = split with house)"
          >
            <Input
              type="number"
              min="0"
              max="100"
              value={tipSplitPercent}
              onChange={(e) => setTipSplitPercent(e.target.value)}
              placeholder="100"
            />
          </Field>
        </div>

        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (!firstName.trim() || !lastName.trim()) return;
            onSave({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              role: role.trim(),
              phone: phone.trim(),
              email: email.trim(),
              status,
              specialties: specialties.trim(),
              shifts: shifts.trim(),
              certifications: certs.trim(),
              commissionType,
              commissionRate: Math.min(100, Math.max(0, Number(commissionRate) || 60)),
              commissionFlatFee: Math.max(0, Math.round(Number(commissionFlatFee) * 100) || 0),
              tipSplitPercent: Math.min(100, Math.max(0, Number(tipSplitPercent) || 100)),
            });
            onClose();
          }}
          confirmLabel="Add assistant"
          disabled={!firstName.trim() || !lastName.trim() || !role.trim()}
        />
      </div>
    </Dialog>
  );
}
