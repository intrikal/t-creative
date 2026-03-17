/**
 * @file EventFormDialog.tsx
 * @description Create / edit booking form dialog with service, client,
 *              staff, date, time, duration, location, and notes fields.
 */

"use client";

import { useState } from "react";
import { Dialog, Field, Input, Select, Textarea, DialogFooter } from "@/components/ui/dialog";
import { categoryToEventType } from "./helpers";
import type { EventType, FormState } from "./types";

export function EventFormDialog({
  open,
  title,
  initial,
  onClose,
  onSave,
  clients,
  serviceOptions,
  staffOptions,
}: {
  open: boolean;
  title: string;
  initial: FormState;
  onClose: () => void;
  onSave: (f: FormState) => void;
  clients: { id: string; name: string; phone: string | null }[];
  serviceOptions: {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
  }[];
  staffOptions: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<FormState>(initial);
  const set = (k: keyof FormState) => (v: string | number) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function onServiceChange(serviceId: number | "") {
    if (!serviceId) {
      setForm((prev) => ({ ...prev, serviceId: "", title: "", type: "lash" as EventType }));
      return;
    }
    const svc = serviceOptions.find((s) => s.id === serviceId);
    if (svc) {
      setForm((prev) => ({
        ...prev,
        serviceId,
        title: svc.name,
        type: categoryToEventType(svc.category),
        durationMin: svc.durationMinutes,
      }));
    }
  }

  function onClientChange(clientId: string) {
    const c = clients.find((cl) => cl.id === clientId);
    setForm((prev) => ({
      ...prev,
      clientId,
      client: c?.name ?? "",
    }));
  }

  function onStaffChange(staffId: string) {
    const s = staffOptions.find((st) => st.id === staffId);
    setForm((prev) => ({
      ...prev,
      staffId,
      staff: s?.name ?? "",
    }));
  }

  const valid = form.serviceId !== "" && form.clientId !== "" && form.date.trim() !== "";

  return (
    <Dialog open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Service" required>
            <Select
              value={form.serviceId}
              onChange={(e) => onServiceChange(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select service…</option>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client" required>
            <Select value={form.clientId} onChange={(e) => onClientChange(e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={(e) => set("date")(e.target.value)} />
          </Field>
          <Field label="Start time">
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => set("startTime")(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration">
            <Select
              value={String(form.durationMin)}
              onChange={(e) => set("durationMin")(Number(e.target.value))}
            >
              {[30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360].map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Staff">
            <Select value={form.staffId} onChange={(e) => onStaffChange(e.target.value)}>
              <option value="">Unassigned</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Location">
          <Input
            value={form.location}
            onChange={(e) => set("location")(e.target.value)}
            placeholder="e.g. Studio, Valley Fair"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={(e) => set("notes")(e.target.value)}
            placeholder="Any extra details..."
            rows={2}
          />
        </Field>
      </div>

      <DialogFooter
        onCancel={onClose}
        onConfirm={() => onSave(form)}
        confirmLabel="Save"
        disabled={!valid}
      />
    </Dialog>
  );
}
