/**
 * media — Portfolio items and media assets.
 *
 * Stores metadata for images and videos displayed in the portfolio
 * gallery, before/after comparisons, and service showcases. Actual
 * files live in Supabase Storage — this table tracks the reference
 * paths, captions, and categorization.
 *
 * Supports the public portfolio page and the admin media library.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { mediaTypeEnum, serviceCategoryEnum } from "./enums";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Media Items                                                        */
/* ------------------------------------------------------------------ */

export const mediaItems = pgTable(
  "media_items",
  {
    id: serial("id").primaryKey(),

    /** Asset type — determines gallery rendering (single image, video player, side-by-side). */
    type: mediaTypeEnum("type").notNull().default("image"),

    /** Service zone this media belongs to — filters the portfolio by category. */
    category: serviceCategoryEnum("category"),

    /**
     * Client this media is associated with (nullable).
     * When set, the photo appears in the client's "My Portfolio" view.
     * Trini tags photos to clients after sessions (e.g. lash results).
     */
    clientId: uuid("client_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /** Display title in the portfolio gallery. */
    title: varchar("title", { length: 300 }),

    /** Alt text for accessibility and SEO. */
    altText: varchar("alt_text", { length: 500 }),

    /** Caption shown below the image in the gallery. */
    caption: text("caption"),

    /** Supabase Storage path (e.g. "portfolio/lash/classic-set-01.jpg"). */
    storagePath: text("storage_path").notNull(),

    /** For before/after pairs — path to the "before" image. */
    beforeStoragePath: text("before_storage_path"),

    /**
     * Public CDN URL — auto-generated from `storagePath` via Supabase Storage.
     * Cached here to avoid per-request URL generation. Refreshed when the
     * storage path changes or on a scheduled cache-bust.
     */
    publicUrl: text("public_url"),

    /**
     * File size in bytes — displayed in the admin media library for storage
     * management (e.g. "2.4 MB"). Populated on upload via Supabase Storage metadata.
     */
    fileSizeBytes: integer("file_size_bytes"),

    /** Display order within a category (lower = first). */
    sortOrder: integer("sort_order").notNull().default(0),

    /** Whether visible on the public portfolio page. */
    isPublished: boolean("is_published").notNull().default(false),

    /** Whether this is a featured/hero image for its category. */
    isFeatured: boolean("is_featured").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("media_client_idx").on(t.clientId),
    index("media_category_idx").on(t.category),
    index("media_published_idx").on(t.isPublished, t.sortOrder),
    index("media_featured_idx").on(t.isFeatured),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const mediaItemsRelations = relations(mediaItems, ({ one }) => ({
  /** Many-to-one: many media items can be tagged to one client (media_items.client_id → profiles.id, nullable). */
  client: one(profiles, {
    fields: [mediaItems.clientId],
    references: [profiles.id],
  }),
}));
