/**
 * @file EventCard.tsx
 * @description Expandable card displaying a single event with summary info, guest list,
 *   corporate billing details, and action buttons (edit, delete, send invite).
 */

"use client";

import { useState, useTransition } from "react";
import {
  MapPin,
  Users,
  DollarSign,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  UserPlus,
  Mail,
  X,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventRow } from "../actions";
import { AddGuestDialog } from "./AddGuestDialog";
import { TYPE_CONFIG, statusConfig, formatDateRange, centsToDisplay } from "./helpers";

export function EventCard({
  event,
  onEdit,
  onDelete,
  onAddGuest,
  onToggleGuestPaid,
  onRemoveGuest,
  onSendInvite,
}: {
  event: EventRow;
  onEdit: () => void;
  onDelete: () => void;
  onAddGuest: (guest: { name: string; service: string; paid: boolean }) => void;
  onToggleGuestPaid: (guestId: number) => void;
  onRemoveGuest: (guestId: number) => void;
  onSendInvite: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [guestDialogOpen, setGuestDialogOpen] = useState(false);
  const [isSendingInvite, startInviteTransition] = useTransition();
  const type = TYPE_CONFIG[event.eventType];
  const status = statusConfig(event.status);
  const paidCount = event.guests.filter((g) => g.paid).length;
  const revDisplay = centsToDisplay(event.expectedRevenueInCents);
  const depDisplay = centsToDisplay(event.depositInCents);
  const travelDisplay = centsToDisplay(event.travelFeeInCents);
  const displayLocation = event.venueName ?? event.location;

  return (
    <>
      <Card className="gap-0">
        <CardContent className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div
              className={cn("w-1.5 self-stretch rounded-full shrink-0 min-h-[2.5rem]", type.dot)}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{event.title}</h3>
                    <Badge
                      className={cn("border text-[10px] px-1.5 py-0.5 shrink-0", status.className)}
                    >
                      {status.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span
                      className={cn(
                        "text-[11px] font-medium px-1.5 py-0.5 rounded-full border",
                        type.bg,
                        type.text,
                        type.border,
                      )}
                    >
                      {type.label}
                    </span>
                    <span className="text-xs text-muted flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {formatDateRange(event.startsAt, event.endsAt)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted transition-colors shrink-0"
                >
                  {expanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {event.companyName && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <Building2 className="w-3 h-3 shrink-0" />
                    {event.companyName}
                  </span>
                )}
                {displayLocation && (
                  <span className="text-xs text-muted flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    {displayLocation}
                  </span>
                )}
                <span className="text-xs text-muted flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {event.guests.length}
                  {event.maxAttendees != null && `/${event.maxAttendees}`}
                  {event.guests.length > 0 && ` · ${paidCount} paid`}
                </span>
                {revDisplay && (
                  <span className="text-xs font-medium text-[#4e6b51] flex items-center gap-1">
                    <DollarSign className="w-3 h-3" />
                    {revDisplay}
                    {depDisplay && (
                      <span className="text-muted font-normal">({depDisplay} deposit)</span>
                    )}
                  </span>
                )}
                {travelDisplay && (
                  <span className="text-xs text-muted">+ {travelDisplay} travel</span>
                )}
              </div>
            </div>
          </div>

          {expanded && (
            <div className="mt-4 pt-4 border-t border-border/60 space-y-4">
              {event.internalNotes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {event.internalNotes}
                  </p>
                </div>
              )}

              {event.equipmentNotes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1">
                    Equipment
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {event.equipmentNotes}
                  </p>
                </div>
              )}

              {(event.billingEmail || event.poNumber) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-1.5 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    Corporate Billing
                  </p>
                  <div className="space-y-1">
                    {event.billingEmail && (
                      <p className="text-sm text-foreground/80 flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-muted shrink-0" />
                        {event.billingEmail}
                      </p>
                    )}
                    {event.poNumber && (
                      <p className="text-sm text-foreground/80">
                        <span className="text-muted">PO#</span> {event.poNumber}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Guest list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Guests ({event.guests.length}
                    {event.maxAttendees != null && `/${event.maxAttendees}`})
                  </p>
                  {(event.maxAttendees == null || event.guests.length < event.maxAttendees) && (
                    <button
                      onClick={() => setGuestDialogOpen(true)}
                      className="flex items-center gap-1 text-xs text-accent hover:opacity-80 transition-opacity"
                    >
                      <UserPlus className="w-3 h-3" /> Add guest
                    </button>
                  )}
                </div>
                {event.guests.length > 0 ? (
                  <div className="space-y-1.5">
                    {event.guests.map((g) => (
                      <div key={g.id} className="flex items-center gap-3 text-xs">
                        <span className="flex-1 text-foreground">{g.name}</span>
                        <span className="text-muted">{g.service}</span>
                        <button
                          onClick={() => onToggleGuestPaid(g.id)}
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full border transition-colors",
                            g.paid
                              ? "bg-[#4e6b51]/12 text-[#4e6b51] border-[#4e6b51]/20 hover:bg-[#4e6b51]/20"
                              : "bg-[#7a5c10]/10 text-[#7a5c10] border-[#7a5c10]/20 hover:bg-[#7a5c10]/20",
                          )}
                        >
                          {g.paid ? "Paid" : "Unpaid"}
                        </button>
                        <button
                          onClick={() => onRemoveGuest(g.id)}
                          className="text-muted hover:text-destructive transition-colors"
                          aria-label="Remove guest"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted">No guests added yet.</p>
                )}
              </div>

              <div className="flex gap-2 pt-1 flex-wrap">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Edit event
                </button>
                {event.contactEmail && (
                  <button
                    onClick={() => startInviteTransition(onSendInvite)}
                    disabled={isSendingInvite}
                    className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-foreground/5 transition-colors disabled:opacity-50"
                  >
                    <Mail className="w-3 h-3" /> {isSendingInvite ? "Sending…" : "Send Invite"}
                  </button>
                )}
                <button
                  onClick={onDelete}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-destructive px-2.5 py-1.5 rounded-lg hover:bg-destructive/5 transition-colors ml-auto"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AddGuestDialog
        key={`guest-${event.id}-${guestDialogOpen}`}
        open={guestDialogOpen}
        onClose={() => setGuestDialogOpen(false)}
        onAdd={onAddGuest}
      />
    </>
  );
}
