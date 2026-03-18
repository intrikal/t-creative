/**
 * instagram_posts — Cached Instagram posts for the landing page feed.
 *
 * The cron job at /api/cron/instagram-sync fetches the latest posts
 * from the Instagram Graph API and upserts them here. The landing page
 * reads from this table so the site stays fresh without manual updates
 * and without hitting IG rate limits on every page load.
 *
 * Each post is keyed by its Instagram media ID (`igMediaId`) for
 * idempotent upserts. The cron only keeps the most recent N posts
 * and soft-deletes older ones.
 */
import {
  index,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

export const instagramPosts = pgTable(
  "instagram_posts",
  {
    id: serial("id").primaryKey(),

    /** Instagram media ID — unique, used for upsert deduplication. */
    igMediaId: varchar("ig_media_id", { length: 100 }).notNull().unique(),

    /** Which IG account this came from (handle without @). */
    igUsername: varchar("ig_username", { length: 100 }).notNull(),

    /** IMAGE, VIDEO, or CAROUSEL_ALBUM. */
    mediaType: varchar("media_type", { length: 30 }).notNull(),

    /** CDN URL of the image/video/thumbnail. */
    mediaUrl: text("media_url").notNull(),

    /** Thumbnail URL for VIDEO posts. Null for images. */
    thumbnailUrl: text("thumbnail_url"),

    /** Post permalink on Instagram. */
    permalink: text("permalink").notNull(),

    /** Caption text (may be null for posts without captions). */
    caption: text("caption"),

    /** When the post was originally published on Instagram. */
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),

    /** Whether to show this post on the site. Admin can toggle off. */
    isVisible: boolean("is_visible").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("instagram_posts_username_idx").on(t.igUsername),
    index("instagram_posts_posted_at_idx").on(t.postedAt),
    index("instagram_posts_visible_idx").on(t.isVisible, t.postedAt),
  ],
);
