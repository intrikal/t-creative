/**
 * Expandable card for a single booking row (upcoming or past).
 * Shows service, time, status badge, and expand/collapse detail panel
 * with reschedule, cancel, and review actions.
 *
 * Related:
 * - app/dashboard/bookings/ClientBookingsPage.tsx (parent)
 * - ./client-helpers.ts (statusConfig, CAT_DOT)
 */
"use client";

import { Clock, ChevronDown, ChevronUp, Download, MapPin, Plus, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ClientBookingRow } from "@/lib/types/booking.types";
import { statusConfig, CAT_DOT } from "./client-helpers";

function hoursUntilBooking(startsAtISO: string): number {
  return (new Date(startsAtISO).getTime() - Date.now()) / (1000 * 60 * 60);
}

export function BookingCard({
  booking,
  isExpanded,
  onToggle,
  onReschedule,
  onCancel,
  onReview,
  cancelWindowHours = 48,
}: {
  booking: ClientBookingRow;
  isExpanded: boolean;
  onToggle: () => void;
  onReschedule: (booking: ClientBookingRow) => void;
  onCancel: (booking: ClientBookingRow) => void;
  onReview: (booking: ClientBookingRow) => void;
  cancelWindowHours?: number;
}) {
  const sts = statusConfig(booking.status);
  const isCancellable =
    (booking.status === "pending" || booking.status === "confirmed") &&
    hoursUntilBooking(booking.startsAtISO) >= cancelWindowHours;

  return (
    <div className="border-b border-border/40 last:border-0">
      <button className="w-full text-left hover:bg-surface/60 transition-colors" onClick={onToggle}>
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
            {booking.location && (
              <div>
                <p className="text-muted font-medium">Location</p>
                <p className="text-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-muted" />
                  {booking.location}
                </p>
              </div>
            )}
          </div>

          {/* Add-ons */}
          {booking.addOns.length > 0 && (
            <div className="text-xs">
              <p className="text-muted font-medium mb-1">Add-ons</p>
              <div className="space-y-0.5">
                {booking.addOns.map((a, i) => (
                  <p key={i} className="text-foreground flex items-center gap-1.5">
                    <Plus className="w-2.5 h-2.5 text-muted" />
                    {a.name}
                    <span className="text-muted">${(a.priceInCents / 100).toFixed(0)}</span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {booking.notes && (
            <p className="text-xs text-muted italic border-l-2 border-border pl-3">
              {booking.notes}
            </p>
          )}

          {/* Reschedule / cancel actions for upcoming bookings */}
          {isCancellable && (
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReschedule(booking);
                }}
                className="text-xs font-medium text-accent hover:text-accent/80 transition-colors"
              >
                Reschedule
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(booking);
                }}
                className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
              >
                Cancel appointment
              </button>
            </div>
          )}

          {/* Review actions for completed bookings */}
          {booking.status === "completed" && !booking.reviewLeft && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReview(booking);
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

          {/* Download receipt for completed bookings */}
          {booking.status === "completed" && (
            <a
              href={`/api/receipts/${booking.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download receipt
            </a>
          )}
        </div>
      )}
    </div>
  );
}
