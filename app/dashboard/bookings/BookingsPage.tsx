/**
 * app/dashboard/bookings/BookingsPage.tsx — Admin bookings management dashboard.
 *
 * ## Responsibility
 * Manages all booking CRUD and status transitions from the admin's perspective.
 * Hydrated with real DB data from the server component; maintains optimistic local
 * state after each mutation.
 *
 * ## Architecture
 * - Server Component (`page.tsx`) fetches `BookingRow[]` + select options, passes
 *   as props to this client component.
 * - Optimistic updates: mutations call server actions, then immediately patch local
 *   `bookings` state — no `router.refresh()` needed for status changes.
 *
 * ## Tabs
 * - **Upcoming / All** — Live bookings sorted newest-first. Filtered by a status
 *   dropdown (All / Confirmed / Pending / Completed / Cancelled / No-show).
 * - **Waitlist**       — Static mock data for Phase 1. No waitlist DB table yet.
 *
 * ## Booking status machine
 * Valid transitions are enforced by the `bookingStatusEnum` DB constraint. The UI
 * allows any status to be set from the dialog — the server action (`updateBookingStatus`)
 * persists the value without additional validation because the dialog only exposes
 * valid status options.
 *
 * ## Waitlist (Phase 1)
 * The Waitlist tab currently displays hardcoded placeholder data. Phase 2 will add
 * a `waitlist_entries` table and wire this tab to real data.
 *
 * ## Stat cards
 * Computed from the live `bookings` state:
 * - "Today"     — appointments with `date === "Today"`
 * - "Upcoming"  — confirmed + pending appointments
 * - "Collected" — sum of `price` across completed appointments
 * - "Waitlist"  — hardcoded 0 (no waitlist table in Phase 1)
 *
 * ## Data mapping (DB → UI)
 * `mapBookingRow` converts a flat `BookingRow` (from the join query) to the richer
 * `Booking` UI shape:
 * - `startsAt` (Date) → `date` ("Today" / "Tomorrow" / "Feb 22") + `time` ("2:30 PM")
 * - `totalInCents / 100` → `price`
 * - `clientFirstName + clientLastName` → `client` display string
 * - `clientFirstName[0] + clientLastName?.[0]` → `clientInitials`
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, MapPin, Search, Plus, Pencil, Trash2, MoreHorizontal, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { updateBookingStatus, createBooking } from "./actions";
import type { BookingRow, BookingInput } from "./actions";

/* ------------------------------------------------------------------ */
/*  Types & mock data                                                  */
/* ------------------------------------------------------------------ */

type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";
type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "training";
type WaitlistStatus = "waiting" | "contacted" | "booked" | "removed";

interface Booking {
  id: number;
  date: string;
  time: string;
  startsAtIso: string; // raw ISO string for date/time inputs
  service: string;
  category: ServiceCategory;
  client: string;
  clientInitials: string;
  clientPhone: string;
  staff: string;
  status: BookingStatus;
  durationMin: number;
  price: number;
  location?: string;
  notes?: string;
  // DB IDs for server actions
  clientId: string;
  serviceId: number;
  staffId: string | null;
}

function formatBookingDate(startsAt: Date): { date: string; time: string } {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowMidnight = new Date(todayMidnight.getTime() + 86_400_000);
  const bookingMidnight = new Date(startsAt.getFullYear(), startsAt.getMonth(), startsAt.getDate());

  let date: string;
  if (bookingMidnight.getTime() === todayMidnight.getTime()) {
    date = "Today";
  } else if (bookingMidnight.getTime() === tomorrowMidnight.getTime()) {
    date = "Tomorrow";
  } else {
    date = startsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const time = startsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return { date, time };
}

function mapBookingRow(row: BookingRow): Booking {
  const startsAt = new Date(row.startsAt);
  const { date, time } = formatBookingDate(startsAt);
  const clientName = [row.clientFirstName, row.clientLastName].filter(Boolean).join(" ");
  const initials = ((row.clientFirstName[0] ?? "") + (row.clientLastName?.[0] ?? "")).toUpperCase();

  return {
    id: row.id,
    date,
    time,
    startsAtIso: startsAt.toISOString(),
    service: row.serviceName,
    category: row.serviceCategory as ServiceCategory,
    client: clientName,
    clientInitials: initials || "?",
    clientPhone: row.clientPhone ?? "",
    staff: row.staffFirstName ?? "",
    status: row.status as BookingStatus,
    durationMin: row.durationMinutes,
    price: row.totalInCents / 100,
    location: row.location ?? undefined,
    notes: row.clientNotes ?? undefined,
    clientId: row.clientId,
    serviceId: row.serviceId,
    staffId: row.staffId,
  };
}

interface WaitlistEntry {
  id: number;
  client: string;
  clientInitials: string;
  phone: string;
  service: string;
  category: ServiceCategory;
  datePreference: string;
  addedDate: string;
  status: WaitlistStatus;
  notes?: string;
}

const INITIAL_WAITLIST: WaitlistEntry[] = [
  {
    id: 1,
    client: "Naomi Blake",
    clientInitials: "NB",
    phone: "(404) 555-0201",
    service: "Volume Lashes — Full Set",
    category: "lash",
    datePreference: "ASAP",
    addedDate: "Feb 15",
    status: "waiting",
  },
  {
    id: 2,
    client: "Tyler Nguyen",
    clientInitials: "TN",
    phone: "(404) 555-0202",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    datePreference: "Weekends preferred",
    addedDate: "Feb 17",
    status: "contacted",
    notes: "Texted Feb 18 — awaiting reply",
  },
  {
    id: 3,
    client: "Zara Ahmed",
    clientInitials: "ZA",
    phone: "(404) 555-0203",
    service: "Mega Volume Lashes",
    category: "lash",
    datePreference: "Feb 25–28",
    addedDate: "Feb 18",
    status: "waiting",
  },
  {
    id: 4,
    client: "Deja Morris",
    clientInitials: "DM",
    phone: "(404) 555-0204",
    service: "Crochet Install",
    category: "crochet",
    datePreference: "Any Saturday",
    addedDate: "Feb 19",
    status: "booked",
    notes: "Booked for Mar 1 with Brianna",
  },
  {
    id: 5,
    client: "Renee Jackson",
    clientInitials: "RJ",
    phone: "(404) 555-0205",
    service: "Business Consulting",
    category: "consulting",
    datePreference: "Any Thursday",
    addedDate: "Feb 20",
    status: "waiting",
  },
];

const STATUS_FILTERS = [
  "All",
  "Confirmed",
  "Completed",
  "Pending",
  "Cancelled",
  "No Show",
] as const;
const PAGE_TABS = ["Bookings", "Waitlist"] as const;
type PageTab = (typeof PAGE_TABS)[number];

/* ------------------------------------------------------------------ */
/*  Display helpers                                                    */
/* ------------------------------------------------------------------ */

function statusConfig(status: BookingStatus) {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "in_progress":
      return { label: "In Progress", className: "bg-blush/12 text-[#96604a] border-blush/20" };
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-foreground/8 text-foreground border-foreground/15",
      };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
    case "no_show":
      return {
        label: "No Show",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

function waitlistStatusConfig(status: WaitlistStatus) {
  switch (status) {
    case "waiting":
      return { label: "Waiting", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "contacted":
      return {
        label: "Contacted",
        className: "bg-foreground/8 text-foreground border-foreground/15",
      };
    case "booked":
      return { label: "Booked", className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20" };
    case "removed":
      return { label: "Removed", className: "bg-foreground/5 text-muted border-foreground/10" };
  }
}

function categoryDot(category: ServiceCategory) {
  switch (category) {
    case "lash":
      return "bg-[#c4907a]";
    case "jewelry":
      return "bg-[#d4a574]";
    case "crochet":
      return "bg-[#7ba3a3]";
    case "consulting":
      return "bg-[#5b8a8a]";
    case "training":
      return "bg-[#9b7ec8]";
  }
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Booking Dialog                                                     */
/* ------------------------------------------------------------------ */

type BookingFormState = {
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

function BookingDialog({
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

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function BookingsPage({
  initialBookings,
  clients,
  serviceOptions,
  staffOptions,
}: {
  initialBookings: BookingRow[];
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
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>(() => initialBookings.map(mapBookingRow));
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(INITIAL_WAITLIST);
  const [pageTab, setPageTab] = useState<PageTab>("Bookings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  const filtered = bookings.filter((b) => {
    const matchSearch =
      !search ||
      b.client.toLowerCase().includes(search.toLowerCase()) ||
      b.service.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || statusConfig(b.status).label === statusFilter;
    return matchSearch && matchStatus;
  });

  const todayCount = bookings.filter((b) => b.date === "Today").length;
  const pendingCount = bookings.filter(
    (b) => b.status === "pending" || b.status === "confirmed",
  ).length;
  const revenue = bookings.filter((b) => b.status === "completed").reduce((s, b) => s + b.price, 0);
  const waitingCount = waitlist.filter((w) => w.status === "waiting").length;

  function openAdd() {
    setEditTarget(null);
    setDialogOpen(true);
  }
  function openEdit(b: Booking) {
    setEditTarget(b);
    setMenuOpen(null);
    setDialogOpen(true);
  }
  function handleDelete(id: number) {
    setBookings((prev) => prev.filter((b) => b.id !== id));
    setMenuOpen(null);
  }

  async function handleSave(data: BookingFormState) {
    if (editTarget) {
      // Update status in DB if it changed
      if (data.status !== editTarget.status) {
        await updateBookingStatus(editTarget.id, data.status);
      }
      // Optimistic local update for other fields
      setBookings((prev) =>
        prev.map((b) =>
          b.id === editTarget.id
            ? {
                ...b,
                status: data.status,
                location: data.location || undefined,
                notes: data.notes || undefined,
              }
            : b,
        ),
      );
    } else {
      if (!data.clientId || data.serviceId === "" || !data.date || !data.time) return;
      const startsAt = new Date(`${data.date}T${data.time}`);
      await createBooking({
        clientId: data.clientId,
        serviceId: Number(data.serviceId),
        staffId: data.staffId || null,
        startsAt,
        durationMinutes: data.durationMin,
        totalInCents: Math.round(data.price * 100),
        location: data.location || undefined,
        clientNotes: data.notes || undefined,
      } satisfies BookingInput);
      // Refresh to show the new booking from the DB
      router.refresh();
    }
  }

  function removeFromWaitlist(id: number) {
    setWaitlist((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status: "removed" as WaitlistStatus } : w)),
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Bookings</h1>
          <p className="text-sm text-muted mt-0.5">Manage appointments and scheduling</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Today</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{todayCount}</p>
            <p className="text-xs text-muted mt-0.5">appointments</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Upcoming</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{pendingCount}</p>
            <p className="text-xs text-muted mt-0.5">confirmed + pending</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Collected
            </p>
            <p className="text-2xl font-semibold text-foreground mt-1">
              ${revenue.toLocaleString()}
            </p>
            <p className="text-xs text-muted mt-0.5">completed this week</p>
          </CardContent>
        </Card>
        <Card className="py-4 gap-0">
          <CardContent className="px-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Waitlist</p>
            <p className="text-2xl font-semibold text-foreground mt-1">{waitingCount}</p>
            <p className="text-xs text-muted mt-0.5">clients waiting</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border">
        {PAGE_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setPageTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              pageTab === t
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t}
            {t === "Waitlist" && waitingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-accent text-white text-[9px] font-bold">
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Bookings tab ── */}
      {pageTab === "Bookings" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search client or service…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm bg-surface border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent/30 text-foreground placeholder:text-muted"
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      statusFilter === s
                        ? "bg-foreground text-background"
                        : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-3">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No bookings found.</p>
            ) : (
              <div className="space-y-0">
                {filtered.map((booking) => {
                  const status = statusConfig(booking.status);
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 group"
                    >
                      <div className="flex flex-col items-center gap-1 shrink-0 w-20">
                        <span
                          className={cn("w-1.5 h-1.5 rounded-full", categoryDot(booking.category))}
                        />
                        <span className="text-[10px] text-muted font-medium">{booking.date}</span>
                        <span className="text-[10px] text-muted/70 tabular-nums">
                          {booking.time}
                        </span>
                      </div>
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                          {booking.clientInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {booking.service}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {booking.client}
                          {booking.location && (
                            <span className="ml-2 inline-flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />
                              {booking.location}
                            </span>
                          )}
                        </p>
                        {booking.notes && (
                          <p className="text-[10px] text-muted/60 mt-0.5 truncate">
                            {booking.notes}
                          </p>
                        )}
                      </div>
                      <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-muted">{booking.staff}</span>
                        <span className="text-[10px] text-muted/60 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {booking.durationMin}m
                        </span>
                      </div>
                      <span className="text-sm font-medium text-foreground shrink-0 hidden sm:block w-12 text-right">
                        ${booking.price}
                      </span>
                      <Badge
                        className={cn(
                          "border text-[10px] px-1.5 py-0.5 shrink-0 w-20 justify-center",
                          status.className,
                        )}
                      >
                        {status.label}
                      </Badge>
                      <div className="relative shrink-0">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEdit(booking)}
                            className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setMenuOpen(menuOpen === booking.id ? null : booking.id)}
                            className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-foreground transition-colors"
                            title="More"
                          >
                            <MoreHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {menuOpen === booking.id && (
                          <div className="absolute right-0 top-full mt-1 bg-background border border-border rounded-lg shadow-lg py-1 z-20 w-32">
                            <button
                              onClick={() => openEdit(booking)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-foreground/5 transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5 text-muted" /> Edit
                            </button>
                            <button
                              onClick={() => handleDelete(booking.id)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/5 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Waitlist tab ── */}
      {pageTab === "Waitlist" && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-4 md:px-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Waitlist
                <span className="ml-2 text-xs text-muted font-normal">
                  {waitlist.filter((w) => w.status !== "removed").length} clients
                </span>
              </p>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add to Waitlist
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-3">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-4 md:px-5 pb-2.5">
                      Client
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden md:table-cell">
                      Service
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Date Pref.
                    </th>
                    <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5 hidden lg:table-cell">
                      Added
                    </th>
                    <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted px-3 pb-2.5">
                      Status
                    </th>
                    <th className="px-4 md:px-5 pb-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {waitlist.map((w) => {
                    const wStatus = waitlistStatusConfig(w.status);
                    return (
                      <tr
                        key={w.id}
                        className="border-b border-border/40 last:border-0 hover:bg-surface/60 transition-colors group"
                      >
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <Avatar size="sm">
                              <AvatarFallback className="text-[10px] bg-surface text-muted font-semibold">
                                {w.clientInitials}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium text-foreground">{w.client}</p>
                              <p className="text-[10px] text-muted flex items-center gap-0.5 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {w.phone}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell align-middle">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0",
                                categoryDot(w.category),
                              )}
                            />
                            <span className="text-xs text-muted">{w.service}</span>
                          </div>
                          {w.notes && (
                            <p className="text-[10px] text-muted/60 mt-0.5 pl-3">{w.notes}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <span className="text-xs text-foreground">{w.datePreference}</span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell align-middle">
                          <span className="text-xs text-muted">{w.addedDate}</span>
                        </td>
                        <td className="px-3 py-3 text-center align-middle">
                          <Badge
                            className={cn("border text-[10px] px-1.5 py-0.5", wStatus.className)}
                          >
                            {wStatus.label}
                          </Badge>
                        </td>
                        <td className="px-4 md:px-5 py-3 align-middle">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                            <button
                              onClick={() => openAdd()}
                              className="text-[11px] text-accent hover:underline font-medium"
                            >
                              Book
                            </button>
                            {w.status !== "removed" && (
                              <button
                                onClick={() => removeFromWaitlist(w.id)}
                                className="p-1.5 rounded-md hover:bg-foreground/8 text-muted hover:text-destructive transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <BookingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editTarget}
        clients={clients}
        serviceOptions={serviceOptions}
        staffOptions={staffOptions}
      />
    </div>
  );
}
