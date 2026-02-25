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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EventRow, EventGuestRow, EventType, EventStatus, EventInput } from "./actions";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  addGuest,
  removeGuest,
  toggleGuestPaid,
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
  location: string;
  capacity: string;
  revenue: string;
  deposit: string;
  travelFee: string;
  notes: string;
};

function emptyEventForm(): EventForm {
  return {
    title: "",
    type: "bridal",
    status: "upcoming",
    date: "",
    time: "",
    endTime: "",
    location: "",
    capacity: "",
    revenue: "0",
    deposit: "",
    travelFee: "",
    notes: "",
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
    location: e.location ?? "",
    capacity: e.maxAttendees != null ? String(e.maxAttendees) : "",
    revenue: e.expectedRevenueInCents != null ? String(e.expectedRevenueInCents / 100) : "0",
    deposit: e.depositInCents != null ? String(e.depositInCents / 100) : "",
    travelFee: e.travelFeeInCents != null ? String(e.travelFeeInCents / 100) : "",
    notes: e.internalNotes ?? "",
  };
}

function formToInput(form: EventForm): EventInput {
  const startsAt =
    form.date && form.time
      ? new Date(`${form.date}T${form.time}`).toISOString()
      : new Date(form.date).toISOString();

  const endsAt =
    form.date && form.endTime ? new Date(`${form.date}T${form.endTime}`).toISOString() : null;

  return {
    title: form.title,
    eventType: form.type,
    status: form.status,
    startsAt,
    endsAt,
    location: form.location || null,
    maxAttendees: form.capacity ? Number(form.capacity) : null,
    expectedRevenueInCents: dollarsToCents(form.revenue),
    depositInCents: dollarsToCents(form.deposit),
    travelFeeInCents: dollarsToCents(form.travelFee),
    internalNotes: form.notes || null,
  };
}

/* ------------------------------------------------------------------ */
/*  Event dialog                                                        */
/* ------------------------------------------------------------------ */

function EventDialog({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: EventForm;
  onSave: (form: EventForm) => void;
}) {
  const [form, setForm] = useState<EventForm>(initial);
  const set =
    (field: keyof EventForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

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

        <Field label="Location">
          <Input
            value={form.location}
            onChange={set("location")}
            placeholder="Address or venue name"
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
}: {
  event: EventRow;
  onEdit: () => void;
  onDelete: () => void;
  onAddGuest: (guest: { name: string; service: string; paid: boolean }) => void;
  onToggleGuestPaid: (guestId: number) => void;
  onRemoveGuest: (guestId: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const type = TYPE_CONFIG[event.eventType];
  const status = statusConfig(event.status);
  const paidCount = event.guests.filter((g) => g.paid).length;
  const revDisplay = centsToDisplay(event.expectedRevenueInCents);
  const depDisplay = centsToDisplay(event.depositInCents);
  const travelDisplay = centsToDisplay(event.travelFeeInCents);

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
                {event.location && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {event.location}
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No guests added yet.</p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit event
                </button>
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

export function EventsPage({ initialEvents }: { initialEvents: EventRow[] }) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [isPending, startTransition] = useTransition();

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

    if (editingEvent) {
      // Optimistic update
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
                location: input.location ?? null,
                maxAttendees: input.maxAttendees ?? null,
                expectedRevenueInCents: input.expectedRevenueInCents ?? null,
                depositInCents: input.depositInCents ?? null,
                travelFeeInCents: input.travelFeeInCents ?? null,
                internalNotes: input.internalNotes ?? null,
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
            location: input.location ?? null,
            address: null,
            maxAttendees: input.maxAttendees ?? null,
            expectedRevenueInCents: input.expectedRevenueInCents ?? null,
            depositInCents: input.depositInCents ?? null,
            travelFeeInCents: input.travelFeeInCents ?? null,
            contactName: null,
            contactEmail: null,
            contactPhone: null,
            services: input.services ?? null,
            internalNotes: input.internalNotes ?? null,
            description: null,
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
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Event
        </button>
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
            />
          ))}
        </div>
      )}

      <EventDialog
        key={editingEvent?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editingEvent ? eventToForm(editingEvent) : emptyEventForm()}
        onSave={handleSave}
      />
    </div>
  );
}
