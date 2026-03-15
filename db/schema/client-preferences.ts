/**
 * client_preferences — Beauty/service preferences for repeat clients.
 *
 * Stores lash-specific and general beauty preferences that are critical
 * for providing consistent, personalized service. Separate from `profiles`
 * to keep auth/CRM fields clean and because these preferences are only
 * relevant to clients (not admin/assistants).
 *
 * One row per client (1:1 with profiles where role = 'client').
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Client Preferences                                                 */
/* ------------------------------------------------------------------ */

export const clientPreferences = pgTable(
  "client_preferences",
  {
    /** 1:1 with profiles — the client's profile ID. */
    profileId: uuid("profile_id")
      .primaryKey()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /* ------ Lash preferences ------ */

    /** Preferred lash style (e.g. "classic", "hybrid", "volume", "mega volume"). */
    preferredLashStyle: varchar("preferred_lash_style", { length: 100 }),

    /** Preferred curl type (e.g. "C", "D", "CC", "L"). */
    preferredCurlType: varchar("preferred_curl_type", { length: 20 }),

    /** Preferred lash length range (e.g. "10-13mm"). */
    preferredLengths: varchar("preferred_lengths", { length: 50 }),

    /** Preferred lash diameter (e.g. "0.05mm", "0.07mm"). */
    preferredDiameter: varchar("preferred_diameter", { length: 20 }),

    /** Natural lash condition notes (e.g. "thin on outer corners, sparse inner"). */
    naturalLashNotes: text("natural_lash_notes"),

    /** Average retention between fills (e.g. "good — 3 weeks", "loses outer corners fast"). */
    retentionProfile: text("retention_profile"),

    /* ------ Health & sensitivities ------ */

    /** Known allergies relevant to services (adhesive, latex, metals, etc.). */
    allergies: text("allergies"),

    /** Skin type/sensitivities (e.g. "sensitive around eyes", "oily lids"). */
    skinType: varchar("skin_type", { length: 200 }),

    /** Whether the client has had an allergic reaction to lash adhesive before. */
    adhesiveSensitivity: boolean("adhesive_sensitivity").notNull().default(false),

    /** Other health notes relevant to service (e.g. "watery eyes", "contact lenses"). */
    healthNotes: text("health_notes"),

    /* ------ General preferences ------ */

    /** Client's birthday (for birthday promos and loyalty points). */
    birthday: date("birthday"),

    /** Preferred communication method (e.g. "text", "email", "instagram DM"). */
    preferredContactMethod: varchar("preferred_contact_method", { length: 50 }),

    /** Preferred service types as comma-separated (e.g. "lash,jewelry"). */
    preferredServiceTypes: text("preferred_service_types"),

    /** General preference notes (e.g. "likes quiet appointments, no music"). */
    generalNotes: text("general_notes"),

    /**
     * How often this client prefers to rebook, in days.
     * E.g. 14 = every 2 weeks, 21 = every 3 weeks.
     * Used to pre-fill the recurrence dropdown when creating a new booking.
     */
    preferredRebookIntervalDays: integer("preferred_rebook_interval_days"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("client_prefs_birthday_idx").on(t.birthday)],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const clientPreferencesRelations = relations(clientPreferences, ({ one }) => ({
  /** One-to-one: client_preferences.profile_id → profiles.id. */
  profile: one(profiles, {
    fields: [clientPreferences.profileId],
    references: [profiles.id],
  }),
}));
