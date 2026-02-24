/**
 * ReviewCard.tsx — Client review display components for the booking storefront.
 *
 * Contains two components:
 * - `StarRating` — renders 1–5 filled/empty star icons.
 * - `ReviewCard` — a single approved + featured client review card.
 *
 * Neither component is interactive (no client state), but they are used inside
 * `BookingPage` which is a client component, so they inherit the client boundary
 * automatically. No "use client" directive is needed here.
 */

import { LuStar } from "react-icons/lu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { FeaturedReview } from "../types";

/**
 * StarRating — renders a row of 1–5 star icons in filled or empty state.
 *
 * Filled stars use amber-400; empty stars render in stone-200 to avoid
 * the visual weight of a full row of unfilled circles.
 *
 * @param rating - Integer from 1 to 5 inclusive.
 */
export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <LuStar
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= rating ? "fill-amber-400 text-amber-400" : "text-stone-200"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * ReviewCard — displays a single approved + featured client review.
 *
 * The client's first initial is shown as an avatar fallback — no client photos
 * are stored in the current schema, which is intentional for privacy.
 *
 * @param review - A single FeaturedReview from the `reviews` table.
 */
export function ReviewCard({ review }: { review: FeaturedReview }) {
  return (
    <div className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-rose-50 text-xs font-semibold text-rose-400">
              {review.clientFirstName[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-stone-800">{review.clientFirstName}</p>
            {review.serviceName && <p className="text-xs text-stone-400">{review.serviceName}</p>}
          </div>
        </div>
        <StarRating rating={review.rating} />
      </div>
      {review.body && (
        <p className="text-sm leading-relaxed text-stone-600">&ldquo;{review.body}&rdquo;</p>
      )}
    </div>
  );
}
