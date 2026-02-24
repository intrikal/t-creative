/**
 * components/booking/helpers.ts — Pure utility functions for the booking storefront.
 *
 * All functions in this file are pure (no side effects, no imports from React or
 * browser APIs) so they can be used in both client and server contexts without
 * adding to the client bundle unnecessarily.
 *
 * Each function is documented with its intent, edge cases, and at least one
 * `@example` so callers can understand the output without running the code.
 */

import { LOCATION_LABELS } from "./constants";

/**
 * Formats a price in cents as a US dollar string.
 * Returns "Contact for quote" when `cents` is null — used for services that
 * require individual pricing (e.g. large consulting packages).
 *
 * @param cents - Price in integer cents, or null for price-on-request.
 * @returns Formatted price string.
 *
 * @example formatPrice(7500)  → "$75"
 * @example formatPrice(12050) → "$120"   (fractional cents truncated)
 * @example formatPrice(null)  → "Contact for quote"
 */
export function formatPrice(cents: number | null): string {
  if (cents === null) return "Contact for quote";
  return `$${(cents / 100).toFixed(0)}`;
}

/**
 * Extracts up to two uppercase initials from a name string.
 * Used as the fallback inside `<Avatar>` when no photo URL is available.
 *
 * @param name - A full name or studio name (may include multiple words).
 * @returns 1–2 uppercase characters.
 *
 * @example getInitials("T Creative Studio") → "TC"
 * @example getInitials("Trini")             → "T"
 * @example getInitials("")                  → ""
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Maps a `locationType` DB key to its human-readable display label.
 * Falls back to the raw key if it isn't in LOCATION_LABELS — forward-compatible
 * with future location types that may not yet have a label defined here.
 *
 * @param type - Location type string from `onboardingData.location.type`.
 * @returns Display label (e.g. "Home Studio", "Salon").
 *
 * @example formatLocationType("home_studio") → "Home Studio"
 * @example formatLocationType("unknown_type") → "unknown_type"
 */
export function formatLocationType(type: string): string {
  return LOCATION_LABELS[type] ?? type;
}

/**
 * Converts a 24-hour "HH:MM" time string to a compact 12-hour display string.
 * Minutes are omitted when zero to keep the display tight (e.g. "10am" not "10:00am").
 *
 * @param time - Time string in "HH:MM" 24-hour format.
 * @returns Compact 12-hour time string.
 *
 * @example formatTime("09:00") → "9am"
 * @example formatTime("13:30") → "1:30pm"
 * @example formatTime("00:00") → "12am"
 * @example formatTime("12:00") → "12pm"
 */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}
