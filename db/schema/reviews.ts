/**
 * reviews — Client reviews and ratings.
 *
 * Clients leave reviews tied to a specific booking (service experience).
 * The Reviews Management dashboard shows:
 *   - Metrics: Average Rating, Total Reviews, Pending Approval, Featured count
 *   - Filters: Status (Approved / Pending / Rejected), Rating (1–5 stars)
 *   - Each card: client name, status badge, featured badge, star rating,
 *     service name, date, review body, and Trini's response
 *   - Actions: Approve, Reject, Feature/Unfeature, Respond/Edit Response
 *
 * Reviews start as "pending" when submitted by a client. Trini approves
 * or rejects them. Approved reviews can be featured on the public website.
 * Trini can write a public response shown beneath the review.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

/**
 * Review moderation status — drives the "All Status" filter dropdown.
 *
 * - `pending`  — Awaiting Trini's review (feeds "Pending Approval" metric).
 * - `approved` — Visible on the public website.
 * - `rejected` — Hidden from public, kept for records.
 */
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);

/* ------------------------------------------------------------------ */
/*  Reviews                                                            */
/* ------------------------------------------------------------------ */

export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),

    /**
     * Optional link to the specific booking being reviewed.
     * Nullable because the client review form uses a freeform service
     * name field (stored in `serviceName`) rather than requiring a
     * booking selection. The app layer can auto-link to a booking if
     * the client has a matching completed booking.
     */
    bookingId: integer("booking_id").references(() => bookings.id, {
      onDelete: "restrict",
    }),

    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** 1–5 star rating. Filterable via the "All Ratings" dropdown. */
    rating: smallint("rating").notNull(),

    /** Client's written review body. */
    body: text("body"),

    /**
     * Service name displayed on the review card (e.g. "Classic Lash Set",
     * "Permanent Jewelry"). Snapshotted from the booking's service at
     * review creation time so it persists even if the service is renamed.
     */
    serviceName: varchar("service_name", { length: 300 }),

    /** Moderation status — Pending → Approved / Rejected. */
    status: reviewStatusEnum("status").notNull().default("pending"),

    /**
     * Whether this review is featured on the public website.
     * Only approved reviews can be featured. Feeds the "Featured" metric
     * and shows the "Featured" badge on the review card.
     */
    isFeatured: boolean("is_featured").notNull().default(false),

    /** Optional public response from Trini (shown in teal box beneath review). */
    staffResponse: text("staff_response"),

    /** When Trini posted or last edited her response. */
    staffRespondedAt: timestamp("staff_responded_at", { withTimezone: true }),

    /** Whether the review has been flagged for moderation (spam, inappropriate). */
    isFlagged: boolean("is_flagged").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("reviews_booking_idx").on(t.bookingId),
    index("reviews_client_idx").on(t.clientId),
    index("reviews_status_idx").on(t.status),
    index("reviews_featured_idx").on(t.isFeatured),
    index("reviews_rating_idx").on(t.rating),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const reviewsRelations = relations(reviews, ({ one }) => ({
  /** Many-to-one: many reviews can reference one booking (reviews.booking_id → bookings.id, nullable). */
  booking: one(bookings, {
    fields: [reviews.bookingId],
    references: [bookings.id],
  }),
  /** Many-to-one: many reviews belong to one client (reviews.client_id → profiles.id). */
  client: one(profiles, {
    fields: [reviews.clientId],
    references: [profiles.id],
  }),
}));
