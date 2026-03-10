/**
 * GET /api/calendar/[profileId] — iCal subscription feed.
 *
 * Returns upcoming confirmed bookings as an ICS file that any calendar app
 * can subscribe to (Google Calendar, Apple Calendar, Outlook).
 *
 * Secured with an HMAC token (see lib/calendar-token.ts). The token is
 * generated from CRON_SECRET so it never expires but can be rotated by
 * changing that env var.
 *
 * Owner/admin: all upcoming confirmed bookings.
 * Assistant: only their own upcoming confirmed bookings.
 */
import { NextResponse } from "next/server";
import { eq, gte, and, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { bookings, profiles, services } from "@/db/schema";
import { verifyCalendarToken } from "@/lib/calendar-token";

/* ------------------------------------------------------------------ */
/*  ICS helpers                                                         */
/* ------------------------------------------------------------------ */

function toIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function buildIcs(events: IcsEvent[], calName: string): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//T Creative Studio//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calName)}`,
    "X-WR-CALDESC:Upcoming appointments",
  ];

  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${toIcsDate(new Date())}`,
      `DTSTART:${toIcsDate(e.start)}`,
      `DTEND:${toIcsDate(e.end)}`,
      `SUMMARY:${escapeIcs(e.summary)}`,
      `DESCRIPTION:${escapeIcs(e.description)}`,
      `LOCATION:${escapeIcs(e.location)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

interface IcsEvent {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description: string;
  location: string;
}

/* ------------------------------------------------------------------ */
/*  Route handler                                                       */
/* ------------------------------------------------------------------ */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const { profileId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!verifyCalendarToken(profileId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look up the profile to determine role
  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = profile.role === "admin";
  const now = new Date();

  const clientProfile = alias(profiles, "client_profile");
  const staffProfile = alias(profiles, "staff_profile");

  const rows = await db
    .select({
      id: bookings.id,
      startsAt: bookings.startsAt,
      durationMinutes: bookings.durationMinutes,
      location: bookings.location,
      clientNotes: bookings.clientNotes,
      totalInCents: bookings.totalInCents,
      serviceName: services.name,
      clientFirst: clientProfile.firstName,
      clientLast: clientProfile.lastName,
      staffFirst: staffProfile.firstName,
      staffLast: staffProfile.lastName,
    })
    .from(bookings)
    .innerJoin(services, eq(bookings.serviceId, services.id))
    .innerJoin(clientProfile, eq(bookings.clientId, clientProfile.id))
    .innerJoin(staffProfile, eq(bookings.staffId, staffProfile.id))
    .where(
      and(
        or(eq(bookings.status, "confirmed"), eq(bookings.status, "pending")),
        gte(bookings.startsAt, now),
        isOwner ? undefined : eq(bookings.staffId, profileId),
      ),
    );

  const events: IcsEvent[] = rows.map((r) => {
    const start = new Date(r.startsAt);
    const end = new Date(start.getTime() + r.durationMinutes * 60 * 1000);
    const clientName = [r.clientFirst, r.clientLast].filter(Boolean).join(" ");
    const staffName = [r.staffFirst, r.staffLast].filter(Boolean).join(" ");
    const total = r.totalInCents ? `$${(r.totalInCents / 100).toFixed(0)}` : "";

    const descParts = [
      `Service: ${r.serviceName}`,
      `Client: ${clientName}`,
      isOwner ? `Staff: ${staffName}` : null,
      total ? `Total: ${total}` : null,
      r.clientNotes ? `Notes: ${r.clientNotes}` : null,
    ].filter(Boolean) as string[];

    return {
      uid: `booking-${r.id}@tcreativestudio.com`,
      start,
      end,
      summary: isOwner
        ? `${r.serviceName} — ${clientName} (${staffName})`
        : `${r.serviceName} — ${clientName}`,
      description: descParts.join("\n"),
      location: r.location ?? "T Creative Studio",
    };
  });

  const calName = isOwner ? "T Creative — All Bookings" : "T Creative — My Bookings";
  const ics = buildIcs(events, calName);

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tcreative-bookings.ics"',
      "Cache-Control": "no-store",
    },
  });
}
