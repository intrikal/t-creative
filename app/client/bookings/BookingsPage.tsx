"use client";

import { useState, useMemo } from "react";
import {
  CalendarDays,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Star,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Date helpers                                                        */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const DAY_NAMES = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_NAMES_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TODAY_ISO = "2026-02-21";

function fmtISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = addDays(first, -first.getDay());
  const end = addDays(last, 6 - last.getDay());
  const days: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

function fmtDateLabel(ds: string): string {
  const [y, m, d] = ds.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES_FULL[date.getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

/* ------------------------------------------------------------------ */
/*  Types & data                                                        */
/* ------------------------------------------------------------------ */

type BookingStatus = "confirmed" | "pending" | "completed" | "cancelled";

interface Booking {
  id: number;
  dateISO: string;
  date: string;
  time: string;
  service: string;
  category: "lash" | "jewelry" | "crochet";
  assistant: string;
  durationMin: number;
  price: number;
  status: BookingStatus;
  notes?: string;
  reviewLeft?: boolean;
}

const BOOKINGS: Booking[] = [
  {
    id: 1,
    dateISO: "2026-02-28",
    date: "Sat, Feb 28, 2026",
    time: "10:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    assistant: "Jasmine",
    durationMin: 90,
    price: 75,
    status: "confirmed",
  },
  {
    id: 2,
    dateISO: "2026-02-01",
    date: "Sat, Feb 1, 2026",
    time: "11:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    assistant: "Jasmine",
    durationMin: 90,
    price: 75,
    status: "completed",
    reviewLeft: true,
  },
  {
    id: 3,
    dateISO: "2026-01-18",
    date: "Sat, Jan 18, 2026",
    time: "12:00 PM",
    service: "Volume Lashes — Full Set",
    category: "lash",
    assistant: "Jasmine",
    durationMin: 120,
    price: 140,
    status: "completed",
    reviewLeft: false,
  },
  {
    id: 4,
    dateISO: "2026-01-04",
    date: "Sat, Jan 4, 2026",
    time: "10:00 AM",
    service: "Classic Lash Fill",
    category: "lash",
    assistant: "Jasmine",
    durationMin: 90,
    price: 75,
    status: "completed",
    reviewLeft: true,
  },
  {
    id: 5,
    dateISO: "2025-12-21",
    date: "Sat, Dec 21, 2025",
    time: "11:30 AM",
    service: "Classic Lash Fill",
    category: "lash",
    assistant: "Jasmine",
    durationMin: 90,
    price: 75,
    status: "completed",
    reviewLeft: true,
  },
  {
    id: 6,
    dateISO: "2025-12-07",
    date: "Sat, Dec 7, 2025",
    time: "10:00 AM",
    service: "Permanent Jewelry — Chain Bracelet",
    category: "jewelry",
    assistant: "Jasmine",
    durationMin: 30,
    price: 65,
    status: "completed",
    reviewLeft: false,
  },
];

/* ------------------------------------------------------------------ */
/*  Status / category helpers                                           */
/* ------------------------------------------------------------------ */

function statusConfig(status: BookingStatus) {
  switch (status) {
    case "confirmed":
      return {
        label: "Confirmed",
        className: "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20",
      };
    case "pending":
      return { label: "Pending", className: "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20" };
    case "completed":
      return { label: "Completed", className: "bg-foreground/8 text-muted border-foreground/10" };
    case "cancelled":
      return {
        label: "Cancelled",
        className: "bg-destructive/10 text-destructive border-destructive/20",
      };
  }
}

const CAT_DOT: Record<Booking["category"], string> = {
  lash: "bg-[#c4907a]",
  jewelry: "bg-[#d4a574]",
  crochet: "bg-[#7ba3a3]",
};

const CAT_COLOR: Record<Booking["category"], string> = {
  lash: "#c4907a",
  jewelry: "#d4a574",
  crochet: "#7ba3a3",
};

/* ------------------------------------------------------------------ */
/*  Review modal                                                        */
/* ------------------------------------------------------------------ */

interface ReviewModalProps {
  booking: Booking;
  onClose: () => void;
  onSubmit: (id: number, rating: number, text: string) => void;
}

function ReviewModal({ booking, onClose, onSubmit }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/20 backdrop-blur-sm">
      <div className="bg-background rounded-2xl border border-border shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Leave a Review</p>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-foreground">{booking.service}</p>
            <p className="text-[11px] text-muted mt-0.5">
              with {booking.assistant} · {booking.date}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted font-medium">Rating</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => setRating(s)}>
                  <Star
                    className={cn(
                      "w-6 h-6 transition-colors",
                      s <= rating ? "text-[#d4a574] fill-[#d4a574]" : "text-border",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted font-medium">Comment (optional)</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share your experience..."
              rows={3}
              className="w-full text-sm text-foreground placeholder:text-muted/50 bg-surface border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-border flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm font-medium text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onSubmit(booking.id, rating, text);
              onClose();
            }}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mini calendar — shows booking dots, acts as date filter            */
/* ------------------------------------------------------------------ */

function BookingsMiniCal({
  bookings,
  selected,
  onSelect,
}: {
  bookings: Booking[];
  selected: string | null;
  onSelect: (d: string | null) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date(2026, 1, 1)); // Feb 2026
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  // Map dateISO → unique categories for dot display
  const byDate = useMemo(() => {
    const map: Record<string, Booking["category"][]> = {};
    for (const b of bookings) {
      if (!map[b.dateISO]) map[b.dateISO] = [];
      if (!map[b.dateISO].includes(b.category)) {
        map[b.dateISO].push(b.category);
      }
    }
    return map;
  }, [bookings]);

  return (
    <Card className="gap-0">
      <CardHeader className="pb-0 pt-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Appointment Calendar</CardTitle>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg text-muted hover:bg-foreground/8 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-foreground px-1 min-w-[110px] text-center">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg text-muted hover:bg-foreground/8 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-muted/60 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7">
          {grid.map((day) => {
            const ds = fmtISO(day);
            const isCurrentMonth = day.getMonth() === month;
            const isToday = ds === TODAY_ISO;
            const isSelected = ds === selected;
            const cats = byDate[ds] || [];
            const hasBookings = cats.length > 0;

            return (
              <div
                key={ds}
                className={cn("flex flex-col items-center py-0.5", !isCurrentMonth && "invisible")}
              >
                <button
                  onClick={() => hasBookings && onSelect(isSelected ? null : ds)}
                  className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors",
                    isSelected && "bg-accent text-white",
                    !isSelected && isToday && "ring-1 ring-accent text-accent font-semibold",
                    !isSelected &&
                      !isToday &&
                      hasBookings &&
                      "text-foreground hover:bg-foreground/8 cursor-pointer",
                    !isSelected && !isToday && !hasBookings && "text-muted/35 cursor-default",
                  )}
                >
                  {day.getDate()}
                </button>
                {/* Category dots */}
                <div className="flex gap-0.5 h-1.5 mt-0.5">
                  {cats.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="w-1 h-1 rounded-full"
                      style={{ background: CAT_COLOR[cat] }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dot legend */}
        <div className="flex gap-4 mt-3 pt-3 border-t border-border/40">
          {(["lash", "jewelry", "crochet"] as const).map((cat) => (
            <span key={cat} className="flex items-center gap-1.5 text-[10px] text-muted capitalize">
              <span className="w-2 h-2 rounded-full" style={{ background: CAT_COLOR[cat] }} />
              {cat}
            </span>
          ))}
          {selected && (
            <button
              onClick={() => onSelect(null)}
              className="ml-auto text-[10px] text-accent hover:underline"
            >
              Show all
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                         */
/* ------------------------------------------------------------------ */

export function ClientBookingsPage() {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [bookings, setBookings] = useState<Booking[]>(BOOKINGS);
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Unfiltered totals for stats
  const allUpcoming = bookings.filter((b) => ["confirmed", "pending"].includes(b.status));
  const allCompleted = bookings.filter((b) => b.status === "completed");

  // Filtered lists for display
  const upcoming = allUpcoming.filter((b) => !selectedDate || b.dateISO === selectedDate);
  const past = bookings
    .filter((b) => ["completed", "cancelled"].includes(b.status))
    .filter((b) => !selectedDate || b.dateISO === selectedDate);

  function submitReview(id: number, _rating: number, _text: string) {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, reviewLeft: true } : b)));
  }

  function BookingCard({ booking }: { booking: Booking }) {
    const isExpanded = expanded === booking.id;
    const sts = statusConfig(booking.status);

    return (
      <div className="border-b border-border/40 last:border-0">
        <button
          className="w-full text-left hover:bg-surface/60 transition-colors"
          onClick={() => setExpanded(isExpanded ? null : booking.id)}
        >
          <div className="flex items-center gap-3 px-5 py-3.5">
            <span
              className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-0.5", CAT_DOT[booking.category])}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{booking.service}</p>
              <p className="text-xs text-muted mt-0.5 flex items-center gap-2">
                <span>{booking.date}</span>
                <span className="flex items-center gap-0.5 text-muted/60">
                  <Clock className="w-2.5 h-2.5" />
                  {booking.time}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-semibold text-foreground hidden sm:block">
                ${booking.price}
              </span>
              <Badge className={cn("border text-[10px] px-1.5 py-0.5", sts.className)}>
                {sts.label}
              </Badge>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-muted" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-muted" />
              )}
            </div>
          </div>
        </button>

        {isExpanded && (
          <div className="px-5 pb-4 pt-1 bg-surface/30 border-t border-border/30 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted font-medium">Service</p>
                <p className="text-foreground mt-0.5">{booking.service}</p>
              </div>
              <div>
                <p className="text-muted font-medium">Assistant</p>
                <p className="text-foreground mt-0.5">{booking.assistant}</p>
              </div>
              <div>
                <p className="text-muted font-medium">Date & Time</p>
                <p className="text-foreground mt-0.5">
                  {booking.date} at {booking.time}
                </p>
              </div>
              <div>
                <p className="text-muted font-medium">Duration</p>
                <p className="text-foreground mt-0.5">{booking.durationMin} min</p>
              </div>
              <div>
                <p className="text-muted font-medium">Price</p>
                <p className="text-foreground font-semibold mt-0.5">${booking.price}</p>
              </div>
            </div>
            {booking.notes && (
              <p className="text-xs text-muted italic border-l-2 border-border pl-3">
                {booking.notes}
              </p>
            )}
            {booking.status === "completed" && !booking.reviewLeft && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setReviewTarget(booking);
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-[#d4a574] hover:text-[#c49060] transition-colors"
              >
                <Star className="w-3.5 h-3.5" />
                Leave a review
              </button>
            )}
            {booking.status === "completed" && booking.reviewLeft && (
              <p className="text-xs text-muted flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-[#d4a574] fill-[#d4a574]" />
                Review submitted — thank you!
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">My Bookings</h1>
        <p className="text-sm text-muted mt-0.5">Your appointment history with T Creative Studio</p>
      </div>

      {/* Stats — always unfiltered */}
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
      <BookingsMiniCal bookings={bookings} selected={selectedDate} onSelect={setSelectedDate} />

      {/* Active date filter label */}
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
              <BookingCard key={b.id} booking={b} />
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
              <BookingCard key={b.id} booking={b} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state when date selected but no bookings */}
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

      {/* Review modal */}
      {reviewTarget && (
        <ReviewModal
          booking={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmit={submitReview}
        />
      )}
    </div>
  );
}
