/**
 * Create / Edit booking dialog for the admin Bookings page.
 * Handles client selection (with auto-fill of preferred rebook cadence),
 * service selection (with auto-fill of duration and price), staff assignment,
 * recurrence rules (RRULE), series end constraints, and subscription linking.
 *
 * Parent: app/dashboard/bookings/BookingsPage.tsx
 *
 * State:
 *   form — BookingFormState containing all form field values
 *
 * Key operations:
 *   set()              — generic updater: spreads a single key into form state
 *   onServiceChange()  — when service changes, auto-fills durationMin and price
 *                         from the selected service's catalog values
 *   onClientChange()   — when client changes, auto-fills recurrenceRule from
 *                         the client's preferredRebookIntervalDays via
 *                         INTERVAL_DAYS_TO_RRULE lookup map
 *   onRepeatChange()   — clears series constraints when recurrence is turned off
 *   clientSubscriptions = activeSubscriptions.filter(...)
 *     — shows only subscriptions belonging to the selected client
 *   extractBaseFreq()  — strips UNTIL/COUNT from a stored RRULE, returning
 *                         just FREQ+INTERVAL for the dropdown
 *   extractUntilDate() — parses UNTIL=YYYYMMDDTHHMMSSZ into YYYY-MM-DD
 *                         using Object.fromEntries on semicolon-split parts
 *   extractCount()     — parses COUNT=N from RRULE parts via Object.fromEntries
 *   bookingToForm()    — maps a Booking object to form state for editing,
 *                         decomposing the RRULE into base freq + end date + count
 *
 * CADENCE_OPTIONS — imported from lib/cadence, populates the Repeat dropdown
 * INTERVAL_DAYS_TO_RRULE — maps preferredRebookIntervalDays numbers to RRULE strings
 */
"use client";

import { useState } from "react";
import { Dialog, DialogFooter, Field, Input, Textarea, Select } from "@/components/ui/dialog";
import { CADENCE_OPTIONS } from "@/lib/cadence";
import { ClientCombobox } from "./ClientCombobox";
import type { Booking, BookingStatus } from "./helpers";

export type BookingFormState = {
  clientId: string;
  serviceId: number | "";
  /** All selected services (ordered). First entry = primary service. */
  serviceIds: number[];
  staffId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: BookingStatus;
  durationMin: number;
  price: number;
  location: string;
  notes: string;
  recurrenceRule: string; // base frequency from dropdown (FREQ=...;INTERVAL=...)
  seriesEndDate: string; // YYYY-MM-DD — sets UNTIL in the full RRULE
  seriesMaxOccurrences: string; // numeric string — sets COUNT in the full RRULE
  subscriptionId: number | "";
};

/** Maps preferredRebookIntervalDays → RRULE base frequency string. */
const INTERVAL_DAYS_TO_RRULE: Record<number, string> = {
  7: "FREQ=WEEKLY;INTERVAL=1",
  14: "FREQ=WEEKLY;INTERVAL=2",
  21: "FREQ=WEEKLY;INTERVAL=3",
  30: "FREQ=MONTHLY;INTERVAL=1",
  42: "FREQ=WEEKLY;INTERVAL=6",
  56: "FREQ=WEEKLY;INTERVAL=8",
};

const EMPTY_FORM: BookingFormState = {
  clientId: "",
  serviceId: "",
  serviceIds: [],
  staffId: "",
  date: "",
  time: "",
  status: "confirmed",
  durationMin: 60,
  price: 0,
  location: "",
  notes: "",
  recurrenceRule: "",
  seriesEndDate: "",
  seriesMaxOccurrences: "",
  subscriptionId: "",
};

/** Strips UNTIL and COUNT from a stored RRULE, returning just FREQ+INTERVAL. */
function extractBaseFreq(rule: string): string {
  if (!rule) return "";
  return rule
    .split(";")
    .filter((p) => p.startsWith("FREQ=") || p.startsWith("INTERVAL="))
    .join(";");
}

/** Parses UNTIL=YYYYMMDDTHHMMSSZ → YYYY-MM-DD, or returns "". */
function extractUntilDate(rule: string): string {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=")));
  if (!parts.UNTIL) return "";
  const u = parts.UNTIL;
  return `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`;
}

/** Parses COUNT=N → "N", or returns "". */
function extractCount(rule: string): string {
  const parts = Object.fromEntries(rule.split(";").map((p) => p.split("=")));
  return parts.COUNT ?? "";
}

function bookingToForm(b: Booking): BookingFormState {
  const d = new Date(b.startsAtIso);
  const rule = b.recurrenceRule ?? "";
  return {
    clientId: b.clientId,
    serviceId: b.serviceId,
    serviceIds: b.serviceIds ?? [b.serviceId],
    staffId: b.staffId ?? "",
    date: d.toLocaleDateString("en-CA"), // YYYY-MM-DD
    time: d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
    status: b.status,
    durationMin: b.durationMin,
    price: b.price,
    location: b.location ?? "",
    notes: b.notes ?? "",
    recurrenceRule: extractBaseFreq(rule),
    seriesEndDate: extractUntilDate(rule),
    seriesMaxOccurrences: extractCount(rule),
    subscriptionId: "",
  };
}

export function BookingDialog({
  open,
  onClose,
  onSave,
  initial,
  serviceOptions,
  staffOptions,
  activeSubscriptions = [],
  initialClientName,
  maxServices,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: BookingFormState) => void;
  initial?: Booking | null;
  /** Display name of the pre-selected client in edit mode (shown in combobox). */
  initialClientName?: string;
  serviceOptions: {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
  }[];
  staffOptions: { id: string; name: string }[];
  activeSubscriptions?: { id: number; clientId: string; name: string; sessionsRemaining: number }[];
  /** Maximum services per booking (from booking rules). */
  maxServices?: number;
}) {
  const [form, setForm] = useState<BookingFormState>(initial ? bookingToForm(initial) : EMPTY_FORM);

  function set<K extends keyof BookingFormState>(key: K, val: BookingFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function onServiceChange(serviceId: number | "") {
    setForm((prev) => {
      if (!serviceId) return { ...prev, serviceId: "", serviceIds: [] };
      const svc = serviceOptions.find((s) => s.id === serviceId);
      return {
        ...prev,
        serviceId,
        serviceIds: [serviceId as number],
        durationMin: svc?.durationMinutes ?? prev.durationMin,
        price: svc ? svc.priceInCents / 100 : prev.price,
      };
    });
  }

  function addService(serviceId: number) {
    setForm((prev) => {
      if (prev.serviceIds.includes(serviceId)) return prev;
      if (prev.serviceIds.length >= (maxServices ?? 4)) return prev;
      const newIds = [...prev.serviceIds, serviceId];
      const totalDuration = newIds.reduce((sum, id) => {
        const svc = serviceOptions.find((s) => s.id === id);
        return sum + (svc?.durationMinutes ?? 0);
      }, 0);
      const totalPrice = newIds.reduce((sum, id) => {
        const svc = serviceOptions.find((s) => s.id === id);
        return sum + (svc?.priceInCents ?? 0);
      }, 0);
      return {
        ...prev,
        serviceIds: newIds,
        serviceId: newIds[0],
        durationMin: totalDuration,
        price: totalPrice / 100,
      };
    });
  }

  function removeService(serviceId: number) {
    setForm((prev) => {
      const newIds = prev.serviceIds.filter((id) => id !== serviceId);
      const totalDuration = newIds.reduce((sum, id) => {
        const svc = serviceOptions.find((s) => s.id === id);
        return sum + (svc?.durationMinutes ?? 0);
      }, 0);
      const totalPrice = newIds.reduce((sum, id) => {
        const svc = serviceOptions.find((s) => s.id === id);
        return sum + (svc?.priceInCents ?? 0);
      }, 0);
      return {
        ...prev,
        serviceIds: newIds,
        serviceId: newIds[0] ?? "",
        durationMin: totalDuration || 60,
        price: totalPrice / 100,
      };
    });
  }

  function onClientChange(
    clientId: string,
    client: { preferredRebookIntervalDays: number | null } | null,
  ) {
    const preferredDays = client?.preferredRebookIntervalDays;
    setForm((prev) => ({
      ...prev,
      clientId,
      subscriptionId: "",
      // On new bookings, auto-fill recurrence from client's preferred cadence
      recurrenceRule:
        !initial && preferredDays && INTERVAL_DAYS_TO_RRULE[preferredDays]
          ? INTERVAL_DAYS_TO_RRULE[preferredDays]
          : prev.recurrenceRule,
    }));
  }

  const clientSubscriptions = activeSubscriptions.filter((s) => s.clientId === form.clientId);

  function onRepeatChange(rule: string) {
    setForm((prev) => ({
      ...prev,
      recurrenceRule: rule,
      // Clear series constraints when repeat is turned off
      seriesEndDate: rule ? prev.seriesEndDate : "",
      seriesMaxOccurrences: rule ? prev.seriesMaxOccurrences : "",
    }));
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
            <ClientCombobox
              value={form.clientId}
              onChange={onClientChange}
              selectedName={initialClientName}
            />
          </Field>
          <Field label={`Service${form.serviceIds.length > 1 ? "s" : ""}`} required>
            {form.serviceIds.length === 0 ? (
              <Select
                aria-required="true"
                value=""
                onChange={(e) =>
                  onServiceChange(e.target.value === "" ? "" : Number(e.target.value))
                }
              >
                <option value="">Select service…</option>
                {serviceOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="space-y-1.5">
                {form.serviceIds.map((sid, i) => {
                  const svc = serviceOptions.find((s) => s.id === sid);
                  return (
                    <div
                      key={sid}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-sm"
                    >
                      <span className="truncate">
                        {i + 1}. {svc?.name ?? "Unknown"}{" "}
                        <span className="text-muted text-xs">
                          ({svc?.durationMinutes ?? 0}min · $
                          {((svc?.priceInCents ?? 0) / 100).toFixed(0)})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeService(sid)}
                        className="text-muted hover:text-destructive text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                {form.serviceIds.length < (maxServices ?? 4) && (
                  <Select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addService(Number(e.target.value));
                    }}
                  >
                    <option value="">+ Add another service…</option>
                    {serviceOptions
                      .filter((s) => !form.serviceIds.includes(s.id))
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </Select>
                )}
              </div>
            )}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input
              aria-required="true"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Time" required>
            <Input
              aria-required="true"
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Location" hint="e.g. Studio, Virtual, Client's home">
            <Input
              placeholder="Optional"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
            />
          </Field>
          <Field label="Repeat">
            <Select value={form.recurrenceRule} onChange={(e) => onRepeatChange(e.target.value)}>
              {CADENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {clientSubscriptions.length > 0 && (
          <Field label="Link to subscription" hint="Optional — tracks sessions against a package">
            <Select
              value={String(form.subscriptionId)}
              onChange={(e) =>
                set("subscriptionId", e.target.value === "" ? "" : Number(e.target.value))
              }
            >
              <option value="">None</option>
              {clientSubscriptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.sessionsRemaining} remaining)
                </option>
              ))}
            </Select>
          </Field>
        )}
        {form.recurrenceRule && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Series end date" hint="Stop after this date">
              <Input
                type="date"
                value={form.seriesEndDate}
                onChange={(e) => {
                  set("seriesEndDate", e.target.value);
                  if (e.target.value) set("seriesMaxOccurrences", "");
                }}
              />
            </Field>
            <Field label="Max occurrences" hint="Or stop after N appointments">
              <Input
                type="number"
                min={1}
                placeholder="e.g. 12"
                value={form.seriesMaxOccurrences}
                onChange={(e) => {
                  set("seriesMaxOccurrences", e.target.value);
                  if (e.target.value) set("seriesEndDate", "");
                }}
              />
            </Field>
          </div>
        )}
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
