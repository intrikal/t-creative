"use client";

import { useState, useTransition } from "react";
import {
  MapPin,
  Users,
  DollarSign,
  CalendarDays,
  Plus,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  UserPlus,
  Mail,
  X,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  EventRow,
  EventType,
  EventStatus,
  EventInput,
  VenueRow,
  VenueType,
  VenueInput,
} from "./actions";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  addGuest,
  removeGuest,
  toggleGuestPaid,
  sendEventRsvpInvite,
  createVenue,
  updateVenue,
} from "./actions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const TYPE_CONFIG: Record<
  EventType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  bridal: {
    label: "Bridal Party",
    bg: "bg-pink-50",
    text: "text-pink-700",
    border: "border-pink-100",
    dot: "bg-pink-400",
  },
  pop_up: {
    label: "Pop-Up",
    bg: "bg-[#d4a574]/10",
    text: "text-[#a07040]",
    border: "border-[#d4a574]/25",
    dot: "bg-[#d4a574]",
  },
  travel: {
    label: "Travel",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-100",
    dot: "bg-blue-400",
  },
  private_party: {
    label: "Private Party",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-100",
    dot: "bg-purple-400",
  },
  workshop: {
    label: "Workshop",
    bg: "bg-[#4e6b51]/10",
    text: "text-[#4e6b51]",
    border: "border-[#4e6b51]/20",
    dot: "bg-[#4e6b51]",
  },
  birthday: {
    label: "Birthday",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-100",
    dot: "bg-orange-400",
  },
  corporate: {
    label: "Corporate",
    bg: "bg-slate-50",
    text: "text-slate-700",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  studio: "Studio",
  client_home: "Client's Home",
  external_venue: "External Venue",
  pop_up_venue: "Pop-Up Venue",
  corporate_venue: "Corporate Venue",
};

function statusConfig(status: EventStatus) {
  switch (status) {
    case "upcoming":
      return { label: "Upcoming", className: "bg-foreground/8 text-muted border-foreground/12" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "draft":
      return { label: "Draft", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateRange(startsAt: string, endsAt: string | null) {
  const date = formatDate(startsAt);
  const startTime = formatTime(startsAt);
  if (!endsAt) return `${date} · ${startTime}`;
  const endTime = formatTime(endsAt);
  return `${date} · ${startTime} – ${endTime}`;
}

function centsToDisplay(cents: number | null): string {
  if (cents == null || cents === 0) return "";
  return `$${(cents / 100).toLocaleString()}`;
}

function dollarsToCents(dollars: string): number | null {
  const n = Number(dollars);
  return isNaN(n) || n === 0 ? null : Math.round(n * 100);
}

/* ------------------------------------------------------------------ */
/*  Event form types                                                    */
/* ------------------------------------------------------------------ */

type EventForm = {
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  time: string;
  endTime: string;
  venueId: string; // "" = custom/no venue, otherwise string of numeric id
  location: string; // used when venueId = ""
  capacity: string;
  revenue: string;
  deposit: string;
  travelFee: string;
  notes: string;
  equipmentNotes: string;
  /** Corporate billing — visible when type is "corporate" or isCorporate is checked. */
  isCorporate: boolean;
  companyName: string;
  billingEmail: string;
  poNumber: string;
};

function emptyEventForm(): EventForm {
  return {
    title: "",
    type: "bridal",
    status: "upcoming",
    date: "",
    time: "",
    endTime: "",
    venueId: "",
    location: "",
    capacity: "",
    revenue: "0",
    deposit: "",
    travelFee: "",
    notes: "",
    equipmentNotes: "",
    isCorporate: false,
    companyName: "",
    billingEmail: "",
    poNumber: "",
  };
}

function eventToForm(e: EventRow): EventForm {
  const start = new Date(e.startsAt);
  const dateStr = start.toISOString().slice(0, 10);
  const timeStr = start.toTimeString().slice(0, 5);
  const endTimeStr = e.endsAt ? new Date(e.endsAt).toTimeString().slice(0, 5) : "";

  return {
    title: e.title,
    type: e.eventType,
    status: e.status,
    date: dateStr,
    time: timeStr,
    endTime: endTimeStr,
    venueId: e.venueId != null ? String(e.venueId) : "",
    location: e.location ?? "",
    capacity: e.maxAttendees != null ? String(e.maxAttendees) : "",
    revenue: e.expectedRevenueInCents != null ? String(e.expectedRevenueInCents / 100) : "0",
    deposit: e.depositInCents != null ? String(e.depositInCents / 100) : "",
    travelFee: e.travelFeeInCents != null ? String(e.travelFeeInCents / 100) : "",
    notes: e.internalNotes ?? "",
    equipmentNotes: e.equipmentNotes ?? "",
    isCorporate: e.companyName != null || e.eventType === "corporate",
    companyName: e.companyName ?? "",
    billingEmail: e.billingEmail ?? "",
    poNumber: e.poNumber ?? "",
  };
}

function formToInput(form: EventForm): EventInput {
  const startsAt =
    form.date && form.time
      ? new Date(`${form.date}T${form.time}`).toISOString()
      : new Date(form.date).toISOString();

  const endsAt =
    form.date && form.endTime ? new Date(`${form.date}T${form.endTime}`).toISOString() : null;

  const venueId = form.venueId ? Number(form.venueId) : null;

  return {
    title: form.title,
    eventType: form.type,
    status: form.status,
    startsAt,
    endsAt,
    venueId,
    // When a saved venue is selected, location/address are resolved server-side from the venue.
    // For custom locations, pass the free-text value.
    location: venueId ? null : form.location || null,
    maxAttendees: form.capacity ? Number(form.capacity) : null,
    expectedRevenueInCents: dollarsToCents(form.revenue),
    depositInCents: dollarsToCents(form.deposit),
    travelFeeInCents: dollarsToCents(form.travelFee),
    internalNotes: form.notes || null,
    equipmentNotes: form.equipmentNotes || null,
    companyName: form.type === "corporate" || form.isCorporate ? form.companyName || null : null,
    billingEmail: form.type === "corporate" || form.isCorporate ? form.billingEmail || null : null,
    poNumber: form.type === "corporate" || form.isCorporate ? form.poNumber || null : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Event dialog                                                        */
/* ------------------------------------------------------------------ */

function EventDialog({
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
  const [form, setForm] = useState<EventForm>(initial);
  const set =
    (field: keyof EventForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const activeVenues = venues.filter((v) => v.isActive);
  const selectedVenue = form.venueId
    ? activeVenues.find((v) => String(v.id) === form.venueId)
    : null;

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
      <div className="space-y-4" key={String(open)}>
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

/* ------------------------------------------------------------------ */
/*  Venue form dialog                                                   */
/* ------------------------------------------------------------------ */

type VenueForm = {
  name: string;
  venueType: VenueType;
  address: string;
  parkingInfo: string;
  setupNotes: string;
  travelFee: string;
};

function emptyVenueForm(): VenueForm {
  return {
    name: "",
    venueType: "external_venue",
    address: "",
    parkingInfo: "",
    setupNotes: "",
    travelFee: "",
  };
}

function venueToForm(v: VenueRow): VenueForm {
  return {
    name: v.name,
    venueType: v.venueType,
    address: v.address ?? "",
    parkingInfo: v.parkingInfo ?? "",
    setupNotes: v.setupNotes ?? "",
    travelFee: v.defaultTravelFeeInCents != null ? String(v.defaultTravelFeeInCents / 100) : "",
  };
}

function venueFormToInput(form: VenueForm): VenueInput {
  return {
    name: form.name,
    venueType: form.venueType,
    address: form.address || null,
    parkingInfo: form.parkingInfo || null,
    setupNotes: form.setupNotes || null,
    defaultTravelFeeInCents: dollarsToCents(form.travelFee),
  };
}

function VenueFormDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: VenueForm;
  onSave: (form: VenueForm) => void;
}) {
  const [form, setForm] = useState<VenueForm>(initial);
  const set =
    (field: keyof VenueForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial.name ? "Edit Venue" : "New Venue"}
      size="md"
    >
      <div className="space-y-4" key={String(open)}>
        <Field label="Venue name" required>
          <Input
            value={form.name}
            onChange={set("name")}
            placeholder="e.g. Valley Fair Pop-up, Main Studio"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.venueType} onChange={set("venueType")}>
              {(Object.entries(VENUE_TYPE_LABELS) as [VenueType, string][]).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default travel fee ($)" hint="Optional">
            <Input
              type="number"
              value={form.travelFee}
              onChange={set("travelFee")}
              placeholder="0"
              min={0}
            />
          </Field>
        </div>

        <Field label="Address">
          <Input
            value={form.address}
            onChange={set("address")}
            placeholder="Full street address for navigation"
          />
        </Field>

        <Field label="Parking info" hint="Optional">
          <Input
            value={form.parkingInfo}
            onChange={set("parkingInfo")}
            placeholder="e.g. Lot B, level 2, free 2 hrs"
          />
        </Field>

        <Field label="Setup notes" hint="Optional">
          <Textarea
            value={form.setupNotes}
            onChange={set("setupNotes")}
            rows={2}
            placeholder="Power needs, table layout, load-in instructions…"
          />
        </Field>

        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (form.name.trim()) {
              onSave(form);
              onClose();
            }
          }}
          confirmLabel={initial.name ? "Save venue" : "Add venue"}
          disabled={!form.name.trim()}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Venues list dialog                                                  */
/* ------------------------------------------------------------------ */

function VenuesDialog({
  open,
  onClose,
  venues,
  onAdd,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  venues: VenueRow[];
  onAdd: (form: VenueForm) => void;
  onUpdate: (id: number, form: VenueForm, isActive: boolean) => void;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueRow | null>(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Saved Venues" size="lg">
        <div className="space-y-2">
          {venues.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              No saved venues yet. Add your first venue below.
            </p>
          )}

          {venues.map((v) => (
            <div
              key={v.id}
              className={cn(
                "flex items-start gap-3 px-3 py-2.5 rounded-lg border",
                v.isActive ? "border-border/60" : "border-border/30 opacity-60",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{v.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted border border-foreground/10">
                    {VENUE_TYPE_LABELS[v.venueType]}
                  </span>
                  {!v.isActive && <span className="text-[10px] text-muted italic">Inactive</span>}
                </div>
                {v.address && <p className="text-xs text-muted mt-0.5 truncate">{v.address}</p>}
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {v.defaultTravelFeeInCents != null && v.defaultTravelFeeInCents > 0 && (
                    <span className="text-xs text-muted">
                      Travel: {centsToDisplay(v.defaultTravelFeeInCents)}
                    </span>
                  )}
                  {v.parkingInfo && (
                    <span className="text-xs text-muted">Parking: {v.parkingInfo}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditingVenue(v)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors"
                  aria-label="Edit venue"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onUpdate(v.id, venueToForm(v), !v.isActive)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted hover:text-foreground transition-colors text-[11px] font-medium"
                  title={v.isActive ? "Deactivate venue" : "Reactivate venue"}
                >
                  {v.isActive ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-accent hover:bg-accent/5 rounded-lg transition-colors border border-dashed border-accent/30 mt-2"
          >
            <Plus className="w-3.5 h-3.5" /> Add venue
          </button>
        </div>
      </Dialog>

      <VenueFormDialog
        key={`add-${addOpen}`}
        open={addOpen}
        onClose={() => setAddOpen(false)}
        initial={emptyVenueForm()}
        onSave={onAdd}
      />

      {editingVenue && (
        <VenueFormDialog
          key={`edit-${editingVenue.id}`}
          open={!!editingVenue}
          onClose={() => setEditingVenue(null)}
          initial={venueToForm(editingVenue)}
          onSave={(form) => {
            onUpdate(editingVenue.id, form, editingVenue.isActive);
            setEditingVenue(null);
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Add guest dialog                                                    */
/* ------------------------------------------------------------------ */

function AddGuestDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (guest: { name: string; service: string; paid: boolean }) => void;
}) {
  const [name, setName] = useState("");
  const [service, setService] = useState("");
  const [paid, setPaid] = useState(false);

  return (
    <Dialog open={open} onClose={onClose} title="Add Guest" size="sm">
      <div className="space-y-4" key={String(open)}>
        <Field label="Guest name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </Field>
        <Field label="Service">
          <Input
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. Volume Lashes"
          />
        </Field>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          <span className="text-sm text-foreground">Marked as paid</span>
        </label>
        <DialogFooter
          onCancel={onClose}
          onConfirm={() => {
            if (name.trim()) {
              onAdd({ name, service, paid });
              onClose();
            }
          }}
          confirmLabel="Add guest"
          disabled={!name.trim()}
        />
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Event card                                                          */
/* ------------------------------------------------------------------ */

function EventCard({
  event,
  onEdit,
  onDelete,
  onAddGuest,
  onToggleGuestPaid,
  onRemoveGuest,
  onSendInvite,
}: {
  event: EventRow;
  onEdit: () => void;
  onDelete: () => void;
  onAddGuest: (guest: { name: string; service: string; paid: boolean }) => void;
  onToggleGuestPaid: (guestId: number) => void;
  onRemoveGuest: (guestId: number) => void;
  onSendInvite: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [isSendingInvite, startInviteTransition] = useTransition();
  const type = TYPE_CONFIG[event.eventType];
  const status = statusConfig(event.status);
  const paidCount = event.guests.filter((g) => g.paid).length;
  const revDisplay = centsToDisplay(event.expectedRevenueInCents);
  const depDisplay = centsToDisplay(event.depositInCents);
  const travelDisplay = centsToDisplay(event.travelFeeInCents);
  const displayLocation = event.venueName ?? event.location;

  return (
    <>
      <Card className="gap-0">
        <CardContent className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className={cn("w-1.5 self-stretch rounded-full shrink-0 min-h-[2.5rem]", type.dot)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
                    <Badge
                      className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span
                      className={cn(
                        "text-[11px] font-medium px-1.5 py-0.5 rounded-full border",
                        type.bg,
                        type.text,
                        type.border,
                      )}
                    >
                      {type.label}
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {formatDateRange(event.startsAt, event.endsAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors shrink-0"
                >
                  {expanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {event.companyName && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {event.companyName}
                  </span>
                )}
                {displayLocation && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {displayLocation}
                  </span>
                )}
                <span className="text-xs text-muted flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {event.guests.length}
                  {event.maxAttendees != null && `/${event.maxAttendees}`}
                  {event.guests.length > 0 && ` · ${paidCount} paid`}
                </span>
                {revDisplay && (
                  <span className="text-xs font-medium text-[#4e6b51] flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {revDisplay}
                    {depDisplay && (
                      <span className="text-muted font-normal">({depDisplay} deposit)</span>
                    )}
                  </span>
                )}
                {travelDisplay && (
                  <span className="text-xs text-muted">+ {travelDisplay} travel</span>
                )}
              </div>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
              {event.internalNotes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {event.internalNotes}
                  </p>
                </div>
              )}

              {event.equipmentNotes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    Equipment
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {event.equipmentNotes}
                  </p>
                </div>
              )}

              {(event.billingEmail || event.poNumber) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Corporate Billing
                  </p>
                  <div className="space-y-1">
                    {event.billingEmail && (
                      <p className="text-sm text-foreground/80 flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-muted shrink-0" />
                        {event.billingEmail}
                      </p>
                    )}
                    {event.poNumber && (
                      <p className="text-sm text-foreground/80">
                        <span className="text-muted">PO#</span> {event.poNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Guest list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Guests ({event.guests.length}
                    {event.maxAttendees != null && `/${event.maxAttendees}`})
                  </p>
                  {(event.maxAttendees == null || event.guests.length < event.maxAttendees) && (
                    <button
                      onClick={() => setGuestDialogOpen(true)}
                      className="flex items-center gap-1 text-xs text-accent hover:opacity-80 transition-opacity"
                    >
                      <UserPlus className="w-3 h-3" /> Add guest
                    </button>
                  )}
                </div>
                {event.guests.length > 0 ? (
                  <div className="space-y-1.5">
                    {event.guests.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 text-xs">
                        <span className="flex-1 text-foreground">{g.name}</span>
                        <span className="text-muted">{g.service}</span>
                        <button
                          onClick={() => onToggleGuestPaid(g.id)}
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-colors",
                            g.paid
                              ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20 hover:bg-[#4e6b51]/20"
                              : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20 hover:bg-[#7a5c10]/20",
                          )}
                        >
                          {g.paid ? "Paid" : "Unpaid"}
                        </button>
                        <button
                          onClick={() => onRemoveGuest(g.id)}
                          className="text-muted hover:text-destructive transition-colors"
                          aria-label="Remove guest"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No guests added yet.</p>
                )}
              </div>

              <div className="flex gap-2 pt-1 flex-wrap">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit event
                </button>
                {event.contactEmail && (
                  <button
                    onClick={() => startInviteTransition(onSendInvite)}
                    disabled={isSendingInvite}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-50"
                  >
                    <Mail className="w-3 h-3" /> {isSendingInvite ? "Sending…" : "Send Invite"}
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-destructive px-2.5 py-1.5 rounded-lg hover:bg-destructive/5 transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddGuestDialog
        key={`guest-${event.id}-${guestDialogOpen}`}
        open={guestDialogOpen}
        onClose={() => setGuestDialogOpen(false)}
        onAdd={onAddGuest}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function EventsPage({
  initialEvents,
  initialVenues,
}: {
  initialEvents: EventRow[];
  initialVenues: VenueRow[];
}) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [venues, setVenues] = useState<VenueRow[]>(initialVenues);
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [venuesDialogOpen, setVenuesDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = filter === "all" ? events : events.filter((e) => e.eventType === filter);
  const upcoming = events.filter((e) => e.status === "upcoming" || e.status === "confirmed");
  const totalRevenue = events.reduce((s, e) => s + (e.expectedRevenueInCents ?? 0), 0);

  function openNew() {
    setEditingEvent(null);
    setDialogOpen(true);
  }
  function openEdit(e: EventRow) {
    setEditingEvent(e);
    setDialogOpen(true);
  }

  function handleSave(form: EventForm) {
    const input = formToInput(form);
    const venue = input.venueId ? venues.find((v) => v.id === input.venueId) : null;
    const resolvedLocation = venue ? venue.name : (input.location ?? null);

    if (editingEvent) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? {
                ...e,
                title: input.title,
                eventType: input.eventType,
                status: input.status,
                startsAt: input.startsAt,
                endsAt: input.endsAt ?? null,
                venueId: input.venueId ?? null,
                venueName: venue?.name ?? null,
                location: resolvedLocation,
                maxAttendees: input.maxAttendees ?? null,
                expectedRevenueInCents: input.expectedRevenueInCents ?? null,
                depositInCents: input.depositInCents ?? null,
                travelFeeInCents: input.travelFeeInCents ?? null,
                internalNotes: input.internalNotes ?? null,
                equipmentNotes: input.equipmentNotes ?? null,
                companyName: input.companyName ?? null,
                billingEmail: input.billingEmail ?? null,
                poNumber: input.poNumber ?? null,
              }
            : e,
        ),
      );
      startTransition(() => updateEvent(editingEvent.id, input));
    } else {
      startTransition(async () => {
        const newId = await createEvent(input);
        setEvents((prev) => [
          {
            id: newId,
            title: input.title,
            eventType: input.eventType,
            status: input.status,
            startsAt: input.startsAt,
            endsAt: input.endsAt ?? null,
            venueId: input.venueId ?? null,
            venueName: venue?.name ?? null,
            location: resolvedLocation,
            address: venue?.address ?? null,
            maxAttendees: input.maxAttendees ?? null,
            expectedRevenueInCents: input.expectedRevenueInCents ?? null,
            depositInCents: input.depositInCents ?? null,
            travelFeeInCents: input.travelFeeInCents ?? null,
            contactName: null,
            contactEmail: null,
            contactPhone: null,
            services: input.services ?? null,
            internalNotes: input.internalNotes ?? null,
            equipmentNotes: input.equipmentNotes ?? null,
            description: null,
            companyName: input.companyName ?? null,
            billingEmail: input.billingEmail ?? null,
            poNumber: input.poNumber ?? null,
            guests: [],
          },
          ...prev,
        ]);
      });
    }
  }

  function handleDelete(id: number) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
    startTransition(() => deleteEvent(id));
  }

  function handleAddGuest(
    eventId: number,
    guest: { name: string; service: string; paid: boolean },
  ) {
    startTransition(async () => {
      const guestId = await addGuest(eventId, guest);
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                guests: [
                  ...e.guests,
                  {
                    id: guestId,
                    name: guest.name,
                    service: guest.service || null,
                    paid: guest.paid,
                  },
                ],
              }
            : e,
        ),
      );
    });
  }

  function handleToggleGuestPaid(eventId: number, guestId: number) {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? {
              ...e,
              guests: e.guests.map((g) => (g.id === guestId ? { ...g, paid: !g.paid } : g)),
            }
          : e,
      ),
    );
    startTransition(() => toggleGuestPaid(guestId));
  }

  function handleCreateVenue(form: VenueForm) {
    startTransition(async () => {
      const newId = await createVenue(venueFormToInput(form));
      const newVenue: VenueRow = {
        id: newId,
        name: form.name,
        venueType: form.venueType,
        address: form.address || null,
        parkingInfo: form.parkingInfo || null,
        setupNotes: form.setupNotes || null,
        defaultTravelFeeInCents: dollarsToCents(form.travelFee),
        isActive: true,
      };
      setVenues((prev) => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)));
    });
  }

  function handleUpdateVenue(id: number, form: VenueForm, isActive: boolean) {
    setVenues((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              name: form.name,
              venueType: form.venueType,
              address: form.address || null,
              parkingInfo: form.parkingInfo || null,
              setupNotes: form.setupNotes || null,
              defaultTravelFeeInCents: dollarsToCents(form.travelFee),
              isActive,
            }
          : v,
      ),
    );
    startTransition(() => updateVenue(id, { ...venueFormToInput(form), isActive }));
  }

  // Collect unique event types from current events for filter pills
  const activeTypes = [...new Set(events.map((e) => e.eventType))].sort();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Events</h1>
          <p className="text-sm text-muted mt-0.5">
            Bridal parties, pop-ups, travel, workshops, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVenuesDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors border border-border/60"
          >
            <Building2 className="w-3.5 h-3.5" />
            Venues
            {venues.filter((v) => v.isActive).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted ml-0.5">
                {venues.filter((v) => v.isActive).length}
              </span>
            )}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Upcoming", value: upcoming.length, sub: "confirmed + upcoming" },
          { label: "Total Events", value: events.length, sub: "all time" },
          {
            label: "Total Guests",
            value: events.reduce((s, e) => s + e.guests.length, 0),
            sub: "across all events",
          },
          {
            label: "Revenue",
            value: `$${(totalRevenue / 100).toLocaleString()}`,
            sub: "from events",
          },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {s.label}
              </p>
              <p className="text-2xl font-semibold text-foreground mt-1">{s.value}</p>
              <p className="text-xs text-muted mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            filter === "all"
              ? "bg-foreground/8 text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          All
        </button>
        {activeTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === t ? "bg-foreground/8 text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {TYPE_CONFIG[t].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">No events in this category.</p>
          <button onClick={openNew} className="mt-2 text-sm text-accent hover:underline">
            + Create your first event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              onEdit={() => openEdit(e)}
              onDelete={() => handleDelete(e.id)}
              onAddGuest={(guest) => handleAddGuest(e.id, guest)}
              onToggleGuestPaid={(guestId) => handleToggleGuestPaid(e.id, guestId)}
              onRemoveGuest={(guestId) => removeGuest(guestId)}
              onSendInvite={() => sendEventRsvpInvite(e.id)}
            />
          ))}
        </div>
      )}

      <EventDialog
        key={editingEvent?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editingEvent ? eventToForm(editingEvent) : emptyEventForm()}
        venues={venues}
        onSave={handleSave}
      />

      <VenuesDialog
        open={venuesDialogOpen}
        onClose={() => setVenuesDialogOpen(false)}
        venues={venues}
        onAdd={handleCreateVenue}
        onUpdate={handleUpdateVenue}
      />
    </div>
  );
}
