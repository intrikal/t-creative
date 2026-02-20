/**
 * settings — Business configuration and site settings.
 *
 * Key-value store for runtime configuration that Trini can update
 * from the admin Settings panel without code changes. Covers things
 * like business info, notification defaults, branding overrides,
 * and feature flags.
 *
 * Uses a simple key-value pattern with JSON values for flexibility.
 * Type safety is enforced at the application layer via Zod schemas
 * that validate the `value` column based on the `key`.
 *
 * @example Known keys (validated in app layer):
 *   "business_name"       → string ("T Creative Studio")
 *   "business_phone"      → string ("(408) 555-1234")
 *   "business_email"      → string ("trini@tcreative.studio")
 *   "business_address"    → { street, city, state, zip }
 *   "social_links"        → { instagram, tiktok, facebook }
 *   "default_timezone"    → string ("America/Los_Angeles")
 *   "booking_enabled"     → boolean (true)
 *   "marketplace_enabled" → boolean (true)
 *   "seo_meta"            → { title, description, ogImage }
 */
import { jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Settings                                                           */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  /**
   * Unique setting key — used as the PK (no auto-increment ID needed).
   * Convention: snake_case, dot-separated for nested groups
   * (e.g. "notifications.sms_enabled", "branding.primary_color").
   */
  key: varchar("key", { length: 200 }).primaryKey(),

  /** Human-readable label shown in the admin Settings panel. */
  label: varchar("label", { length: 300 }).notNull(),

  /** Help text shown below the setting input in the admin UI. */
  description: text("description"),

  /**
   * JSON-serialized value. The shape varies per key — strings, booleans,
   * numbers, objects, and arrays are all valid. Type validation happens
   * in the app layer via key-specific Zod schemas, not at the DB level.
   */
  value: jsonb("value").$type<unknown>().notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
