"use client";

import { useState } from "react";
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

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type EventType = "bridal" | "popup" | "travel" | "private" | "workshop";
type EventStatus = "upcoming" | "confirmed" | "completed" | "cancelled" | "draft";

interface EventGuest {
  name: string;
  service: string;
  paid: boolean;
}

interface StudioEvent {
  id: number;
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  time: string;
  location: string;
  revenue: number;
  capacity: number;
  guests: EventGuest[];
  notes?: string;
  deposit?: number;
}

/* ------------------------------------------------------------------ */
/*  Initial mock data                                                   */
/* ------------------------------------------------------------------ */

const INITIAL_EVENTS: StudioEvent[] = [
  {
    id: 1,
    title: "Bridal Party — Nguyen Wedding",
    type: "bridal",
    status: "confirmed",
    date: "Mar 8, 2026",
    time: "9:00 AM – 2:00 PM",
    location: "T Creative Studio, San Jose",
    revenue: 1200,
    deposit: 300,
    capacity: 6,
    notes: "Bride + 5 bridesmaids. Mix of lashes and permanent jewelry. Champagne requested.",
    guests: [
      { name: "Lily Nguyen (Bride)", service: "Volume Lashes + Jewelry", paid: true },
      { name: "Sarah Kim", service: "Classic Lashes", paid: true },
      { name: "Priya D.", service: "Jewelry Weld", paid: false },
      { name: "Maya T.", service: "Classic Lashes", paid: false },
      { name: "Jasmine R.", service: "Volume Lashes", paid: false },
      { name: "Chloe P.", service: "Jewelry Weld", paid: false },
    ],
  },
  {
    id: 2,
    title: "Pop-Up — Westfield Valley Fair",
    type: "popup",
    status: "upcoming",
    date: "Mar 15, 2026",
    time: "11:00 AM – 6:00 PM",
    location: "Westfield Valley Fair, Santa Clara",
    revenue: 0,
    capacity: 20,
    notes: "Walk-in permanent jewelry pop-up. Bring full kit + extra chains.",
    guests: [],
  },
  {
    id: 3,
    title: "Travel Event — Los Angeles",
    type: "travel",
    status: "draft",
    date: "Apr 5–6, 2026",
    time: "10:00 AM – 5:00 PM",
    location: "Brentwood, Los Angeles CA",
    revenue: 0,
    capacity: 12,
    notes: "2-day lash & jewelry event. Flights TBD.",
    guests: [],
  },
  {
    id: 4,
    title: "Private Jewelry Party — Davis Residence",
    type: "private",
    status: "confirmed",
    date: "Feb 28, 2026",
    time: "4:00 PM – 7:00 PM",
    location: "Private Residence, Willow Glen",
    revenue: 650,
    deposit: 200,
    capacity: 10,
    notes: "Birthday party for Renee Davis. 8 confirmed guests.",
    guests: [
      { name: "Renee Davis (Host)", service: "Jewelry Weld", paid: true },
      { name: "Tanya B.", service: "Jewelry Weld", paid: true },
      { name: "Camille F.", service: "Matching Set", paid: false },
      { name: "Jordan L.", service: "Jewelry Weld", paid: false },
    ],
  },
  {
    id: 5,
    title: "Lash Workshop — Intro to Lash Extensions",
    type: "workshop",
    status: "completed",
    date: "Feb 7, 2026",
    time: "10:00 AM – 3:00 PM",
    location: "T Creative Studio, San Jose",
    revenue: 1500,
    capacity: 5,
    notes: "5 students completed. All received certificates.",
    guests: [
      { name: "Kezia T.", service: "Student", paid: true },
      { name: "Bianca R.", service: "Student", paid: true },
      { name: "Mia C.", service: "Student", paid: true },
      { name: "Diana L.", service: "Student", paid: true },
      { name: "Faith O.", service: "Student", paid: true },
    ],
  },
];

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
  popup: {
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
  private: {
    label: "Private",
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

/* ------------------------------------------------------------------ */
/*  Event form types                                                    */
/* ------------------------------------------------------------------ */

type EventForm = {
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  time: string;
  location: string;
  capacity: string;
  revenue: string;
  deposit: string;
  notes: string;
};

function emptyEventForm(): EventForm {
  return {
    title: "",
    type: "bridal",
    status: "upcoming",
    date: "",
    time: "",
    location: "",
    capacity: "",
    revenue: "0",
    deposit: "",
    notes: "",
  };
}

function eventToForm(e: StudioEvent): EventForm {
  return {
    title: e.title,
    type: e.type,
    status: e.status,
    date: e.date,
    time: e.time,
    location: e.location,
    capacity: String(e.capacity),
    revenue: String(e.revenue),
    deposit: e.deposit != null ? String(e.deposit) : "",
    notes: e.notes ?? "",
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
              <option value="bridal">Bridal Party</option>
              <option value="popup">Pop-Up</option>
              <option value="travel">Travel Event</option>
              <option value="private">Private Party</option>
              <option value="workshop">Workshop</option>
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input value={form.date} onChange={set("date")} placeholder="e.g. Mar 8, 2026" />
          </Field>
          <Field label="Time">
            <Input value={form.time} onChange={set("time")} placeholder="e.g. 10:00 AM – 2:00 PM" />
          </Field>
        </div>

        <Field label="Location">
          <Input
            value={form.location}
            onChange={set("location")}
            placeholder="Address or venue name"
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
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
  onAdd: (guest: EventGuest) => void;
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
}: {
  event: StudioEvent;
  onEdit: () => void;
  onDelete: () => void;
  onAddGuest: (guest: EventGuest) => void;
  onToggleGuestPaid: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const type = TYPE_CONFIG[event.type];
  const status = statusConfig(event.status);
  const paidCount = event.guests.filter((g) => g.paid).length;

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
                      {event.date}
                    </span>
                    {event.time && <span className="text-xs text-muted">{event.time}</span>}
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
                  {event.guests.length}/{event.capacity}
                  {event.guests.length > 0 && ` · ${paidCount} paid`}
                </span>
                {event.revenue > 0 && (
                  <span className="text-xs font-medium text-[#4e6b51] flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />${event.revenue.toLocaleString()}
                    {event.deposit && (
                      <span className="text-muted font-normal">(${event.deposit} deposit)</span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
              {event.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{event.notes}</p>
                </div>
              )}

              {/* Guest list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Guests ({event.guests.length}/{event.capacity})
                  </p>
                  {event.guests.length < event.capacity && (
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
                    {event.guests.map((g, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="flex-1 text-foreground">{g.name}</span>
                        <span className="text-muted">{g.service}</span>
                        <button
                          onClick={() => onToggleGuestPaid(i)}
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

export function EventsPage() {
  const [events, setEvents] = useState<StudioEvent[]>(INITIAL_EVENTS);
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<StudioEvent | null>(null);

  const filtered = filter === "all" ? events : events.filter((e) => e.type === filter);
  const upcoming = events.filter((e) => e.status === "upcoming" || e.status === "confirmed");
  const totalRevenue = events.reduce((s, e) => s + e.revenue, 0);

  function openNew() {
    setEditingEvent(null);
    setDialogOpen(true);
  }
  function openEdit(e: StudioEvent) {
    setEditingEvent(e);
    setDialogOpen(true);
  }

  function handleSave(form: EventForm) {
    if (editingEvent) {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === editingEvent.id
            ? {
                ...e,
                title: form.title,
                type: form.type,
                status: form.status,
                date: form.date,
                time: form.time,
                location: form.location,
                capacity: Number(form.capacity) || 10,
                revenue: Number(form.revenue) || 0,
                deposit: form.deposit ? Number(form.deposit) : undefined,
                notes: form.notes,
              }
            : e,
        ),
      );
    } else {
      setEvents((prev) => [
        {
          id: Date.now(),
          title: form.title,
          type: form.type,
          status: form.status,
          date: form.date,
          time: form.time,
          location: form.location,
          capacity: Number(form.capacity) || 10,
          revenue: Number(form.revenue) || 0,
          deposit: form.deposit ? Number(form.deposit) : undefined,
          notes: form.notes,
          guests: [],
        },
        ...prev,
      ]);
    }
  }

  function handleDelete(id: number) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function handleAddGuest(eventId: number, guest: EventGuest) {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, guests: [...e.guests, guest] } : e)),
    );
  }

  function handleToggleGuestPaid(eventId: number, guestIdx: number) {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, guests: e.guests.map((g, i) => (i === guestIdx ? { ...g, paid: !g.paid } : g)) }
          : e,
      ),
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Events</h1>
          <p className="text-sm text-muted mt-0.5">
            Bridal parties, pop-ups, travel, and workshops
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
          { label: "Revenue", value: `$${totalRevenue.toLocaleString()}`, sub: "from events" },
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
        {(["all", "bridal", "popup", "travel", "private", "workshop"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-foreground/8 text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {f === "all" ? "All" : f === "popup" ? "Pop-Up" : TYPE_CONFIG[f as EventType].label}
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
              onToggleGuestPaid={(i) => handleToggleGuestPaid(e.id, i)}
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
