/**
 * Admin bookings page — full booking management with tabbed layout
 * (Bookings / Waitlist / Memberships), stat cards, search + status filters,
 * and lazy-loaded dialogs for create/edit, cancel, delete, service records,
 * waiver gating, and payment links.
 *
 * Parent: app/dashboard/bookings/page.tsx (admin role)
 *
 * State:
 *   allRows/hasMore   — raw booking rows from server, supports "load more" pagination
 *   bookings          — useOptimistic over allRows.map(mapBookingRow) for instant UI updates
 *   pageTab           — which tab is active (Bookings / Waitlist / Memberships)
 *   search            — free-text filter matching client name or service name
 *   statusFilter      — chip filter matching status label
 *   dialogOpen        — controls the create/edit BookingDialog
 *   editTarget        — the booking being edited (null = create mode)
 *   menuOpen          — which booking's overflow menu is open (by id)
 *   cancelTarget/Reason  — booking + reason for the cancel dialog
 *   deleteTarget      — booking for the delete confirmation dialog
 *   paymentTarget     — booking for the payment link dialog
 *   serviceNotesTarget — booking for the service record dialog
 *   waiverGateTarget/missingWaivers — booking blocked by unsigned waivers
 *
 * Key operations:
 *   filtered = bookings.filter(...)
 *     — applies search (case-insensitive .includes on client/service)
 *       and status filter (compares statusConfig label to filter string)
 *   todayCount/pendingCount/revenue/waitingCount
 *     — derived stats computed from bookings array using .filter() and .reduce()
 *   handleQuickStatus — checks waivers before confirming, uses optimistic update
 *   buildFullRRule    — assembles RRULE from base frequency + UNTIL date or COUNT
 *   handleSave        — branches on editTarget to call updateBooking or createBooking
 *   loadMore          — fetches next page of bookings, appends to allRows
 *
 * Dynamic imports:
 *   BookingDialog, CancelDialog, DeleteDialog, ServiceRecordDialog,
 *   WaiverGateDialog, PaymentChoiceDialog — all lazy-loaded to reduce
 *   initial bundle size since they're only needed on interaction.
 */
"use client";

import { type ReactNode, useState, useOptimistic, useTransition, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Search,
  Plus,
  CalendarDays,
  CalendarCheck,
  DollarSign,
  ListOrdered,
  CalendarX,
  Download,
  Ban,
} from "lucide-react";
import { BulkActionBar } from "@/components/ui/BulkActionBar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { useBulkSelect } from "@/lib/hooks/use-bulk-select";
import type { BookingRow, BookingInput } from "@/lib/types/booking.types";
import { cn } from "@/lib/utils";
import {
  updateBookingStatus,
  createBooking,
  createRecurringBooking,
  updateBooking,
  deleteBooking,
  cancelBookingSeries,
  getBookings,
} from "./actions";
import type { BookingFormState } from "./components/BookingDialog";
import { BookingRow as BookingRowComponent } from "./components/BookingRow";
import {
  statusConfig,
  mapBookingRow,
  STATUS_FILTERS,
  PAGE_TABS,
  type Booking,
  type BookingStatus,
  type PageTab,
} from "./components/helpers";
import { WaitlistTab } from "./components/WaitlistTab";
import type { MissingWaiver } from "./waiver-actions";
import { checkBookingWaivers } from "./waiver-actions";

const PaymentChoiceDialog = dynamic(
  () => import("@/components/booking/PaymentChoiceDialog").then((m) => m.PaymentChoiceDialog),
  { ssr: false },
);
const BookingDialog = dynamic(
  () => import("./components/BookingDialog").then((m) => m.BookingDialog),
  { ssr: false },
);
const CancelDialog = dynamic(
  () => import("./components/CancelDialog").then((m) => m.CancelDialog),
  { ssr: false },
);
const DeleteDialog = dynamic(
  () => import("./components/DeleteDialog").then((m) => m.DeleteDialog),
  { ssr: false },
);
const ServiceRecordDialog = dynamic(
  () => import("./components/ServiceRecordDialog").then((m) => m.ServiceRecordDialog),
  { ssr: false },
);
const WaiverGateDialog = dynamic(
  () => import("./components/WaiverGateDialog").then((m) => m.WaiverGateDialog),
  { ssr: false },
);

/* Re-export types & helpers so existing imports from this module still work */
export { statusConfig, categoryDot } from "./components/helpers";
export type { Booking, BookingStatus, ServiceCategory } from "./components/helpers";

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function BookingsPage({
  initialBookings,
  initialHasMore = false,
  serviceOptions,
  staffOptions,
  activeSubscriptions = [],
  membershipsContent,
}: {
  initialBookings: BookingRow[];
  initialHasMore?: boolean;
  serviceOptions: {
    id: number;
    name: string;
    category: string;
    durationMinutes: number;
    priceInCents: number;
    depositInCents: number;
  }[];
  staffOptions: { id: string; name: string }[];
  activeSubscriptions?: { id: number; clientId: string; name: string; sessionsRemaining: number }[];
  membershipsContent?: ReactNode;
}) {
  const [isPending, startTransition] = useTransition();
  const [allRows, setAllRows] = useState(initialBookings);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [bookings, addOptimistic] = useOptimistic<
    Booking[],
    { type: "update_status"; id: number; status: BookingStatus } | { type: "delete"; id: number }
  >(allRows.map(mapBookingRow), (state, action) => {
    switch (action.type) {
      case "update_status":
        return state.map((b) => (b.id === action.id ? { ...b, status: action.status } : b));
      case "delete":
        return state.filter((b) => b.id !== action.id);
    }
  });
  const [pageTab, setPageTab] = useState<PageTab>("Bookings");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showRecurringOnly, setShowRecurringOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Booking | null>(null);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const handleCancelReasonChange = useCallback((reason: string) => {
    setCancelReason(reason);
  }, []);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Booking | null>(null);
  const [serviceNotesTarget, setServiceNotesTarget] = useState<Booking | null>(null);
  const [waiverGateTarget, setWaiverGateTarget] = useState<Booking | null>(null);
  const [missingWaivers, setMissingWaivers] = useState<MissingWaiver[]>([]);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const filtered = bookings.filter((b) => {
    const matchSearch =
      !search ||
      b.client.toLowerCase().includes(search.toLowerCase()) ||
      b.service.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || statusConfig(b.status).label === statusFilter;
    const matchRecurring = !showRecurringOnly || !!b.recurrenceRule;
    return matchSearch && matchStatus && matchRecurring;
  });

  // Bulk selection — operates on the filtered list so pruning works when filters change
  const {
    selectedIds,
    isSelected,
    toggle: toggleSelect,
    selectAll,
    clearSelection,
    isAllSelected,
    isPartialSelected,
    selectedCount,
  } = useBulkSelect(filtered);

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

    // Check waivers before confirming
    if (status === "confirmed") {
      try {
        const result = await checkBookingWaivers(booking.id);
        if (!result.passed) {
          setMissingWaivers(result.missing);
          setWaiverGateTarget(booking);
          return;
        }
      } catch {
        // If waiver check fails, proceed with server-side enforcement as fallback
      }
    }

    startTransition(async () => {
      addOptimistic({ type: "update_status", id: booking.id, status });
      const result = await updateBookingStatus(booking.id, status);
      if (!result.success) setMutationError(result.error);
    });

    // Show payment choice dialog when confirming a booking
    if (status === "confirmed") {
      setPaymentTarget({ ...booking, status: "confirmed" });
    }
  }

  function openCancelDialog(booking: Booking) {
    setCancelTarget(booking);
    setCancelReason("");
    setMenuOpen(null);
  }

  async function handleConfirmCancel() {
    if (!cancelTarget) return;
    const targetId = cancelTarget.id;
    const reason = cancelReason || undefined;
    setCancelTarget(null);
    setCancelReason("");
    startTransition(async () => {
      addOptimistic({ type: "update_status", id: targetId, status: "cancelled" });
      const result = await updateBookingStatus(targetId, "cancelled", reason);
      if (!result.success) setMutationError(result.error);
    });
  }

  function openDeleteConfirm(booking: Booking) {
    setDeleteTarget(booking);
    setMenuOpen(null);
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      addOptimistic({ type: "delete", id: targetId });
      const result = await deleteBooking(targetId);
      if (!result.success) setMutationError(result.error);
    });
  }

  function buildFullRRule(baseFreq: string, endDate: string, maxOcc: string): string | undefined {
    if (!baseFreq) return undefined;
    let rule = baseFreq;
    if (endDate) rule += `;UNTIL=${endDate.replace(/-/g, "")}T000000Z`;
    else if (maxOcc) rule += `;COUNT=${maxOcc}`;
    return rule;
  }

  async function handleSave(data: BookingFormState) {
    const recurrenceRule = buildFullRRule(
      data.recurrenceRule,
      data.seriesEndDate,
      data.seriesMaxOccurrences,
    );
    if (editTarget) {
      if (!data.clientId || data.serviceId === "" || !data.date || !data.time) return;
      const startsAt = new Date(`${data.date}T${data.time}`);
      startTransition(async () => {
        const result = await updateBooking(editTarget.id, {
          clientId: data.clientId,
          serviceId: Number(data.serviceId),
          staffId: data.staffId || null,
          startsAt,
          durationMinutes: data.durationMin,
          totalInCents: Math.round(data.price * 100),
          location: data.location || undefined,
          clientNotes: data.notes || undefined,
          recurrenceRule,
          status: data.status,
        });
        if (!result.success) setMutationError(result.error);
      });
    } else {
      if (!data.clientId || data.serviceId === "" || !data.date || !data.time) return;
      const startsAt = new Date(`${data.date}T${data.time}`);
      startTransition(async () => {
        const input: BookingInput = {
          clientId: data.clientId,
          serviceId: Number(data.serviceId),
          staffId: data.staffId || null,
          startsAt,
          durationMinutes: data.durationMin,
          totalInCents: Math.round(data.price * 100),
          location: data.location || undefined,
          clientNotes: data.notes || undefined,
          recurrenceRule,
          subscriptionId: data.subscriptionId !== "" ? Number(data.subscriptionId) : undefined,
        };

        if (recurrenceRule) {
          // Batch-create all recurring bookings upfront
          const result = await createRecurringBooking(input);
          if (!result.success) {
            setMutationError(result.error);
          } else if (result.skipped.length > 0) {
            setMutationError(
              `Created ${result.created} bookings. Skipped ${result.skipped.length} date(s) due to conflicts: ${result.skipped.join(", ")}`,
            );
          }
        } else {
          const result = await createBooking(input);
          if (!result.success) setMutationError(result.error);
        }
      });
    }
  }

  async function handleCancelSeries(booking: Booking) {
    setMenuOpen(null);
    startTransition(async () => {
      addOptimistic({ type: "update_status", id: booking.id, status: "cancelled" });
      const result = await cancelBookingSeries(booking.id);
      if (!result.success) setMutationError(result.error);
    });
  }

  async function removeFromWaitlist(id: number) {
    startTransition(async () => {
      addOptimistic({ type: "update_status", id, status: "cancelled" });
      const result = await updateBookingStatus(id, "cancelled");
      if (!result.success) setMutationError(result.error);
    });
  }

  function handleBulkExport() {
    const selected = filtered.filter((b) => isSelected(b.id));
    const headers = [
      "Client",
      "Service",
      "Date",
      "Time",
      "Staff",
      "Status",
      "Price",
      "Location",
      "Notes",
    ];
    const rows = selected.map((b) => [
      b.client,
      b.service,
      b.date,
      b.time,
      b.staff,
      b.status,
      `$${b.price}`,
      b.location ?? "",
      b.notes ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkCancel() {
    setBulkCancelOpen(false);
    const ids = [...selectedIds].map(Number);
    const results = await Promise.allSettled(ids.map((id) => updateBookingStatus(id, "cancelled")));
    const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
    const failed = results.length - succeeded;
    clearSelection();
    setBulkMessage(
      failed > 0
        ? `${succeeded} cancelled, ${failed} failed`
        : `${succeeded} booking${succeeded !== 1 ? "s" : ""} cancelled`,
    );
    setTimeout(() => setBulkMessage(null), 4000);
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const { rows, hasMore: more } = await getBookings({ offset: allRows.length });
      setAllRows((prev) => [...prev, ...rows]);
      setHasMore(more);
    } finally {
      setLoadingMore(false);
    }
  }

  /* ---- Render ---- */

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {mutationError && (
        <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{mutationError}</span>
          <button
            onClick={() => setMutationError(null)}
            className="ml-4 text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Bookings
          </h1>
          <p className="text-sm text-muted mt-0.5">Manage appointments and scheduling</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          New Booking
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            label: "Today",
            value: String(todayCount),
            sub: "appointments",
            icon: CalendarDays,
            iconColor: "text-blush",
            iconBg: "bg-blush/10",
          },
          {
            label: "Upcoming",
            value: String(pendingCount),
            sub: "confirmed + pending",
            icon: CalendarCheck,
            iconColor: "text-accent",
            iconBg: "bg-accent/10",
          },
          {
            label: "Collected",
            value: `$${revenue.toLocaleString()}`,
            sub: "completed this week",
            icon: DollarSign,
            iconColor: "text-[#4e6b51]",
            iconBg: "bg-[#4e6b51]/10",
          },
          {
            label: "Waitlist",
            value: String(waitingCount),
            sub: "clients waiting",
            icon: ListOrdered,
            iconColor: "text-[#7a5c10]",
            iconBg: "bg-[#7a5c10]/10",
          },
        ].map(({ label, value, sub, icon: Icon, iconColor, iconBg }) => (
          <Card key={label} className="gap-0 py-0">
            <CardContent className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted truncate">
                    {label}
                  </p>
                  <p className="text-lg font-semibold text-foreground tracking-tight">{value}</p>
                  <p className="text-xs text-muted truncate">{sub}</p>
                </div>
                <div className={cn("rounded-xl p-2 shrink-0", iconBg)}>
                  <Icon className={cn("w-4 h-4", iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
              <button
                onClick={() => setShowRecurringOnly(!showRecurringOnly)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  showRecurringOnly
                    ? "bg-foreground text-background"
                    : "bg-surface text-muted hover:bg-foreground/8 hover:text-foreground",
                )}
              >
                Recurring
              </button>
            </div>
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-3">
            {bulkMessage && (
              <div className="p-3 mb-3 bg-accent/10 border border-accent/20 text-xs text-accent rounded-lg">
                {bulkMessage}
              </div>
            )}
            {filtered.length > 0 && (
              <div className="flex items-center gap-2 pb-2 mb-1 border-b border-border/50">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = isPartialSelected;
                  }}
                  onChange={() => (isAllSelected ? clearSelection() : selectAll())}
                  aria-label={isAllSelected ? "Deselect all bookings" : "Select all bookings"}
                  className="h-4 w-4 rounded border-border accent-accent cursor-pointer"
                />
                <span className="text-xs text-muted">
                  {selectedCount > 0 ? `${selectedCount} selected` : "Select all"}
                </span>
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="py-10 text-center">
                <CalendarX className="w-7 h-7 text-foreground/15 mx-auto mb-2" />
                <p className="text-sm text-muted/60 font-medium">
                  {search || statusFilter !== "All" || showRecurringOnly
                    ? "No bookings match your filters"
                    : "No bookings yet"}
                </p>
                <p className="text-xs text-muted/40 mt-0.5">
                  {search || statusFilter !== "All"
                    ? "Try adjusting your search or filter."
                    : "Create your first booking to get started."}
                </p>
                {!search && statusFilter === "All" && (
                  <button
                    onClick={openAdd}
                    className="text-xs text-accent hover:underline mt-2 inline-block"
                  >
                    New Booking
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-0">
                  {filtered.map((booking) => (
                    <BookingRowComponent
                      key={booking.id}
                      booking={booking}
                      selected={isSelected(booking.id)}
                      onToggleSelect={toggleSelect}
                      menuOpen={menuOpen === booking.id}
                      onToggleMenu={() => setMenuOpen(menuOpen === booking.id ? null : booking.id)}
                      onEdit={() => openEdit(booking)}
                      onQuickStatus={(status) => handleQuickStatus(booking, status)}
                      onCancel={() => openCancelDialog(booking)}
                      onDelete={() => openDeleteConfirm(booking)}
                      onPayment={() => {
                        setPaymentTarget(booking);
                        setMenuOpen(null);
                      }}
                      onServiceNotes={() => {
                        setServiceNotesTarget(booking);
                        setMenuOpen(null);
                      }}
                      onCancelSeries={() => handleCancelSeries(booking)}
                    />
                  ))}
                </div>
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="px-4 py-2 text-sm font-medium text-muted hover:text-foreground bg-surface border border-border rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-50"
                    >
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                )}
              </>
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
          serviceOptions={serviceOptions}
        />
      )}

      {/* Memberships tab */}
      {pageTab === "Memberships" && membershipsContent}

      <BookingDialog
        key={editTarget?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editTarget}
        initialClientName={editTarget?.client ?? undefined}
        serviceOptions={serviceOptions}
        staffOptions={staffOptions}
        activeSubscriptions={activeSubscriptions}
      />

      <CancelDialog
        target={cancelTarget}
        reason={cancelReason}
        onReasonChange={handleCancelReasonChange}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />

      <DeleteDialog
        target={deleteTarget}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {serviceNotesTarget && (
        <ServiceRecordDialog
          open
          onClose={() => setServiceNotesTarget(null)}
          bookingId={serviceNotesTarget.id}
          clientId={serviceNotesTarget.clientId}
          serviceName={serviceNotesTarget.service}
          serviceCategory={serviceNotesTarget.category}
        />
      )}

      <WaiverGateDialog
        target={waiverGateTarget}
        missingWaivers={missingWaivers}
        onClose={() => {
          setWaiverGateTarget(null);
          setMissingWaivers([]);
        }}
        onWaiversSent={() => {
          // Waiver link sent — admin should wait for client to complete
        }}
      />

      {paymentTarget &&
        (() => {
          const svc = serviceOptions.find((s) => s.id === paymentTarget.serviceId);
          return (
            <PaymentChoiceDialog
              open
              onClose={() => setPaymentTarget(null)}
              bookingId={paymentTarget.id}
              serviceName={paymentTarget.service}
              totalInCents={Math.round(paymentTarget.price * 100)}
              depositInCents={svc?.depositInCents ?? null}
            />
          );
        })()}

      {/* Bulk action bar */}
      <BulkActionBar selectedCount={selectedCount} onClear={clearSelection}>
        <button
          type="button"
          onClick={handleBulkExport}
          className="flex items-center gap-1.5 text-sm font-medium text-background/90 hover:text-background transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <button
          type="button"
          onClick={() => setBulkCancelOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-red-300 hover:text-red-200 transition-colors"
        >
          <Ban className="w-3.5 h-3.5" /> Cancel
        </button>
      </BulkActionBar>

      {/* Bulk cancel confirmation */}
      {bulkCancelOpen && (
        <Dialog
          open
          onClose={() => setBulkCancelOpen(false)}
          title="Cancel Bookings"
          description={`Cancel ${selectedCount} selected booking${selectedCount !== 1 ? "s" : ""}? This will trigger refund processing and notify clients via email.`}
        >
          <DialogFooter
            onCancel={() => setBulkCancelOpen(false)}
            onConfirm={handleBulkCancel}
            confirmLabel="Cancel Bookings"
            destructive
          />
        </Dialog>
      )}
    </div>
  );
}
