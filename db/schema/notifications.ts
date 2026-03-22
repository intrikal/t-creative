/**
 * notifications — Notification delivery tracking.
 *
 * Tracks push/email/SMS notification delivery for booking reminders,
 * review requests, promotional blasts, waitlist alerts, and form requests.
 * Works alongside the notification preference booleans on `profiles`
 * (notifySms, notifyEmail, notifyMarketing).
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { messageChannelEnum, notificationStatusEnum, notificationTypeEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),

    /** The recipient. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** What kind of notification this is. */
    type: notificationTypeEnum("type").notNull(),

    /** Delivery channel (email, sms, internal). */
    channel: messageChannelEnum("channel").notNull(),

    status: notificationStatusEnum("status").notNull().default("pending"),

    /** Notification subject/title. */
    title: varchar("title", { length: 300 }).notNull(),

    /** Notification body content. */
    body: text("body"),

    /**
     * Related entity type (e.g. "booking", "review", "waitlist").
     * Used for deep-linking and context.
     */
    relatedEntityType: varchar("related_entity_type", { length: 50 }),

    /** Related entity ID (e.g. booking ID, waitlist entry ID). */
    relatedEntityId: integer("related_entity_id"),

    /** External delivery ID from email/SMS provider for tracking. */
    externalId: varchar("external_id", { length: 200 }),

    /** Error message if delivery failed. */
    errorMessage: text("error_message"),

    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("notifications_profile_idx").on(t.profileId),
    index("notifications_type_idx").on(t.type),
    index("notifications_status_idx").on(t.status),
    index("notifications_scheduled_idx").on(t.scheduledFor),
    index("notifications_entity_idx").on(t.relatedEntityType, t.relatedEntityId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const notificationsRelations = relations(notifications, ({ one }) => ({
  /** Many-to-one: notifications.profile_id → profiles.id. */
  profile: one(profiles, {
    fields: [notifications.profileId],
    references: [profiles.id],
  }),
}));
