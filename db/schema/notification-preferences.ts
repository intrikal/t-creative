/**
 * notification_preferences — Granular per-channel, per-type notification controls.
 *
 * Each row represents a single (profile, channel, type) preference.
 * All default to `enabled = true` when seeded at account creation.
 * The client settings UI renders a matrix of checkboxes.
 *
 * Channels: email, sms, push
 * Types: booking_reminder, review_request, fill_reminder, birthday_promo, marketing
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const notifChannelEnum = pgEnum("notif_channel", ["email", "sms", "push"]);

export const notifTypeEnum = pgEnum("notif_type", [
  "booking_reminder",
  "review_request",
  "fill_reminder",
  "birthday_promo",
  "marketing",
]);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: serial("id").primaryKey(),

    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    channel: notifChannelEnum("channel").notNull(),

    notificationType: notifTypeEnum("notification_type").notNull(),

    enabled: boolean("enabled").notNull().default(true),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("notif_prefs_unique_idx").on(t.profileId, t.channel, t.notificationType),
    index("notif_prefs_profile_idx").on(t.profileId),
  ],
);

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  profile: one(profiles, {
    fields: [notificationPreferences.profileId],
    references: [profiles.id],
  }),
}));

/** All valid notification channels. */
export const NOTIF_CHANNELS = ["email", "sms", "push"] as const;
export type NotifChannel = (typeof NOTIF_CHANNELS)[number];

/** All valid notification types. */
export const NOTIF_TYPES = [
  "booking_reminder",
  "review_request",
  "fill_reminder",
  "birthday_promo",
  "marketing",
] as const;
export type NotifType = (typeof NOTIF_TYPES)[number];
