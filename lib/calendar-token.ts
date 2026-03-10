/**
 * lib/calendar-token.ts — HMAC-based token for iCal subscription URLs.
 *
 * Generates a stable, secret token tied to a profileId so we can expose
 * a public-ish calendar feed URL without requiring the user to be logged in.
 * The token is derived from CRON_SECRET so it can be rotated by changing
 * that env var, invalidating all existing subscription links.
 */
import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  return process.env.CRON_SECRET ?? "dev-secret";
}

/** Generate a hex HMAC token for a given profileId. */
export function generateCalendarToken(profileId: string): string {
  return createHmac("sha256", getSecret()).update(`calendar:${profileId}`).digest("hex");
}

/** Verify a calendar token in constant time to prevent timing attacks. */
export function verifyCalendarToken(profileId: string, token: string): boolean {
  try {
    const expected = generateCalendarToken(profileId);
    const expectedBuf = Buffer.from(expected, "hex");
    const tokenBuf = Buffer.from(token, "hex");
    if (expectedBuf.length !== tokenBuf.length) return false;
    return timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}

/** Build the full calendar subscription URL for a profileId. */
export function calendarUrl(profileId: string): string {
  const token = generateCalendarToken(profileId);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base}/api/calendar/${profileId}?token=${token}`;
}
