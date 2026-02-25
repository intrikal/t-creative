"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateBookingStatus, createBooking, updateBooking, deleteBooking } from "./actions";
import type { BookingRow, BookingInput } from "./actions";
import { BookingDialog, type BookingFormState } from "./components/BookingDialog";
import { BookingRow as BookingRowComponent } from "./components/BookingRow";
import { CancelDialog } from "./components/CancelDialog";
import { DeleteDialog } from "./components/DeleteDialog";
import { WaitlistTab } from "./components/WaitlistTab";

/* ------------------------------------------------------------------ */
/*  Exported types & helpers (used by child components)                */
/* ------------------------------------------------------------------ */

export type BookingStatus =
  | "completed"
  | "in_progress"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "no_show";
export type ServiceCategory = "lash" | "jewelry" | "crochet" | "consulting" | "training";

export interface Booking {
  id: number;
  date: string;
  time: string;
  startsAtIso: string;
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
  clientId: string;
  serviceId: number;
  staffId: string | null;
}

export function statusConfig(status: BookingStatus) {
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

export function categoryDot(category: ServiceCategory) {
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

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

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
  const [pageTab, setPageTab] = useState<PageTab>("Bookings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);

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
  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const waitingCount = pendingBookings.length;

  /* ---- Handlers ---- */

  function openAdd() {
    setEditTarget(null);
    setDialogOpen(true);
  }
  function openEdit(b: Booking) {
    setEditTarget(b);
    setMenuOpen(null);
    setDialogOpen(true);
  }

  async function handleQuickStatus(booking: Booking, status: BookingStatus) {
    setMenuOpen(null);
    await updateBookingStatus(booking.id, status);
    setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
  }

  function openCancelDialog(booking: Booking) {
    setCancelTarget(booking);
    setCancelReason("");
    setMenuOpen(null);
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    await updateBookingStatus(cancelTarget.id, "cancelled", cancelReason || undefined);
    setBookings((prev) =>
      prev.map((b) =>
        b.id === cancelTarget.id ? { ...b, status: "cancelled" as BookingStatus } : b,
      ),
    );
    setCancelTarget(null);
    setCancelReason("");
  }

  function openDeleteConfirm(booking: Booking) {
    setDeleteTarget(booking);
    setMenuOpen(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    await deleteBooking(deleteTarget.id);
    setBookings((prev) => prev.filter((b) => b.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function handleSave(data: BookingFormState) {
    if (editTarget) {
      if (!data.clientId || data.serviceId === "" || !data.date || !data.time) return;
      const startsAt = new Date(`${data.date}T${data.time}`);
      await updateBooking(editTarget.id, {
        clientId: data.clientId,
        serviceId: Number(data.serviceId),
        staffId: data.staffId || null,
        startsAt,
        durationMinutes: data.durationMin,
        totalInCents: Math.round(data.price * 100),
        location: data.location || undefined,
        clientNotes: data.notes || undefined,
        status: data.status,
      });
      router.refresh();
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
      router.refresh();
    }
  }

  async function removeFromWaitlist(id: number) {
    await updateBookingStatus(id, "cancelled");
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" as BookingStatus } : b)),
    );
  }

  /* ---- Render ---- */

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

      {/* Bookings tab */}
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
                {filtered.map((booking) => (
                  <BookingRowComponent
                    key={booking.id}
                    booking={booking}
                    menuOpen={menuOpen === booking.id}
                    onToggleMenu={() => setMenuOpen(menuOpen === booking.id ? null : booking.id)}
                    onEdit={() => openEdit(booking)}
                    onQuickStatus={(status) => handleQuickStatus(booking, status)}
                    onCancel={() => openCancelDialog(booking)}
                    onDelete={() => openDeleteConfirm(booking)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Waitlist tab */}
      {pageTab === "Waitlist" && (
        <WaitlistTab
          pendingBookings={pendingBookings}
          onBook={openAdd}
          onRemove={removeFromWaitlist}
        />
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

      <CancelDialog
        target={cancelTarget}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />

      <DeleteDialog
        target={deleteTarget}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
