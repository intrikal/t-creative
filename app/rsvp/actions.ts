"use server";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { events, eventGuests } from "@/db/schema";

export type RsvpEventInfo = {
  id: number;
  title: string;
  eventDate: string;
  location: string | null;
  services: string | null;
  maxAttendees: number | null;
  currentCount: number;
};

/** Looks up an event by its RSVP token (stored in events.metadata.rsvpToken). */
export async function getEventByRsvpToken(token: string): Promise<RsvpEventInfo | null> {
  const [row] = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      location: events.location,
      services: events.services,
      maxAttendees: events.maxAttendees,
      metadata: events.metadata,
    })
    .from(events)
    .where(sql`${events.metadata}->>'rsvpToken' = ${token}`)
    .limit(1);

  if (!row) return null;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(eventGuests)
    .where(sql`${eventGuests.eventId} = ${row.id}`);

  return {
    id: row.id,
    title: row.title,
    eventDate: new Date(row.startsAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
    location: row.location,
    services: row.services,
    maxAttendees: row.maxAttendees,
    currentCount: Number(count),
  };
}

export type RsvpInput = {
  name: string;
  service: string;
};

export type RsvpResult = { success: true } | { success: false; error: string };

/** Public (no auth) — submits an RSVP, creating an event guest record. */
export async function submitRsvp(token: string, input: RsvpInput): Promise<RsvpResult> {
  if (!input.name.trim()) return { success: false, error: "Name is required." };

  const event = await getEventByRsvpToken(token);
  if (!event) return { success: false, error: "Event not found." };

  if (event.maxAttendees !== null && event.currentCount >= event.maxAttendees) {
    return { success: false, error: "This event is full." };
  }

  await db.insert(eventGuests).values({
    eventId: event.id,
    name: input.name.trim(),
    service: input.service.trim() || null,
    paid: false,
  });

  return { success: true };
}
