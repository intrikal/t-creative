/**
 * google-calendar — OAuth2 token storage for Google Calendar two-way sync.
 *
 * Each staff member (admin or assistant) can connect their Google account to
 * enable automatic syncing of bookings to their Google Calendar. One row per
 * profile; tokens are refreshed transparently by `lib/google-calendar.ts`.
 *
 * The `calendar_id` column defaults to "primary" but can be overridden if
 * the user wants events pushed to a secondary calendar.
 *
 * ## Related files
 * - lib/google-calendar.ts               — OAuth2 + Calendar API helpers
 * - app/api/auth/google-calendar/callback — OAuth callback route
 * - drizzle/0051_google_calendar_tokens.sql — Migration
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Google Calendar Tokens                                             */
/* ------------------------------------------------------------------ */

export const googleCalendarTokens = pgTable(
  "google_calendar_tokens",
  {
    id: serial("id").primaryKey(),

    /** Profile that owns this token set — one connection per user. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" })
      .unique(),

    /** OAuth2 access token (short-lived, ~1 hour). */
    accessToken: text("access_token").notNull(),

    /** OAuth2 refresh token (long-lived, used to obtain new access tokens). */
    refreshToken: text("refresh_token").notNull(),

    /** When the current access token expires. */
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }).notNull(),

    /** Which Google Calendar to sync events to. */
    calendarId: varchar("calendar_id", { length: 200 }).default("primary"),

    /** Whether sync is currently enabled for this user. */
    syncEnabled: boolean("sync_enabled").notNull().default(true),

    /** Last successful sync timestamp. */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),

    /** Google push notification channel ID (format: "gcal-watch-{profileId}"). */
    watchChannelId: varchar("watch_channel_id", { length: 200 }),

    /** Google-assigned resource ID for the active watch. */
    watchResourceId: varchar("watch_resource_id", { length: 200 }),

    /** When the current watch expires (Google max is 7 days). */
    watchExpiresAt: timestamp("watch_expires_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("gcal_tokens_profile_idx").on(t.profileId)],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const googleCalendarTokensRelations = relations(googleCalendarTokens, ({ one }) => ({
  /** The profile that owns this Google Calendar connection. */
  profile: one(profiles, {
    fields: [googleCalendarTokens.profileId],
    references: [profiles.id],
  }),
}));
