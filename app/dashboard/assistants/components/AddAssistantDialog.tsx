"use client";

import { useState } from "react";
import { Dialog, Field, Input, Select, DialogFooter } from "@/components/ui/dialog";
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
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Carter"
            />
          </Field>
        </div>
        <Field label="Role / title" required>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Lead Lash Technician"
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
              placeholder="name@tcreative.studio"
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
