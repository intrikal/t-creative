"use client";

import { useState } from "react";
import { Dialog, DialogFooter, Field, Input, Textarea, Select } from "@/components/ui/dialog";
import type { Booking, BookingStatus } from "../BookingsPage";

export type BookingFormState = {
  clientId: string;
  serviceId: number | "";
  staffId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: BookingStatus;
  durationMin: number;
  price: number;
  location: string;
  notes: string;
};

const EMPTY_FORM: BookingFormState = {
  clientId: "",
  serviceId: "",
  staffId: "",
  date: "",
  time: "",
  status: "confirmed",
  durationMin: 60,
  price: 0,
  location: "",
  notes: "",
};

function bookingToForm(b: Booking): BookingFormState {
  const d = new Date(b.startsAtIso);
  return {
    clientId: b.clientId,
    serviceId: b.serviceId,
    staffId: b.staffId ?? "",
    date: d.toLocaleDateString("en-CA"), // YYYY-MM-DD
    time: d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    status: b.status,
    durationMin: b.durationMin,
    price: b.price,
    location: b.location ?? "",
    notes: b.notes ?? "",
  };
}

export function BookingDialog({
  open,
  onClose,
  onSave,
  initial,
  clients,
  serviceOptions,
  staffOptions,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: BookingFormState) => void;
  initial?: Booking | null;
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
  const [form, setForm] = useState<BookingFormState>(initial ? bookingToForm(initial) : EMPTY_FORM);

  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setForm(initial ? bookingToForm(initial) : EMPTY_FORM);
  }

  function set<K extends keyof BookingFormState>(key: K, val: BookingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function onServiceChange(serviceId: number | "") {
    setForm((prev) => {
      if (!serviceId) return { ...prev, serviceId: "" };
      const svc = serviceOptions.find((s) => s.id === serviceId);
      return {
        ...prev,
        serviceId,
        durationMin: svc?.durationMinutes ?? prev.durationMin,
        price: svc ? svc.priceInCents / 100 : prev.price,
      };
    });
  }

  const isEdit = !!initial;
  const valid =
    form.clientId !== "" &&
    form.serviceId !== "" &&
    form.date.trim() !== "" &&
    form.time.trim() !== "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Booking" : "New Booking"}
      description={
        isEdit ? "Update appointment details." : "Add a new appointment to the schedule."
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client" required>
            <Select value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Time" required>
            <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Staff">
            <Select value={form.staffId} onChange={(e) => set("staffId", e.target.value)}>
              <option value="">Unassigned</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(e) => set("status", e.target.value as BookingStatus)}
            >
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)">
            <Input
              type="number"
              min={15}
              step={15}
              value={form.durationMin}
              onChange={(e) => set("durationMin", Number(e.target.value))}
            />
          </Field>
          <Field label="Price ($)">
            <Input
              type="number"
              min={0}
              step={5}
              value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Location" hint="e.g. Studio, Virtual, Client's home">
          <Input
            placeholder="Optional"
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <Textarea
            rows={3}
            placeholder="Any special instructions or notes…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
      <DialogFooter
        onCancel={onClose}
        onConfirm={() => {
          if (valid) {
            onSave(form);
            onClose();
          }
        }}
        confirmLabel={isEdit ? "Save Changes" : "Add Booking"}
        disabled={!valid}
      />
    </Dialog>
  );
}
