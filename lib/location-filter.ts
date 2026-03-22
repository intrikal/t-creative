/**
 * lib/location-filter.ts — Shared location filtering helper for server actions.
 *
 * Provides a consistent pattern for adding location_id WHERE conditions
 * to Drizzle queries. All location-scoped server actions should import
 * this helper to apply location filtering uniformly.
 *
 * Usage:
 *   const conditions = [isNull(bookings.deletedAt)];
 *   locationFilter(conditions, bookings.locationId, locationId);
 *   // conditions now includes eq(bookings.locationId, locationId) if set
 */
import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Push a location_id filter condition into a conditions array if locationId is set.
 * Mutates the array in place for convenience (same pattern as existing actions).
 */
export function locationFilter(
  conditions: SQL[],
  column: PgColumn,
  locationId: number | null | undefined,
): void {
  if (locationId !== undefined && locationId !== null) {
    conditions.push(eq(column, locationId) as unknown as SQL);
  }
}

/**
 * Get all active location IDs for per-location cron processing.
 * Returns an array of location IDs ordered by name.
 */
export async function getActiveLocationIds(): Promise<number[]> {
  const { db } = await import("@/db");
  const { locations } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const rows = await db
    .select({ id: locations.id })
    .from(locations)
    .where(eq(locations.isActive, true))
    .orderBy(locations.name);

  return rows.map((r) => r.id);
}
