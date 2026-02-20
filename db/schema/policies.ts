/**
 * policies — Aftercare instructions and studio policies.
 *
 * Two content types managed from the "Aftercare & Policies" dashboard view:
 *
 * 1. **Aftercare Instructions** — Per-service care guides shown to clients
 *    after their appointment (e.g. "Lash Extensions — First 24-48 Hours").
 *    Rich markdown content with sections, bullet points, and callouts.
 *
 * 2. **Studio Policies** — Business policies displayed on the portal and
 *    referenced in booking confirmations (e.g. "Cancellation & Rescheduling",
 *    "Deposit Policy", "Health & Safety").
 *
 * Both live in the same table, distinguished by the `type` column which
 * maps to the two tabs in the admin UI.
 */
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { serviceCategoryEnum } from "./enums";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/** Distinguishes the two tabs in the Aftercare & Policies admin view. */
export const policyTypeEnum = pgEnum("policy_type", ["aftercare", "studio_policy"]);

/* ------------------------------------------------------------------ */
/*  Policies                                                           */
/* ------------------------------------------------------------------ */

export const policies = pgTable(
  "policies",
  {
    id: serial("id").primaryKey(),

    type: policyTypeEnum("type").notNull(),

    /** URL-friendly identifier (e.g. "lash-aftercare", "cancellation-policy"). */
    slug: varchar("slug", { length: 200 }).notNull().unique(),

    title: varchar("title", { length: 300 }).notNull(),

    /**
     * Rich text / markdown content.
     *
     * Aftercare example: sections for "First 24-48 Hours", "Daily Care",
     * "What to Avoid" with bullet lists.
     *
     * Policy example: "24-Hour Notice Required" heading, callout blocks
     * for fee warnings, rescheduling rules.
     */
    content: text("content").notNull(),

    /**
     * Service category this applies to.
     *
     * - Aftercare: always set (lash, jewelry, crochet) — groups the
     *   "3 Service types" count in the dashboard summary.
     * - Studio policies: usually null (business-wide), but can target
     *   a specific service (e.g. "Lash-specific deposit policy").
     */
    category: serviceCategoryEnum("category"),

    /** Icon identifier for the admin UI (e.g. "heart", "clock", "shield"). */
    icon: varchar("icon", { length: 50 }),

    /** Whether visible to clients on the portal. */
    isPublished: boolean("is_published").notNull().default(true),

    /** Display order within its type tab (lower = first). */
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("policies_type_idx").on(t.type),
    index("policies_category_idx").on(t.category),
    index("policies_published_idx").on(t.isPublished),
    index("policies_type_sort_idx").on(t.type, t.sortOrder),
  ],
);
