"use client";

import { useState, useTransition, useCallback } from "react";
import { CalendarDays, Rss, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientBookingRow, ClientBookingsData } from "./client-actions";
import { submitClientReview, cancelClientBooking, rescheduleClientBooking } from "./client-actions";
import { fmtDateLabel } from "./components/client-helpers";
import { BookingsMiniCal } from "./components/BookingsMiniCal";
import { BookingCard } from "./components/BookingCard";
import { CalendarSubscribeModal } from "./components/CalendarSubscribeModal";
import { ReviewModal } from "./components/ReviewModal";
import { CancelBookingModal } from "./components/CancelBookingModal";
import { RescheduleModal } from "./components/RescheduleModal";

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientBookingsPage({ data }: { data: ClientBookingsData }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [bookings, setBookings] = useState<ClientBookingRow[]>(data.bookings);
  const [reviewTarget, setReviewTarget] = useState<ClientBookingRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ClientBookingRow | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<ClientBookingRow | null>(null);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCalSubscribe, setShowCalSubscribe] = useState(false);
  const [isPending, startTransition] = useTransition();
  const handleSelectDate = useCallback((date: string | null) => {
    setSelectedDate(date);
  }, []);
  const handleReschedule = useCallback((booking: ClientBookingRow) => {
    setRescheduleTarget(booking);
  }, []);
  const handleCancel = useCallback((booking: ClientBookingRow) => {
    setCancelTarget(booking);
  }, []);
  const handleReview = useCallback((booking: ClientBookingRow) => {
    setReviewTarget(booking);
  }, []);

  const allUpcoming = bookings.filter((b) => ["confirmed", "pending"].includes(b.status));
  const allCompleted = bookings.filter((b) => b.status === "completed");

  const upcoming = allUpcoming.filter((b) => !selectedDate || b.dateISO === selectedDate);
  const past = bookings
    .filter((b) => ["completed", "cancelled"].includes(b.status))
    .filter((b) => !selectedDate || b.dateISO === selectedDate);

  function handleSubmitReview(id: number, rating: number, text: string) {
    // Optimistic update
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, reviewLeft: true } : b)));
    setReviewTarget(null);

    startTransition(async () => {
      await submitClientReview({ bookingId: id, rating, comment: text });
    });
  }

  function handleCancelBooking(id: number) {
    // Optimistic update
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" as const } : b)),
    );
    setCancelTarget(null);
    setCancelError(null);

    startTransition(async () => {
      try {
        await cancelClientBooking(id);
      } catch (err) {
        // Revert optimistic update and surface the error
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: (b.status === "cancelled"
                    ? "confirmed"
                    : b.status) as ClientBookingRow["status"],
                }
              : b,
          ),
        );
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setCancelTarget(bookings.find((b) => b.id === id) ?? null);
        setCancelError(msg);
      }
    });
  }

  function handleRescheduleBooking(id: number, newStartsAt: string) {
    setRescheduleTarget(null);
    setRescheduleError(null);

    startTransition(async () => {
      try {
        await rescheduleClientBooking(id, newStartsAt);
        // Reflect the new time optimistically — status reverts to pending
        setBookings((prev) =>
          prev.map((b) =>
            b.id === id
              ? {
                  ...b,
                  status: "pending" as const,
                  startsAtISO: newStartsAt,
                  date: new Date(newStartsAt).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }),
                  time: new Date(newStartsAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  }),
                }
              : b,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setRescheduleTarget(bookings.find((b) => b.id === id) ?? null);
        setRescheduleError(msg);
      }
    });
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">My Bookings</h1>
          <p className="text-sm text-muted mt-0.5">
            Your appointment history with T Creative Studio
          </p>
        </div>
        <button
          onClick={() => setShowCalSubscribe(true)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted hover:text-foreground hover:bg-surface transition-colors"
        >
          <Rss className="w-3.5 h-3.5" />
          Subscribe
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Visits", value: allCompleted.length },
          { label: "Upcoming", value: allUpcoming.length },
          { label: "Total Spent", value: `$${allCompleted.reduce((s, b) => s + b.price, 0)}` },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4 text-center">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Calendar */}
      <BookingsMiniCal bookings={bookings} selected={selectedDate} onSelect={handleSelectDate} />

      {/* Active date filter */}
      {selectedDate && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">
            Showing{" "}
            <span className="text-foreground font-medium">{fmtDateLabel(selectedDate)}</span>
          </p>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-0.5"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-accent" />
              <CardTitle className="text-sm font-semibold">Upcoming</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-2">
            {upcoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                isExpanded={expanded === b.id}
                onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
                onReschedule={handleReschedule}
                onCancel={handleCancel}
                onReview={handleReview}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Past visits */}
      {past.length > 0 && (
        <Card className="gap-0">
          <CardHeader className="pb-0 pt-4 px-5">
            <CardTitle className="text-sm font-semibold">Past Visits</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-2">
            {past.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                isExpanded={expanded === b.id}
                onToggle={() => setExpanded(expanded === b.id ? null : b.id)}
                onReschedule={handleReschedule}
                onCancel={handleCancel}
                onReview={handleReview}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {selectedDate && upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-14 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">No bookings on {fmtDateLabel(selectedDate)}.</p>
          <button
            onClick={() => setSelectedDate(null)}
            className="text-xs text-accent mt-1.5 hover:underline"
          >
            View all bookings
          </button>
        </div>
      )}

      {/* No bookings at all */}
      {bookings.length === 0 && !selectedDate && (
        <div className="text-center py-14 border border-dashed border-border rounded-xl">
          <CalendarDays className="w-10 h-10 text-foreground/15 mx-auto mb-3" />
          <p className="text-sm text-muted">No bookings yet.</p>
          <p className="text-xs text-muted/60 mt-1">Your appointments will appear here.</p>
        </div>
      )}

      {/* Calendar subscribe modal */}
      {showCalSubscribe && (
        <CalendarSubscribeModal url={data.calendarUrl} onClose={() => setShowCalSubscribe(false)} />
      )}

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleSubmitReview}
          isPending={isPending}
        />
      )}

      {/* Cancel modal */}
      {cancelTarget && (
        <CancelBookingModal
          booking={cancelTarget}
          onClose={() => {
            setCancelTarget(null);
            setCancelError(null);
          }}
          onConfirm={handleCancelBooking}
          isPending={isPending}
          errorMsg={cancelError}
        />
      )}

      {/* Reschedule modal */}
      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          onClose={() => {
            setRescheduleTarget(null);
            setRescheduleError(null);
          }}
          onConfirm={handleRescheduleBooking}
          isPending={isPending}
          errorMsg={rescheduleError}
        />
      )}
    </div>
  );
}
