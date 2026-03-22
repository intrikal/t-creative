/**
 * lib/notification-preferences — Check and seed notification preferences.
 *
 * Used by cron jobs and server actions to check if a client has opted
 * into a specific (channel, type) combination before sending.
 *
 * @module lib/notification-preferences
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationPreferences,
  NOTIF_CHANNELS,
  NOTIF_TYPES,
} from "@/db/schema";
import type { NotifChannel, NotifType } from "@/db/schema";

/**
 * Check if a client has a specific notification preference enabled.
 * Returns true if the preference doesn't exist (default = enabled).
 */
export async function isNotificationEnabled(
  profileId: string,
  channel: NotifChannel,
  type: NotifType,
): Promise<boolean> {
  const [pref] = await db
    .select({ enabled: notificationPreferences.enabled })
    .from(notificationPreferences)
    .where(
      and(
        eq(notificationPreferences.profileId, profileId),
        eq(notificationPreferences.channel, channel),
        eq(notificationPreferences.notificationType, type),
      ),
    )
    .limit(1);

  // Default to enabled if no preference row exists
  return pref?.enabled ?? true;
}

/**
 * Batch-check multiple notification preferences for a client.
 * Returns a Map keyed by `${channel}:${type}` → enabled.
 */
export async function getNotificationPreferences(
  profileId: string,
): Promise<Map<string, boolean>> {
  const rows = await db
    .select({
      channel: notificationPreferences.channel,
      notificationType: notificationPreferences.notificationType,
      enabled: notificationPreferences.enabled,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.profileId, profileId));

  const map = new Map<string, boolean>();
  for (const row of rows) {
    map.set(`${row.channel}:${row.notificationType}`, row.enabled);
  }
  return map;
}

/**
 * Seed all default notification preferences for a new client.
 * Creates one row per (channel, type) combination, all enabled.
 * Idempotent — skips if preferences already exist.
 */
export async function seedNotificationPreferences(profileId: string): Promise<void> {
  const [existing] = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.profileId, profileId))
    .limit(1);

  if (existing) return; // Already seeded

  const rows = NOTIF_CHANNELS.flatMap((channel) =>
    NOTIF_TYPES.map((type) => ({
      profileId,
      channel,
      notificationType: type,
      enabled: true,
    })),
  );

  await db.insert(notificationPreferences).values(rows);
}

/**
 * Update a single notification preference.
 * Upserts — creates the row if it doesn't exist.
 */
export async function setNotificationPreference(
  profileId: string,
  channel: NotifChannel,
  type: NotifType,
  enabled: boolean,
): Promise<void> {
  await db
    .insert(notificationPreferences)
    .values({
      profileId,
      channel,
      notificationType: type,
      enabled,
    })
    .onConflictDoUpdate({
      target: [
        notificationPreferences.profileId,
        notificationPreferences.channel,
        notificationPreferences.notificationType,
      ],
      set: { enabled },
    });
}
