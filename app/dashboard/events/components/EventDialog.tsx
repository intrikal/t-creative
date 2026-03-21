/**
 * @file EventDialog.tsx
 * @description Modal dialog for creating and editing events with venue selection,
 *   scheduling, pricing, and optional corporate billing fields.
 */

"use client";

import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import type { VenueRow } from "../actions";
import { TYPE_CONFIG, VENUE_TYPE_LABELS } from "./helpers";
import type { EventForm } from "./types";

export function EventDialog({
  open,
  onClose,
  initial,
  venues,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: EventForm;
  venues: VenueRow[];
  onSave: (form: EventForm) => void;
}) {
  /** Full event form state, reset from `initial` each time the dialog opens. */
  const [form, setForm] = useState<EventForm>(initial);

  // Reset form to initial values on open so edits don't persist across opens.
  useEffect(() => {
    if (open) setForm(initial);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Curried setter — returns an onChange handler for any form field. */
  const set =
    (field: keyof EventForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  /** Only show active venues in the picker to prevent selecting deactivated ones. */
  const activeVenues = venues.filter((v) => v.isActive);
  /** The currently selected venue object (null if custom/no venue). */
  const selectedVenue = form.venueId
    ? activeVenues.find((v) => String(v.id) === form.venueId)
    : null;

  /**
   * handleVenueChange — updates venue selection and auto-fills travel fee.
   * When a saved venue with a default travel fee is selected and the form's
   * travel fee is empty/zero, pre-populate it to save the user a step.
   */
  function handleVenueChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const vid = e.target.value;
    if (vid) {
      const venue = activeVenues.find((v) => String(v.id) === vid);
      setForm((f) => ({
        ...f,
        venueId: vid,
        // Auto-fill travel fee from venue default if the field is currently empty or zero
        travelFee:
          venue?.defaultTravelFeeInCents && (f.travelFee === "" || f.travelFee === "0")
            ? String(venue.defaultTravelFeeInCents / 100)
            : f.travelFee,
      }));
    } else {
      setForm((f) => ({ ...f, venueId: "" }));
    }
  }

  const valid = form.title.trim() !== "" && form.date.trim() !== "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.title ? "Edit Event" : "New Event"}
      size="lg"
    >
      <div className="space-y-4">
        <Field label="Event title" required>
          <Input
            value={form.title}
            onChange={set("title")}
            placeholder="e.g. Bridal Party — Smith Wedding"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type" required>
            <Select value={form.type} onChange={set("type")}>
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={set("status")}>
              <option value="draft">Draft</option>
              <option value="upcoming">Upcoming</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Date" required>
            <Input type="date" value={form.date} onChange={set("date")} />
          </Field>
          <Field label="Start time">
            <Input type="time" value={form.time} onChange={set("time")} />
          </Field>
          <Field label="End time">
            <Input type="time" value={form.endTime} onChange={set("endTime")} />
          </Field>
        </div>

        {/* Location — saved venue selector or free-text */}
        <Field label="Location">
          <Select value={form.venueId} onChange={handleVenueChange}>
            <option value="">Custom / one-off location</option>
            {activeVenues.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name} · {VENUE_TYPE_LABELS[v.venueType]}
              </option>
            ))}
          </Select>
        </Field>

        {/* Show venue details when a saved venue is selected */}
        {selectedVenue &&
          (selectedVenue.address || selectedVenue.parkingInfo || selectedVenue.setupNotes) && (
            <div className="text-xs space-y-1 px-3 py-2.5 bg-foreground/[0.03] border border-border/50 rounded-lg">
              {selectedVenue.address && (
                <p className="text-muted">
                  <span className="font-medium text-foreground/70">Address:</span>{" "}
                  {selectedVenue.address}
                </p>
              )}
              {selectedVenue.parkingInfo && (
                <p className="text-muted">
                  <span className="font-medium text-foreground/70">Parking:</span>{" "}
                  {selectedVenue.parkingInfo}
                </p>
              )}
              {selectedVenue.setupNotes && (
                <p className="text-muted">
                  <span className="font-medium text-foreground/70">Setup:</span>{" "}
                  {selectedVenue.setupNotes}
                </p>
              )}
            </div>
          )}

        {/* Free-text location when no saved venue selected */}
        {!form.venueId && (
          <Field label="Custom location" hint="Address or venue name">
            <Input
              value={form.location}
              onChange={set("location")}
              placeholder="e.g. 123 Main St, San Jose"
            />
          </Field>
        )}

        <Field label="Equipment needed" hint="Portable gear for off-site events">
          <Input
            value={form.equipmentNotes}
            onChange={set("equipmentNotes")}
            placeholder="e.g. Jewelry station, ring display, extension cord"
          />
        </Field>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Capacity">
            <Input
              type="number"
              value={form.capacity}
              onChange={set("capacity")}
              placeholder="10"
              min={1}
            />
          </Field>
          <Field label="Revenue ($)">
            <Input
              type="number"
              value={form.revenue}
              onChange={set("revenue")}
              placeholder="0"
              min={0}
            />
          </Field>
          <Field label="Deposit ($)" hint="Optional">
            <Input
              type="number"
              value={form.deposit}
              onChange={set("deposit")}
              placeholder="0"
              min={0}
            />
          </Field>
          <Field label="Travel fee ($)" hint="Optional">
            <Input
              type="number"
              value={form.travelFee}
              onChange={set("travelFee")}
              placeholder="0"
              min={0}
            />
          </Field>
        </div>

        <Field label="Notes">
          <Textarea
            value={form.notes}
            onChange={set("notes")}
            rows={3}
            placeholder="Special requests, setup notes, etc."
          />
        </Field>

        {/* Corporate billing — auto-shown for corporate type; checkbox toggle for others */}
        {form.type !== "corporate" && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isCorporate}
              onChange={(e) => setForm((f) => ({ ...f, isCorporate: e.target.checked }))}
              className="accent-accent w-4 h-4"
            />
            <span className="text-sm text-foreground">Corporate event</span>
          </label>
        )}

        {(form.type === "corporate" || form.isCorporate) && (
          <div className="space-y-3 px-3 py-3 bg-foreground/[0.03] border border-border/50 rounded-lg">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              Corporate Billing
            </p>
            <Field label="Company name">
              <Input
                value={form.companyName}
                onChange={set("companyName")}
                placeholder="Acme Corp"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Billing email" hint="For invoices">
                <Input
                  type="email"
                  value={form.billingEmail}
                  onChange={set("billingEmail")}
                  placeholder="billing@company.com"
                />
              </Field>
              <Field label="PO number" hint="Optional">
                <Input value={form.poNumber} onChange={set("poNumber")} placeholder="PO-12345" />
              </Field>
            </div>
          </div>
        )}

        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            onSave(form);
            onClose();
          }}
          confirmLabel={initial.title ? "Save changes" : "Create event"}
          disabled={!valid}
        />
      </div>
    </Dialog>
  );
}
