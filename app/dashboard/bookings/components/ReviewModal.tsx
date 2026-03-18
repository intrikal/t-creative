/**
 * Modal for leaving a star rating and comment on a completed booking.
 *
 * Related: app/dashboard/bookings/ClientBookingsPage.tsx
 */
"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientBookingRow } from "../client-actions";

interface ReviewModalProps {
  booking: ClientBookingRow;
  onClose: () => void;
  onSubmit: (id: number, rating: number, text: string) => void;
  isPending: boolean;
}

export function ReviewModal({ booking, onClose, onSubmit, isPending }: ReviewModalProps) {
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
            onClick={() => onSubmit(booking.id, rating, text)}
            disabled={isPending}
            className="flex-1 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
