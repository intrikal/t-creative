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
import type React from "react";
import { LuClock, LuFlame } from "react-icons/lu";
import { Badge } from "@/components/ui/badge";
import { BookingRequestDialog } from "../BookingRequestDialog";
import { formatPrice } from "../helpers";
import type { Service, ServiceAddOn } from "../types";
import { WaitlistDialog } from "../WaitlistDialog";

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
  autoOpen,
  prefillDate,
  prefillTime,
  prefillStaffId,
}: {
  service: Service;
  meta: {
    color: string;
    bg: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  addOns: ServiceAddOn[];
  isPopular: boolean;
  /** When true, auto-opens the booking dialog on mount (from ?service=ID link). */
  autoOpen?: boolean;
  prefillDate?: string | null;
  prefillTime?: string | null;
  prefillStaffId?: string | null;
}) {
  const [showRequest, setShowRequest] = useState(autoOpen ?? false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const Icon = meta.icon;

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border border-stone-200 border-l-4 ${meta.border} bg-white shadow-sm transition-shadow hover:shadow-md`}
    >
      {/* Top accent line */}
      <div className="h-1 w-full bg-[#e8c4b8]" />
      {/* Icon + price row */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${meta.bg}`}>
          <Icon className={`h-4 w-4 ${meta.color}`} />
        </div>
        <div className="text-right">
          <p className={`text-lg font-bold ${meta.color}`}>{formatPrice(service.priceInCents)}</p>
          {service.depositInCents && (
            <p className="text-[10px] text-stone-400">
              {formatPrice(service.depositInCents)} deposit
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-5 pb-5">
        {/* Name + popular badge */}
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <p className="font-semibold text-stone-900">{service.name}</p>
          {isPopular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#faf6f1] px-2 py-0.5 text-[10px] font-semibold text-[#96604a] ring-1 ring-[#e8c4b8]">
              <LuFlame className="h-2.5 w-2.5" />
              Popular
            </span>
          )}
        </div>

        {service.description && (
          <p className="mb-3 text-xs leading-relaxed text-stone-500">{service.description}</p>
        )}

        {/* Duration chip */}
        {service.durationMinutes && (
          <div className="mb-3">
            <Badge variant="outline" className="text-stone-500">
              <LuClock className="h-3 w-3" />
              {service.durationMinutes} min
            </Badge>
          </div>
        )}

        {/* Add-ons — only rendered when this service has at least one active add-on */}
        {addOns.length > 0 && (
          <div className="mb-4 rounded-xl bg-stone-50 px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
              Add-ons
            </p>
            <div className="flex flex-col gap-1">
              {addOns.map((addon) => (
                <div
                  key={addon.id}
                  className="flex items-center justify-between text-xs text-stone-500"
                >
                  <span>
                    {addon.name}
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

        {/* Spacer to push CTAs to bottom */}
        <div className="flex-1" />

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowRequest(true)}
            className="flex-1 rounded-xl bg-[#96604a] py-3 text-sm font-semibold text-white transition-colors hover:bg-[#7a4e3a] active:scale-[0.98]"
          >
            Book
          </button>
          <button
            onClick={() => setShowWaitlist(true)}
            className="rounded-xl border border-stone-200 px-3.5 py-3 text-xs font-medium text-stone-500 transition-colors hover:border-[#e8c4b8] hover:text-[#96604a] hover:bg-[#faf6f1] active:scale-[0.98]"
            title="Join waitlist"
          >
            Waitlist
          </button>
        </div>
      </div>

      <BookingRequestDialog
        service={service}
        addOns={addOns}
        open={showRequest}
        onClose={() => setShowRequest(false)}
        prefillDate={prefillDate}
        prefillTime={prefillTime}
        prefillStaffId={prefillStaffId}
      />

      <WaitlistDialog
        service={service}
        open={showWaitlist}
        onClose={() => setShowWaitlist(false)}
      />
    </div>
  );
}
