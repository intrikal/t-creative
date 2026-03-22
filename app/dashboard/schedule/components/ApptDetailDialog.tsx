/**
 * ApptDetailDialog — Read-only appointment detail overlay.
 *
 * Shows the service name, date, time range, client or guest count,
 * company name (for events), location, price, and notes. Used across
 * all schedule views when an appointment chip/row is clicked.
 */
"use client";

import { Building2, Clock, MapPin, Users } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { AppointmentRow } from "@/lib/types/booking.types";
import { parseDate, fmt12, DAY_NAMES_SHORT, MONTH_NAMES, CATEGORY_COLORS } from "./helpers";

const CATEGORY_LABELS: Record<string, string> = {
  lash: "Lash",
  jewelry: "Jewelry",
  crochet: "Crochet",
  consulting: "Consulting",
};

export function ApptDetailDialog({ appt, onClose }: { appt: AppointmentRow; onClose: () => void }) {
  const c = CATEGORY_COLORS[appt.category];
  const d = parseDate(appt.date);

  // Compute end time by converting start HH:MM to total minutes,
  // adding the duration, then converting back to HH:MM format
  const endMin =
    parseInt(appt.startTime24.split(":")[0]) * 60 +
    parseInt(appt.startTime24.split(":")[1]) +
    appt.durationMin;
  const endH = Math.floor(endMin / 60);
  const endM = endMin % 60;
  const endTime24 = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

  return (
    <Dialog open title={appt.service} onClose={onClose}>
      <div className="space-y-4">
        <span
          className="inline-block text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: c.bg, color: c.text, outline: `1px solid ${c.border}40` }}
        >
          {CATEGORY_LABELS[appt.category] ?? appt.category}
        </span>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <span className="w-4 h-4 shrink-0 text-center text-xs">📅</span>
            <span>
              {DAY_NAMES_SHORT[d.getDay()]}, {MONTH_NAMES[d.getMonth()]} {d.getDate()},{" "}
              {d.getFullYear()}
            </span>
          </div>
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {fmt12(appt.startTime24)} – {fmt12(endTime24)} · {appt.durationMin} min
            </span>
          </div>
          {appt.companyName && (
            <div className="flex items-center gap-2.5 text-sm text-muted">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>{appt.companyName}</span>
            </div>
          )}
          <div className="flex items-center gap-2.5 text-sm text-muted">
            <Users className="w-4 h-4 shrink-0" />
            <span>
              {appt.kind === "event"
                ? appt.guestCount != null
                  ? `${appt.guestCount} guests`
                  : "Group Event"
                : appt.client}
            </span>
          </div>
          {appt.location && appt.kind === "event" && (
            <div className="flex items-center gap-2.5 text-sm text-foreground font-medium">
              <MapPin className="w-4 h-4 shrink-0 text-muted" />
              <span>{appt.location}</span>
            </div>
          )}
          {appt.price > 0 && (
            <div className="flex items-center gap-2.5 text-sm text-foreground font-semibold">
              <span className="w-4 text-center">$</span>
              <span>${appt.price}</span>
            </div>
          )}
          {appt.notes && (
            <p className="text-sm text-muted bg-surface rounded-lg p-3 border border-border italic">
              {appt.notes}
            </p>
          )}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}
