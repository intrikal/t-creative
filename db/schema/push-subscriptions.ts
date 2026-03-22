/**
 * push_subscriptions — Web Push notification subscriptions.
 *
 * Each row represents a browser/device that has granted push notification
 * permission. A client can have multiple subscriptions (phone + laptop).
 * The endpoint, p256dh, and auth fields come from the browser's
 * PushSubscription object and are required by the Web Push protocol.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription
 */
import { relations } from "drizzle-orm";
import { index, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { profiles } from "./users";

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),

    /** The client who owns this subscription. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** Web Push endpoint URL — unique per browser/device. */
    endpoint: text("endpoint").notNull(),

    /** ECDH public key for encrypting the push payload. */
    p256dh: text("p256dh").notNull(),

    /** Authentication secret for the push subscription. */
    auth: text("auth").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),

    /** When this subscription expires (if the browser reports it). */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("push_subs_profile_idx").on(t.profileId),
    index("push_subs_endpoint_idx").on(t.endpoint),
  ],
);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  profile: one(profiles, {
    fields: [pushSubscriptions.profileId],
    references: [profiles.id],
  }),
}));
