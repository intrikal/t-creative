"use client";

/**
 * ServiceCard.tsx — Bookable service card for the public booking storefront.
 *
 * ## CTA design: dual-button (Book + Waitlist)
 * Both "Book this service" and "Waitlist" are always shown side by side.
 * The waitlist is a slot-level concept — a specific time slot fills up, not an
 * entire service category — so it's incorrect to replace the primary Book CTA
 * based on a category-level waitlist flag. Clients should always be able to
 * attempt a booking AND signal waitlist interest at the same time.
 *
 * Phase 2: the "Book" button will open a calendar modal showing real availability.
 * When a specific slot is shown as full in the modal, the Book button will gray out
 * for that slot and Waitlist will become the primary action — all within the modal,
 * not here on the card.
 *
 * ## "Most popular" badge
 * Awarded to the first service (index === 0) in a category that has multiple services.
 * The admin controls which service is "first" via the `sort_order` field set during
 * the services step of onboarding. Phase 2 can replace this with a booking count
 * query from the `bookings` table.
 *
 * ## Add-ons display
 * Add-ons are pre-filtered by the server component into `addOnsByService[service.id]`
 * for O(1) lookup — no filtering on the client side.
 */

import { useState } from "react";
import { LuClock, LuFlame } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { BookingRequestDialog } from "../BookingRequestDialog";
import { formatPrice } from "../helpers";
import type { Service, ServiceAddOn } from "../types";

/**
 * ServiceCard — displays a single bookable service with add-ons and CTA buttons.
 *
 * @param service   - The service data from the `services` table.
 * @param meta      - Category display config (colors, border) from CATEGORY_META.
 * @param addOns    - Pre-filtered add-ons for this service.
 * @param isPopular - When true, renders the "Most popular" flame badge.
 */
export function ServiceCard({
  service,
  meta,
  addOns,
  isPopular,
}: {
  service: Service;
  meta: { color: string; bg: string; border: string };
  addOns: ServiceAddOn[];
  isPopular: boolean;
}) {
  const [showRequest, setShowRequest] = useState(false);

  return (
    <div
      className={`rounded-2xl border border-stone-100 border-l-4 ${meta.border} bg-white p-5 shadow-sm transition-shadow hover:shadow-md`}
    >
      {/* Name row — "Most popular" badge only renders when isPopular is true */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-stone-900">{service.name}</p>
            {isPopular && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-500 ring-1 ring-rose-100">
                <LuFlame className="h-2.5 w-2.5" />
                Most popular
              </span>
            )}
          </div>
          {service.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{service.description}</p>
          )}
        </div>
        <p className={`shrink-0 text-base font-semibold ${meta.color}`}>
          {formatPrice(service.priceInCents)}
        </p>
      </div>

      {/* Metadata chips — duration and deposit */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {service.durationMinutes && (
          <Badge variant="outline" className="text-stone-500">
            <LuClock className="h-3 w-3" />
            {service.durationMinutes} min
          </Badge>
        )}
        {service.depositInCents && (
          <Badge variant="outline" className="text-stone-500">
            {formatPrice(service.depositInCents)} deposit to hold
          </Badge>
        )}
      </div>

      {/* Add-ons — only rendered when this service has at least one active add-on */}
      {addOns.length > 0 && (
        <div className="mb-4 border-t border-stone-100 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
            Add-ons
          </p>
          <div className="flex flex-col gap-1.5">
            {addOns.map((addon) => (
              <div
                key={addon.id}
                className="flex items-center justify-between text-xs text-stone-500"
              >
                <span>
                  {addon.name}
                  {/* Only show duration modifier when it's non-zero */}
                  {addon.additionalMinutes > 0 && (
                    <span className="ml-1 text-stone-400">+{addon.additionalMinutes}min</span>
                  )}
                </span>
                <span className="font-medium text-stone-700">
                  +{formatPrice(addon.priceInCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book CTA */}
      <button
        onClick={() => setShowRequest(true)}
        className="w-full rounded-xl bg-stone-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-500 active:scale-[0.98]"
      >
        Book this service
      </button>

      <BookingRequestDialog
        service={service}
        open={showRequest}
        onClose={() => setShowRequest(false)}
      />
    </div>
  );
}
