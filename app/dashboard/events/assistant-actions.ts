"use server";

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { events, eventGuests, eventStaff, eventVenues, profiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export type AssistantEventRow = {
  id: number;
  title: string;
  eventType: string;
  status: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  address: string | null;
  equipmentNotes: string | null;
  maxAttendees: number | null;
  description: string | null;
  guestCount: number;
  role: string | null;
  staffNotes: string | null;
};

export type AssistantEventStats = {
  upcoming: number;
  completed: number;
  total: number;
};

export async function getAssistantEvents(): Promise<{
  events: AssistantEventRow[];
  stats: AssistantEventStats;
}> {
  const cu = await getCurrentUser();
  if (!cu) throw new Error("Not authenticated");
  if (cu.profile?.role !== "assistant") throw new Error("Forbidden");

  // Find all events this assistant is assigned to via eventStaff
  const assignments = await db
    .select({
      eventId: eventStaff.eventId,
      role: eventStaff.role,
      notes: eventStaff.notes,
    })
    .from(eventStaff)
    .where(eq(eventStaff.staffId, cu.id));

  if (assignments.length === 0) {
    return { events: [], stats: { upcoming: 0, completed: 0, total: 0 } };
  }

  const eventIds = assignments.map((a) => a.eventId);
  const assignmentMap = new Map(assignments.map((a) => [a.eventId, a]));

  const [eventRows, guestRows] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        eventType: events.eventType,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        location: events.location,
        address: events.address,
        equipmentNotes: events.equipmentNotes,
        maxAttendees: events.maxAttendees,
        description: events.description,
      })
      .from(events)
      .where(inArray(events.id, eventIds))
      .orderBy(desc(events.startsAt)),
    db
      .select({ eventId: eventGuests.eventId })
      .from(eventGuests)
      .where(inArray(eventGuests.eventId, eventIds)),
  ]);

  // Count guests per event
  const guestCounts = new Map<number, number>();
  for (const g of guestRows) {
    guestCounts.set(g.eventId, (guestCounts.get(g.eventId) ?? 0) + 1);
  }

  const result: AssistantEventRow[] = eventRows.map((e) => {
    const assignment = assignmentMap.get(e.id);
    return {
      ...e,
      guestCount: guestCounts.get(e.id) ?? 0,
      role: assignment?.role ?? null,
      staffNotes: assignment?.notes ?? null,
    };
  });

  const upcoming = result.filter((e) =>
    ["upcoming", "confirmed", "in_progress"].includes(e.status),
  ).length;
  const completed = result.filter((e) => e.status === "completed").length;

  return {
    events: result,
    stats: { upcoming, completed, total: result.length },
  };
}
