"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Plus, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventRow, EventType, VenueRow } from "./actions";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  addGuest,
  removeGuest,
  toggleGuestPaid,
  sendEventRsvpInvite,
  createVenue,
  updateVenue,
} from "./actions";
import { EventCard } from "./components/EventCard";
import { EventDialog } from "./components/EventDialog";
import {
  TYPE_CONFIG,
  dollarsToCents,
  emptyEventForm,
  eventToForm,
  formToInput,
  venueFormToInput,
} from "./components/helpers";
import type { EventForm, VenueForm } from "./components/types";
import { VenuesDialog } from "./components/VenuesDialog";

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function EventsPage({
  initialEvents,
  initialVenues,
}: {
  initialEvents: EventRow[];
  initialVenues: VenueRow[];
}) {
  const [events, setEvents] = useOptimistic<EventRow[]>(initialEvents);
  const [venues, setVenues] = useOptimistic<VenueRow[]>(initialVenues);
  const [filter, setFilter] = useState<"all" | EventType>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [venuesDialogOpen, setVenuesDialogOpen] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = filter === "all" ? events : events.filter((e) => e.eventType === filter);
  const upcoming = events.filter((e) => e.status === "upcoming" || e.status === "confirmed");
  const totalRevenue = events.reduce((s, e) => s + (e.expectedRevenueInCents ?? 0), 0);

  function openNew() {
    setEditingEvent(null);
    setDialogOpen(true);
  }
  function openEdit(e: EventRow) {
    setEditingEvent(e);
    setDialogOpen(true);
  }

  function handleSave(form: EventForm) {
    const input = formToInput(form);
    const venue = input.venueId ? venues.find((v) => v.id === input.venueId) : null;
    const resolvedLocation = venue ? venue.name : (input.location ?? null);

    if (editingEvent) {
      startTransition(async () => {
        setEvents((prev) =>
          prev.map((e) =>
            e.id === editingEvent.id
              ? {
                  ...e,
                  title: input.title,
                  eventType: input.eventType,
                  status: input.status,
                  startsAt: input.startsAt,
                  endsAt: input.endsAt ?? null,
                  venueId: input.venueId ?? null,
                  venueName: venue?.name ?? null,
                  location: resolvedLocation,
                  maxAttendees: input.maxAttendees ?? null,
                  expectedRevenueInCents: input.expectedRevenueInCents ?? null,
                  depositInCents: input.depositInCents ?? null,
                  travelFeeInCents: input.travelFeeInCents ?? null,
                  internalNotes: input.internalNotes ?? null,
                  equipmentNotes: input.equipmentNotes ?? null,
                  companyName: input.companyName ?? null,
                  billingEmail: input.billingEmail ?? null,
                  poNumber: input.poNumber ?? null,
                }
              : e,
          ),
        );
        await updateEvent(editingEvent.id, input);
      });
    } else {
      startTransition(async () => {
        setEvents((prev) => [
          {
            id: -1,
            title: input.title,
            eventType: input.eventType,
            status: input.status,
            startsAt: input.startsAt,
            endsAt: input.endsAt ?? null,
            venueId: input.venueId ?? null,
            venueName: venue?.name ?? null,
            location: resolvedLocation,
            address: venue?.address ?? null,
            maxAttendees: input.maxAttendees ?? null,
            expectedRevenueInCents: input.expectedRevenueInCents ?? null,
            depositInCents: input.depositInCents ?? null,
            travelFeeInCents: input.travelFeeInCents ?? null,
            contactName: null,
            contactEmail: null,
            contactPhone: null,
            services: input.services ?? null,
            internalNotes: input.internalNotes ?? null,
            equipmentNotes: input.equipmentNotes ?? null,
            description: null,
            companyName: input.companyName ?? null,
            billingEmail: input.billingEmail ?? null,
            poNumber: input.poNumber ?? null,
            guests: [],
          },
          ...prev,
        ]);
        await createEvent(input);
      });
    }
  }

  function handleDelete(id: number) {
    startTransition(async () => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      await deleteEvent(id);
    });
  }

  function handleAddGuest(
    eventId: number,
    guest: { name: string; service: string; paid: boolean },
  ) {
    startTransition(async () => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                guests: [
                  ...e.guests,
                  {
                    id: -1,
                    name: guest.name,
                    service: guest.service || null,
                    paid: guest.paid,
                  },
                ],
              }
            : e,
        ),
      );
      await addGuest(eventId, guest);
    });
  }

  function handleToggleGuestPaid(eventId: number, guestId: number) {
    startTransition(async () => {
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? {
                ...e,
                guests: e.guests.map((g) => (g.id === guestId ? { ...g, paid: !g.paid } : g)),
              }
            : e,
        ),
      );
      await toggleGuestPaid(guestId);
    });
  }

  function handleCreateVenue(form: VenueForm) {
    startTransition(async () => {
      const newVenue: VenueRow = {
        id: -1,
        name: form.name,
        venueType: form.venueType,
        address: form.address || null,
        parkingInfo: form.parkingInfo || null,
        setupNotes: form.setupNotes || null,
        defaultTravelFeeInCents: dollarsToCents(form.travelFee),
        isActive: true,
      };
      setVenues((prev) => [...prev, newVenue].sort((a, b) => a.name.localeCompare(b.name)));
      await createVenue(venueFormToInput(form));
    });
  }

  function handleUpdateVenue(id: number, form: VenueForm, isActive: boolean) {
    startTransition(async () => {
      setVenues((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                name: form.name,
                venueType: form.venueType,
                address: form.address || null,
                parkingInfo: form.parkingInfo || null,
                setupNotes: form.setupNotes || null,
                defaultTravelFeeInCents: dollarsToCents(form.travelFee),
                isActive,
              }
            : v,
        ),
      );
      await updateVenue(id, { ...venueFormToInput(form), isActive });
    });
  }

  // Collect unique event types from current events for filter pills
  const activeTypes = [...new Set(events.map((e) => e.eventType))].sort();

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Events</h1>
          <p className="text-sm text-muted mt-0.5">
            Bridal parties, pop-ups, travel, workshops, and more
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVenuesDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 transition-colors border border-border/60"
          >
            <Building2 className="w-3.5 h-3.5" />
            Venues
            {venues.filter((v) => v.isActive).length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground/8 text-muted ml-0.5">
                {venues.filter((v) => v.isActive).length}
              </span>
            )}
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New Event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Upcoming", value: upcoming.length, sub: "confirmed + upcoming" },
          { label: "Total Events", value: events.length, sub: "all time" },
          {
            label: "Total Guests",
            value: events.reduce((s, e) => s + e.guests.length, 0),
            sub: "across all events",
          },
          {
            label: "Revenue",
            value: `$${(totalRevenue / 100).toLocaleString()}`,
            sub: "from events",
          },
        ].map((s) => (
          <Card key={s.label} className="gap-0 py-4">
            <CardContent className="px-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                {s.label}
              </p>
              <p className="text-2xl font-semibold text-foreground mt-1">{s.value}</p>
              <p className="text-xs text-muted mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            filter === "all"
              ? "bg-foreground/8 text-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          All
        </button>
        {activeTypes.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filter === t ? "bg-foreground/8 text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {TYPE_CONFIG[t].label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-sm text-muted">No events in this category.</p>
          <button onClick={openNew} className="mt-2 text-sm text-accent hover:underline">
            + Create your first event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filtered.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              onEdit={() => openEdit(e)}
              onDelete={() => handleDelete(e.id)}
              onAddGuest={(guest) => handleAddGuest(e.id, guest)}
              onToggleGuestPaid={(guestId) => handleToggleGuestPaid(e.id, guestId)}
              onRemoveGuest={(guestId) => removeGuest(guestId)}
              onSendInvite={() => sendEventRsvpInvite(e.id)}
            />
          ))}
        </div>
      )}

      <EventDialog
        key={editingEvent?.id ?? "new"}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initial={editingEvent ? eventToForm(editingEvent) : emptyEventForm()}
        venues={venues}
        onSave={handleSave}
      />

      <VenuesDialog
        open={venuesDialogOpen}
        onClose={() => setVenuesDialogOpen(false)}
        venues={venues}
        onAdd={handleCreateVenue}
        onUpdate={handleUpdateVenue}
      />
    </div>
  );
}
