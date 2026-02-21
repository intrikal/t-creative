"use client";

/**
 * BookingsPage — Full bookings list with filters, add/edit dialog, and waitlist.
 *
 * All data is hardcoded. Replace INITIAL_BOOKINGS / INITIAL_WAITLIST with
 * server actions / fetch when the API is ready.
 */

import { useState } from "react";
import { Clock, MapPin, Search, Plus, Pencil, Trash2, MoreHorizontal, Phone } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, Field, Input, Textarea, Select, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

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

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: 1,
    date: "Today",
    time: "10:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Sarah Mitchell",
    clientInitials: "SM",
    clientPhone: "(404) 555-0101",
    staff: "Trini",
    status: "completed",
    durationMin: 120,
    price: 180,
  },
  {
    id: 2,
    date: "Today",
    time: "12:00 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Maya Robinson",
    clientInitials: "MR",
    clientPhone: "(404) 555-0102",
    staff: "Trini",
    status: "in_progress",
    durationMin: 90,
    price: 95,
  },
  {
    id: 3,
    date: "Today",
    time: "1:00 PM",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    client: "Priya Kumar",
    clientInitials: "PK",
    clientPhone: "(404) 555-0103",
    staff: "Jasmine",
    status: "confirmed",
    durationMin: 45,
    price: 65,
    location: "Studio",
  },
  {
    id: 4,
    date: "Today",
    time: "2:30 PM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Chloe Thompson",
    clientInitials: "CT",
    clientPhone: "(404) 555-0104",
    staff: "Trini",
    status: "confirmed",
    durationMin: 75,
    price: 95,
  },
  {
    id: 5,
    date: "Today",
    time: "4:00 PM",
    service: "Business Consulting",
    category: "consulting",
    client: "Marcus Banks",
    clientInitials: "MB",
    clientPhone: "(404) 555-0105",
    staff: "Trini",
    status: "confirmed",
    durationMin: 60,
    price: 150,
    location: "Virtual",
  },
  {
    id: 6,
    date: "Today",
    time: "5:30 PM",
    service: "Custom Crochet Pickup",
    category: "crochet",
    client: "Amy Lin",
    clientInitials: "AL",
    clientPhone: "(404) 555-0106",
    staff: "Trini",
    status: "pending",
    durationMin: 30,
    price: 40,
  },
  {
    id: 7,
    date: "Tomorrow",
    time: "9:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Tiffany Brown",
    clientInitials: "TB",
    clientPhone: "(404) 555-0107",
    staff: "Trini",
    status: "confirmed",
    durationMin: 120,
    price: 180,
  },
  {
    id: 8,
    date: "Tomorrow",
    time: "11:00 AM",
    service: "Mega Volume Lashes",
    category: "lash",
    client: "Destiny Cruz",
    clientInitials: "DC",
    clientPhone: "(404) 555-0108",
    staff: "Jasmine",
    status: "confirmed",
    durationMin: 150,
    price: 220,
  },
  {
    id: 9,
    date: "Tomorrow",
    time: "2:00 PM",
    service: "Permanent Jewelry Party",
    category: "jewelry",
    client: "Keisha Williams",
    clientInitials: "KW",
    clientPhone: "(404) 555-0109",
    staff: "Trini",
    status: "pending",
    durationMin: 90,
    price: 200,
    notes: "Party of 4, need extra supplies",
  },
  {
    id: 10,
    date: "Feb 22",
    time: "10:30 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Jordan Lee",
    clientInitials: "JL",
    clientPhone: "(404) 555-0110",
    staff: "Trini",
    status: "confirmed",
    durationMin: 75,
    price: 95,
  },
  {
    id: 11,
    date: "Feb 22",
    time: "1:30 PM",
    service: "HR Consulting",
    category: "consulting",
    client: "Aaliyah Washington",
    clientInitials: "AW",
    clientPhone: "(404) 555-0111",
    staff: "Trini",
    status: "confirmed",
    durationMin: 90,
    price: 200,
    location: "Virtual",
  },
  {
    id: 12,
    date: "Feb 19",
    time: "3:00 PM",
    service: "Volume Lashes — Fill",
    category: "lash",
    client: "Nina Patel",
    clientInitials: "NP",
    clientPhone: "(404) 555-0112",
    staff: "Jasmine",
    status: "cancelled",
    durationMin: 90,
    price: 130,
  },
  {
    id: 13,
    date: "Feb 18",
    time: "10:00 AM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    client: "Amara Johnson",
    clientInitials: "AJ",
    clientPhone: "(404) 555-0113",
    staff: "Trini",
    status: "completed",
    durationMin: 120,
    price: 180,
  },
  {
    id: 14,
    date: "Feb 18",
    time: "12:30 PM",
    service: "Permanent Jewelry Weld",
    category: "jewelry",
    client: "Camille Foster",
    clientInitials: "CF",
    clientPhone: "(404) 555-0114",
    staff: "Trini",
    status: "completed",
    durationMin: 45,
    price: 65,
  },
  {
    id: 15,
    date: "Feb 17",
    time: "11:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    client: "Tanya Brown",
    clientInitials: "TB2",
    clientPhone: "(404) 555-0115",
    staff: "Jasmine",
    status: "no_show",
    durationMin: 75,
    price: 95,
  },
];

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
const STAFF_OPTIONS = ["Trini", "Jasmine", "Jordan", "Kiera"];
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

const EMPTY_FORM = {
  client: "",
  clientPhone: "",
  service: "",
  category: "lash" as ServiceCategory,
  date: "",
  time: "",
  staff: "Trini",
  status: "confirmed" as BookingStatus,
  durationMin: 60,
  price: 0,
  location: "",
  notes: "",
};

function BookingDialog({
  open,
  onClose,
  onSave,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (b: Omit<Booking, "id" | "clientInitials">) => void;
  initial?: Booking | null;
}) {
  const [form, setForm] = useState(
    initial
      ? {
          client: initial.client,
          clientPhone: initial.clientPhone,
          service: initial.service,
          category: initial.category,
          date: initial.date,
          time: initial.time,
          staff: initial.staff,
          status: initial.status,
          durationMin: initial.durationMin,
          price: initial.price,
          location: initial.location ?? "",
          notes: initial.notes ?? "",
        }
      : EMPTY_FORM,
  );

  const [lastInitial, setLastInitial] = useState(initial);
  if (initial !== lastInitial) {
    setLastInitial(initial);
    setForm(
      initial
        ? {
            client: initial.client,
            clientPhone: initial.clientPhone,
            service: initial.service,
            category: initial.category,
            date: initial.date,
            time: initial.time,
            staff: initial.staff,
            status: initial.status,
            durationMin: initial.durationMin,
            price: initial.price,
            location: initial.location ?? "",
            notes: initial.notes ?? "",
          }
        : EMPTY_FORM,
    );
  }

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const valid = form.client.trim() && form.service.trim() && form.date.trim() && form.time.trim();

  function handleSave() {
    if (!valid) return;
    onSave({
      client: form.client.trim(),
      clientPhone: form.clientPhone.trim(),
      service: form.service.trim(),
      category: form.category,
      date: form.date.trim(),
      time: form.time.trim(),
      staff: form.staff,
      status: form.status,
      durationMin: Number(form.durationMin),
      price: Number(form.price),
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? "Edit Booking" : "New Booking"}
      description={
        initial ? "Update appointment details." : "Add a new appointment to the schedule."
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client Name" required>
            <Input
              placeholder="e.g. Sarah Mitchell"
              value={form.client}
              onChange={(e) => set("client", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input
              placeholder="(404) 555-0100"
              value={form.clientPhone}
              onChange={(e) => set("clientPhone", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Service" required>
            <Input
              placeholder="e.g. Volume Lashes — Full Set"
              value={form.service}
              onChange={(e) => set("service", e.target.value)}
            />
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => set("category", e.target.value)}>
              <option value="lash">Lash</option>
              <option value="jewelry">Jewelry</option>
              <option value="crochet">Crochet</option>
              <option value="consulting">Consulting</option>
              <option value="training">Training</option>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" required>
            <Input
              placeholder="e.g. Today, Tomorrow, Feb 25"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </Field>
          <Field label="Time" required>
            <Input
              placeholder="e.g. 10:00 AM"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Staff">
            <Select value={form.staff} onChange={(e) => set("staff", e.target.value)}>
              {STAFF_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
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
              onChange={(e) => set("durationMin", e.target.value)}
            />
          </Field>
          <Field label="Price ($)">
            <Input
              type="number"
              min={0}
              step={5}
              value={form.price}
              onChange={(e) => set("price", e.target.value)}
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
        onConfirm={handleSave}
        confirmLabel={initial ? "Save Changes" : "Add Booking"}
        disabled={!valid}
      />
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>(INITIAL_BOOKINGS);
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

  function handleSave(data: Omit<Booking, "id" | "clientInitials">) {
    if (editTarget) {
      setBookings((prev) =>
        prev.map((b) =>
          b.id === editTarget.id ? { ...b, ...data, clientInitials: initials(data.client) } : b,
        ),
      );
    } else {
      setBookings((prev) => [
        { ...data, id: Date.now(), clientInitials: initials(data.client) },
        ...prev,
      ]);
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
      />
    </div>
  );
}
