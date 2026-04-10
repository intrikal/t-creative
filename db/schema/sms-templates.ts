/**
 * sms-templates — Admin-editable SMS message templates.
 *
 * Each template has a unique slug (e.g. "booking-reminder") and a body with
 * Mustache-style {{variable}} placeholders. Cron jobs fetch the template at
 * send time via `renderSmsTemplate()` in `lib/sms-templates.ts`.
 */
import {
  boolean,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const smsTemplates = pgTable(
  "sms_templates",
  {
    id: serial("id").primaryKey(),

    /** Unique identifier used by cron jobs to look up the template. */
    slug: varchar("slug", { length: 100 }).notNull(),

    /** Human-readable name shown in the admin dashboard. */
    name: varchar("name", { length: 200 }).notNull(),

    /** Optional description explaining when this template is used. */
    description: text("description"),

    /** Message body with {{variable}} placeholders. */
    body: text("body").notNull(),

    /** Ordered list of variable names available in this template. */
    variables: jsonb("variables").notNull().default([]),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("sms_templates_slug_idx").on(t.slug)],
);
