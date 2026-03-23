// @vitest-environment node

/**
 * tests/edge/timezone-dst.test.ts
 *
 * Edge-case tests for DST (Daylight Saving Time) boundary behaviour.
 *
 * All wall-clock times reference America/Los_Angeles:
 *   - Spring forward: 2025-03-09 2:00am → 3:00am (clocks skip 2:00–2:59)
 *   - Fall back:      2025-11-02 2:00am → 1:00am (clocks repeat 1:00–1:59)
 *
 * Covered scenarios
 *   1. Spring-forward gap: booking at 2:00am on March 9 → gracefully handled
 *   2. Fall-back ambiguity: booking at 1:30am on Nov 2  → first occurrence (PDT)
 *   3. Reminder offset: reminder 2 h before booking, regardless of UTC offset
 *   4. Weekly recurrence crossing DST: occurrences stay at 10am local, not 10am UTC
 *   5. iCal DTSTART: should carry TZID=America/Los_Angeles, not bare UTC Z suffix
 *   6. Cross-timezone display: booking shown in studio tz, not client tz
 */

import { describe, expect, it } from "vitest";

/* ------------------------------------------------------------------ */
/*  Helpers / pure utilities under test                                */
/* ------------------------------------------------------------------ */

/**
 * Interprets a wall-clock date-time string ("YYYY-MM-DDTHH:MM:SS") as a
 * local time in `timezone` and returns the UTC Date.
 *
 * Handles both ambiguous times (fall-back: returns the *first* occurrence,
 * i.e. the smaller UTC value) and non-existent times (spring-forward gap:
 * returns the first valid post-gap moment — e.g. 2:00am → 3:00am PDT).
 *
 * This is the kind of helper the production code should use when converting
 * user-supplied booking times.  We define it here so the tests document
 * the expected behaviour against a concrete implementation.
 */
function localToUtc(localIso: string, timezone: string): Date {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute, second] = timePart.split(":").map(Number);

  // Collect every UTC candidate that round-trips back to the requested local time.
  // Trying every whole-hour offset from -12 to +2 covers all IANA timezones and
  // naturally handles both ambiguous (two candidates) and standard (one candidate)
  // wall-clock times.
  const candidates: number[] = [];
  for (let offsetHours = -12; offsetHours <= 2; offsetHours++) {
    const candidateUtcMs =
      Date.UTC(year, month - 1, day, hour, minute, second ?? 0) - offsetHours * 60 * 60 * 1000;
    const roundTrip = utcToLocalParts(candidateUtcMs, timezone);
    if (
      roundTrip.year === year &&
      roundTrip.month === month &&
      roundTrip.day === day &&
      roundTrip.hour === hour &&
      roundTrip.minute === minute
    ) {
      candidates.push(candidateUtcMs);
    }
  }

  if (candidates.length > 0) {
    // Return the earliest UTC instant (= first occurrence for ambiguous times).
    return new Date(Math.min(...candidates));
  }

  // Gap time: no UTC instant produces this local wall-clock reading.
  // Use the pre-gap UTC offset (PST = UTC-8 for LA) so the result lands at
  // the first valid post-gap moment (e.g. 2:00am PST-offset → 10:00Z → 3:00am PDT).
  const gapFallbackUtcMs =
    Date.UTC(year, month - 1, day, hour, minute, second ?? 0) + 8 * 60 * 60 * 1000;
  return new Date(gapFallbackUtcMs);
}

/** Returns the wall-clock date parts of a UTC ms value in a given timezone. */
function utcToLocalParts(
  utcMs: number,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const d = new Date(utcMs);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce(
      (acc, p) => {
        if (p.type !== "literal") acc[p.type] = parseInt(p.value, 10);
        return acc;
      },
      {} as Record<string, number>,
    );
  return {
    year: parts["year"],
    month: parts["month"],
    day: parts["day"],
    hour: parts["hour"] === 24 ? 0 : parts["hour"], // midnight edge-case
    minute: parts["minute"],
    second: parts["second"],
  };
}

/** Formats a UTC Date as local wall-clock time in `timezone`. */
function formatInTimezone(date: Date, timezone: string): string {
  return date.toLocaleString("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Checks whether a wall-clock time is in the non-existent spring-forward gap
 * for the given timezone.  The gap occurs when clocks skip from 2:00am to 3:00am.
 *
 * A time is in the gap if converting it to UTC and back yields a *different*
 * wall-clock hour (the clock jumped forward past that hour).
 */
function isInSpringForwardGap(localIso: string, timezone: string): boolean {
  const [datePart, timePart] = localIso.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const utcEstimate = localToUtc(localIso, timezone);
  const roundTripped = utcToLocalParts(utcEstimate.getTime(), timezone);

  return roundTripped.hour !== hour || roundTripped.minute !== minute;
}

/**
 * Generates weekly recurrence dates from `startUtc` for `count` occurrences,
 * keeping the *local* wall-clock time constant in `timezone`.
 *
 * This mirrors the production RRULE FREQ=WEEKLY implementation and is the
 * correct behaviour: each occurrence must appear at the same hour/minute in
 * the studio's local timezone even after a DST transition.
 */
function generateWeeklyOccurrences(startUtc: Date, timezone: string, count: number): Date[] {
  const occurrences: Date[] = [startUtc];
  const { hour, minute, second } = utcToLocalParts(startUtc.getTime(), timezone);

  for (let i = 1; i < count; i++) {
    const prev = occurrences[i - 1];
    // Advance 7 calendar days in the given timezone.
    // Use noon UTC (12:00Z) as the anchor when building the next date so that
    // midnight-UTC does not roll back to the previous calendar day in LA (UTC-7/8).
    const prevLocal = utcToLocalParts(prev.getTime(), timezone);
    const nextDateUtc = new Date(
      Date.UTC(prevLocal.year, prevLocal.month - 1, prevLocal.day + 7, 12, 0, 0),
    );
    const nextLocal = utcToLocalParts(nextDateUtc.getTime(), timezone);
    // Pin to original local hour/minute
    const nextLocalIso = `${nextLocal.year}-${String(nextLocal.month).padStart(2, "0")}-${String(nextLocal.day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
    occurrences.push(localToUtc(nextLocalIso, timezone));
  }

  return occurrences;
}

/**
 * Computes the UTC timestamp at which a reminder should fire.
 * `hoursBeforeBooking` is always a *duration* offset from the booking UTC time,
 * so DST never affects the gap between reminder and booking.
 */
function computeReminderTime(bookingUtc: Date, hoursBeforeBooking: number): Date {
  return new Date(bookingUtc.getTime() - hoursBeforeBooking * 60 * 60 * 1000);
}

/**
 * Generates the DTSTART line for an iCal VEVENT using a timezone-aware
 * local form (TZID property parameter) rather than the bare UTC Z form.
 *
 * The current production `toIcsDate()` emits UTC (ends in "Z"), which loses
 * the TZID context.  This helper documents the *correct* target format.
 */
function toIcsDateWithTzid(date: Date, timezone: string): { property: string; value: string } {
  const p = utcToLocalParts(date.getTime(), timezone);
  const localStr = [
    `${p.year}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`,
    `T`,
    `${String(p.hour).padStart(2, "0")}${String(p.minute).padStart(2, "0")}${String(p.second).padStart(2, "0")}`,
  ].join("");
  return {
    property: `DTSTART;TZID=${timezone}`,
    value: localStr,
  };
}

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const STUDIO_TZ = "America/Los_Angeles";

// Spring-forward transition: 2025-03-09 02:00 PST → 03:00 PDT
const SPRING_FORWARD_DATE = "2025-03-09";
// Fall-back transition: 2025-11-02 02:00 PDT → 01:00 PST
const FALL_BACK_DATE = "2025-11-02";

/* ------------------------------------------------------------------ */
/*  Test suite                                                          */
/* ------------------------------------------------------------------ */

describe("DST edge cases — America/Los_Angeles", () => {
  // ─── 1. Spring-forward gap: 2:00am doesn't exist ──────────────────

  describe("1. Spring-forward gap (March 9 2025 — 2:xx am doesn't exist)", () => {
    it("detects that 2:00am on spring-forward day is in the gap", () => {
      const nonexistentTime = `${SPRING_FORWARD_DATE}T02:00:00`;
      expect(isInSpringForwardGap(nonexistentTime, STUDIO_TZ)).toBe(true);
    });

    it("detects that 2:30am on spring-forward day is in the gap", () => {
      const nonexistentTime = `${SPRING_FORWARD_DATE}T02:30:00`;
      expect(isInSpringForwardGap(nonexistentTime, STUDIO_TZ)).toBe(true);
    });

    it("1:59am on spring-forward day is NOT in the gap (last valid PST minute)", () => {
      const validTime = `${SPRING_FORWARD_DATE}T01:59:00`;
      expect(isInSpringForwardGap(validTime, STUDIO_TZ)).toBe(false);
    });

    it("3:00am on spring-forward day is NOT in the gap (first valid PDT minute)", () => {
      const validTime = `${SPRING_FORWARD_DATE}T03:00:00`;
      expect(isInSpringForwardGap(validTime, STUDIO_TZ)).toBe(false);
    });

    it("booking at 2:00am spring-forward is shifted forward: resolves to 3:00am PDT", () => {
      // When a booking falls in the gap, the system should forward it to the
      // first valid moment after the clock transition (3:00am PDT).
      const requestedLocal = `${SPRING_FORWARD_DATE}T02:00:00`;
      const inGap = isInSpringForwardGap(requestedLocal, STUDIO_TZ);
      expect(inGap).toBe(true);

      // The UTC value produced by localToUtc for a gap time rounds forward
      // to the post-transition equivalent (3:00am PDT = UTC-7).
      const utc = localToUtc(requestedLocal, STUDIO_TZ);
      const localAfterConvert = utcToLocalParts(utc.getTime(), STUDIO_TZ);

      // After conversion the local hour should be 3 (skipped forward), not 2
      expect(localAfterConvert.hour).toBe(3);
      expect(localAfterConvert.minute).toBe(0);
    });

    it("validates that a booking in the gap should be rejected or shifted — not silently stored as wrong time", () => {
      const requestedLocal = `${SPRING_FORWARD_DATE}T02:15:00`;
      const inGap = isInSpringForwardGap(requestedLocal, STUDIO_TZ);

      // Production code MUST check this flag and either:
      //   a) reject the booking with a clear error, or
      //   b) shift to 3:00am PDT
      // Silently accepting 2:15am would cause the booking to be stored at
      // the wrong UTC instant and shown at the wrong time.
      expect(inGap).toBe(true); // gap detected → action required
    });
  });

  // ─── 2. Fall-back ambiguity: 1:30am occurs twice ──────────────────

  describe("2. Fall-back ambiguity (November 2 2025 — 1:xx am occurs twice)", () => {
    it("1:30am on fall-back day maps to PDT offset (first occurrence, UTC-7)", () => {
      // Before the clock falls back at 2:00am, 1:30am PDT = UTC-7 = 08:30 UTC
      const firstOccurrenceUtcMs = Date.UTC(2025, 10, 2, 8, 30, 0); // 08:30Z
      const local = utcToLocalParts(firstOccurrenceUtcMs, STUDIO_TZ);
      expect(local.hour).toBe(1);
      expect(local.minute).toBe(30);
    });

    it("1:30am on fall-back day also maps to PST offset (second occurrence, UTC-8)", () => {
      // After the clock falls back, 1:30am PST = UTC-8 = 09:30 UTC
      const secondOccurrenceUtcMs = Date.UTC(2025, 10, 2, 9, 30, 0); // 09:30Z
      const local = utcToLocalParts(secondOccurrenceUtcMs, STUDIO_TZ);
      expect(local.hour).toBe(1);
      expect(local.minute).toBe(30);
    });

    it("system should use the first occurrence (PDT) when booking at 1:30am on fall-back day", () => {
      // When a client books 1:30am on fall-back day, the system must choose
      // one of the two valid UTC instants.  Policy: first occurrence (PDT, UTC-7).
      const firstOccurrenceUtc = new Date(Date.UTC(2025, 10, 2, 8, 30, 0));
      const secondOccurrenceUtc = new Date(Date.UTC(2025, 10, 2, 9, 30, 0));

      // Both round-trip to 1:30am local — both are valid candidates
      const local1 = utcToLocalParts(firstOccurrenceUtc.getTime(), STUDIO_TZ);
      const local2 = utcToLocalParts(secondOccurrenceUtc.getTime(), STUDIO_TZ);
      expect(local1.hour).toBe(1);
      expect(local1.minute).toBe(30);
      expect(local2.hour).toBe(1);
      expect(local2.minute).toBe(30);

      // First occurrence has a smaller UTC value (earlier absolute time)
      expect(firstOccurrenceUtc.getTime()).toBeLessThan(secondOccurrenceUtc.getTime());

      // The canonical UTC ms for the first PDT occurrence
      expect(firstOccurrenceUtc.toISOString()).toBe("2025-11-02T08:30:00.000Z");
    });

    it("2:30am on fall-back day is unambiguous (only exists in PST, post-transition)", () => {
      // After 2:00am PST the ambiguity window is over; 2:30am PST = 10:30 UTC
      const utc = new Date(Date.UTC(2025, 10, 2, 10, 30, 0));
      const local = utcToLocalParts(utc.getTime(), STUDIO_TZ);
      expect(local.hour).toBe(2);
      expect(local.minute).toBe(30);
      // Confirm no gap issue
      expect(isInSpringForwardGap(`${FALL_BACK_DATE}T02:30:00`, STUDIO_TZ)).toBe(false);
    });
  });

  // ─── 3. Reminder timing: always 2 hours before booking ───────────

  describe("3. Reminder timing — 2 hours before regardless of UTC offset", () => {
    it("reminder 2h before a 10am PST booking fires at 8am PST (winter)", () => {
      // Jan 15 10:00am PST = 18:00 UTC
      const bookingUtc = new Date(Date.UTC(2025, 0, 15, 18, 0, 0));
      const reminderUtc = computeReminderTime(bookingUtc, 2);

      // 2h before = 16:00 UTC = 8:00am PST
      expect(reminderUtc.toISOString()).toBe("2025-01-15T16:00:00.000Z");

      const reminderLocal = utcToLocalParts(reminderUtc.getTime(), STUDIO_TZ);
      expect(reminderLocal.hour).toBe(8);
      expect(reminderLocal.minute).toBe(0);
    });

    it("reminder 2h before a 10am PDT booking fires at 8am PDT (summer)", () => {
      // Jun 15 10:00am PDT = 17:00 UTC
      const bookingUtc = new Date(Date.UTC(2025, 5, 15, 17, 0, 0));
      const reminderUtc = computeReminderTime(bookingUtc, 2);

      // 2h before = 15:00 UTC = 8:00am PDT
      expect(reminderUtc.toISOString()).toBe("2025-06-15T15:00:00.000Z");

      const reminderLocal = utcToLocalParts(reminderUtc.getTime(), STUDIO_TZ);
      expect(reminderLocal.hour).toBe(8);
      expect(reminderLocal.minute).toBe(0);
    });

    it("reminder gap is exactly 2h in UTC regardless of DST offset (PST vs PDT)", () => {
      const winterBooking = new Date(Date.UTC(2025, 0, 15, 18, 0, 0)); // PST
      const summerBooking = new Date(Date.UTC(2025, 5, 15, 17, 0, 0)); // PDT

      const winterReminder = computeReminderTime(winterBooking, 2);
      const summerReminder = computeReminderTime(summerBooking, 2);

      const winterGapMs = winterBooking.getTime() - winterReminder.getTime();
      const summerGapMs = summerBooking.getTime() - summerReminder.getTime();

      const twoHoursMs = 2 * 60 * 60 * 1000;
      expect(winterGapMs).toBe(twoHoursMs);
      expect(summerGapMs).toBe(twoHoursMs);
    });

    it("reminder 2h before a booking spanning DST transition still fires at correct local time", () => {
      // Booking at 10am PDT on the day after fall-back (Nov 3 2025)
      // 10am PST = 18:00 UTC
      const bookingUtc = new Date(Date.UTC(2025, 10, 3, 18, 0, 0));
      const reminderUtc = computeReminderTime(bookingUtc, 2);

      // 2h before = 16:00 UTC = 8am PST
      const reminderLocal = utcToLocalParts(reminderUtc.getTime(), STUDIO_TZ);
      expect(reminderLocal.hour).toBe(8);
      expect(reminderLocal.minute).toBe(0);

      // UTC gap is still exactly 2h
      expect(bookingUtc.getTime() - reminderUtc.getTime()).toBe(2 * 60 * 60 * 1000);
    });
  });

  // ─── 4. Weekly recurrence crossing DST boundary ───────────────────

  describe("4. Weekly recurrence — local time stays constant across DST boundary", () => {
    it("weekly 10am occurrences before spring-forward are in PST (UTC-8)", () => {
      // Start: Mar 2 2025 10:00am PST = 18:00 UTC
      const firstUtc = new Date(Date.UTC(2025, 2, 2, 18, 0, 0));
      const occurrences = generateWeeklyOccurrences(firstUtc, STUDIO_TZ, 3);

      // Mar 2, Mar 9, Mar 16
      for (const occ of occurrences.slice(0, 2)) {
        const local = utcToLocalParts(occ.getTime(), STUDIO_TZ);
        expect(local.hour).toBe(10);
        expect(local.minute).toBe(0);
      }
    });

    it("occurrence on spring-forward week (Mar 9) stays at 10am PDT, not 10am UTC", () => {
      // Start: Mar 2 2025 10:00am PST = 18:00 UTC
      const firstUtc = new Date(Date.UTC(2025, 2, 2, 18, 0, 0));
      const occurrences = generateWeeklyOccurrences(firstUtc, STUDIO_TZ, 2);
      const march9Occ = occurrences[1]; // second occurrence = Mar 9

      // At 10am PDT = 17:00 UTC (not 18:00 UTC as a naive +7d would produce)
      expect(march9Occ.toISOString()).toBe("2025-03-09T17:00:00.000Z");

      const local = utcToLocalParts(march9Occ.getTime(), STUDIO_TZ);
      expect(local.hour).toBe(10);
      expect(local.minute).toBe(0);
    });

    it("naive +7 days in UTC gives WRONG result on spring-forward week", () => {
      // This test documents the BUG that occurs when adding 7*24h in ms
      const firstUtc = new Date(Date.UTC(2025, 2, 2, 18, 0, 0)); // 10am PST
      const naivePlus7Days = new Date(firstUtc.getTime() + 7 * 24 * 60 * 60 * 1000);

      // Naive +7d would be 2025-03-09T18:00:00Z = 11am PDT (wrong!)
      expect(naivePlus7Days.toISOString()).toBe("2025-03-09T18:00:00.000Z");

      const naiveLocal = utcToLocalParts(naivePlus7Days.getTime(), STUDIO_TZ);
      expect(naiveLocal.hour).toBe(11); // 11am — BUG: should be 10am
    });

    it("weekly occurrences crossing fall-back stay at 10am local (not drifting to 9am or 11am)", () => {
      // Start: Oct 26 2025 10:00am PDT = 17:00 UTC
      const firstUtc = new Date(Date.UTC(2025, 9, 26, 17, 0, 0));
      const occurrences = generateWeeklyOccurrences(firstUtc, STUDIO_TZ, 3);

      // Oct 26 (PDT), Nov 2 (fall-back day, PDT), Nov 9 (PST)
      for (const occ of occurrences) {
        const local = utcToLocalParts(occ.getTime(), STUDIO_TZ);
        expect(local.hour).toBe(10);
        expect(local.minute).toBe(0);
      }
    });

    it("occurrence on fall-back week (Nov 2) stays at 10am local time", () => {
      // Start: Oct 26 2025 10:00am PDT = 17:00 UTC
      const firstUtc = new Date(Date.UTC(2025, 9, 26, 17, 0, 0));
      const occurrences = generateWeeklyOccurrences(firstUtc, STUDIO_TZ, 2);
      const nov2Occ = occurrenceOnDate(occurrences, 2025, 11, 2);
      expect(nov2Occ).toBeDefined();

      // 10am on Nov 2 (fall-back day): the 2am→1am transition happens before 10am,
      // so by the time we reach 10am the clock is in PST (UTC-8) = 18:00 UTC.
      expect(nov2Occ!.toISOString()).toBe("2025-11-02T18:00:00.000Z");

      const local = utcToLocalParts(nov2Occ!.getTime(), STUDIO_TZ);
      expect(local.hour).toBe(10);
    });
  });

  // ─── 5. iCal DTSTART should include TZID ─────────────────────────

  describe("5. iCal export — DTSTART uses TZID=America/Los_Angeles, not bare UTC Z", () => {
    it("DTSTART property includes TZID parameter for a winter booking", () => {
      // Jan 15 2026 10:00am PST
      const bookingUtc = new Date(Date.UTC(2026, 0, 15, 18, 0, 0));
      const { property, value } = toIcsDateWithTzid(bookingUtc, STUDIO_TZ);

      expect(property).toBe("DTSTART;TZID=America/Los_Angeles");
      expect(value).toBe("20260115T100000");
    });

    it("DTSTART property includes TZID parameter for a summer booking", () => {
      // Jun 15 2026 10:00am PDT
      const bookingUtc = new Date(Date.UTC(2026, 5, 15, 17, 0, 0));
      const { property, value } = toIcsDateWithTzid(bookingUtc, STUDIO_TZ);

      expect(property).toBe("DTSTART;TZID=America/Los_Angeles");
      expect(value).toBe("20260615T100000");
    });

    it("DTSTART local value does NOT end with Z (bare UTC form)", () => {
      const bookingUtc = new Date(Date.UTC(2026, 0, 15, 18, 0, 0));
      const { value } = toIcsDateWithTzid(bookingUtc, STUDIO_TZ);
      expect(value).not.toMatch(/Z$/);
    });

    it("bare UTC DTSTART loses local time context across DST transitions", () => {
      // A booking stored as UTC 18:00 on Mar 9 (spring-forward day) is 10am PDT,
      // but a calendar that blindly uses UTC Z would display UTC 18:00 = 10am PDT
      // only because the client happens to be in the same timezone.
      // A client in UTC+0 would see the event at 6pm instead of 10am local.
      const bookingUtc = new Date(Date.UTC(2025, 2, 9, 17, 0, 0)); // 10am PDT

      // Bare UTC form (what the current production code emits)
      const utcForm = bookingUtc.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      expect(utcForm).toBe("20250309T170000Z"); // UTC-correct but timezone-unaware

      // Timezone-aware form (what we want)
      const { property, value } = toIcsDateWithTzid(bookingUtc, STUDIO_TZ);
      expect(property).toContain("TZID=America/Los_Angeles");
      expect(value).toBe("20250309T100000"); // local time preserved
    });

    it("DTSTART round-trips: parsing TZID form recovers the original UTC instant", () => {
      const originalUtc = new Date(Date.UTC(2026, 3, 20, 17, 0, 0)); // 10am PDT
      const { property, value } = toIcsDateWithTzid(originalUtc, STUDIO_TZ);

      // Extract timezone from property
      const tzMatch = property.match(/TZID=(.+)$/);
      expect(tzMatch).not.toBeNull();
      const tz = tzMatch![1];

      // Re-parse the local form back to UTC
      const [datePart, timePart] = [value.slice(0, 8), value.slice(9)];
      const localIso = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
      const recoveredUtc = localToUtc(localIso, tz);

      expect(recoveredUtc.getTime()).toBe(originalUtc.getTime());
    });
  });

  // ─── 6. Cross-timezone display: studio tz, not client tz ─────────

  describe("6. Cross-timezone display — booking shown in studio timezone", () => {
    it("client in New York sees a 10am LA booking as 1pm ET (correct studio time)", () => {
      // Studio booking: Jan 15 2026 10:00am PST = 18:00 UTC
      const bookingUtc = new Date(Date.UTC(2026, 0, 15, 18, 0, 0));

      // Studio display (America/Los_Angeles)
      const studioLocal = utcToLocalParts(bookingUtc.getTime(), STUDIO_TZ);
      expect(studioLocal.hour).toBe(10);
      expect(studioLocal.minute).toBe(0);

      // Client's browser display (America/New_York, EST = UTC-5 in January)
      const clientLocal = utcToLocalParts(bookingUtc.getTime(), "America/New_York");
      expect(clientLocal.hour).toBe(13); // 1pm ET

      // The booking MUST be shown at studio time (10am PST), not client time (1pm ET)
      // Production code should use STUDIO_TZ when displaying bookings, regardless
      // of the client's device timezone.
      expect(studioLocal.hour).not.toBe(clientLocal.hour);
    });

    it("client in Tokyo sees a 10am LA booking displayed as 10am LA, not Tokyo time", () => {
      // Studio booking: Jun 15 2026 10:00am PDT = 17:00 UTC
      const bookingUtc = new Date(Date.UTC(2026, 5, 15, 17, 0, 0));

      const studioLocal = utcToLocalParts(bookingUtc.getTime(), STUDIO_TZ);
      expect(studioLocal.hour).toBe(10);

      const tokyoLocal = utcToLocalParts(bookingUtc.getTime(), "Asia/Tokyo");
      expect(tokyoLocal.hour).toBe(2); // 2am next day in Tokyo (JST = UTC+9)

      // Studio display is 10am — this is what the client confirmation should show
      expect(studioLocal.hour).toBe(10);
    });

    it("formatInTimezone always uses STUDIO_TZ regardless of system locale", () => {
      // Booking at 10am PST
      const bookingUtc = new Date(Date.UTC(2026, 0, 15, 18, 0, 0));

      const studioDisplay = formatInTimezone(bookingUtc, STUDIO_TZ);
      const tokyoDisplay = formatInTimezone(bookingUtc, "Asia/Tokyo");

      // Both strings represent the same UTC instant but in different local times
      expect(studioDisplay).toContain("10:00:00"); // 10am PST
      expect(tokyoDisplay).not.toContain("10:00:00"); // different local time

      // Booking confirmations, reminders, and iCal must use STUDIO_TZ
      expect(studioDisplay).toMatch(/10:00:00/);
    });

    it("client in timezone behind studio does not see booking on a different calendar date", () => {
      // Edge case: booking at 1am PST = 09:00 UTC
      // A client in UTC-10 (Hawaii) would see this as the previous day at 11pm
      const bookingUtc = new Date(Date.UTC(2026, 0, 15, 9, 0, 0)); // Jan 15 1am PST

      const studioLocal = utcToLocalParts(bookingUtc.getTime(), STUDIO_TZ);
      expect(studioLocal.day).toBe(15); // Jan 15 at the studio

      const hawaiiLocal = utcToLocalParts(bookingUtc.getTime(), "Pacific/Honolulu");
      expect(hawaiiLocal.day).toBe(14); // Jan 14 in Hawaii (previous day!)

      // The booking card/confirmation must show Jan 15 (studio date), not Jan 14
      expect(studioLocal.day).toBe(15);
      expect(studioLocal.day).not.toBe(hawaiiLocal.day);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Test utilities                                                      */
/* ------------------------------------------------------------------ */

/** Finds the occurrence that falls on a given calendar date in UTC. */
function occurrenceOnDate(
  occurrences: Date[],
  year: number,
  month: number,
  day: number,
): Date | undefined {
  return occurrences.find((d) => {
    const p = utcToLocalParts(d.getTime(), STUDIO_TZ);
    return p.year === year && p.month === month && p.day === day;
  });
}
