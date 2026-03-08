/**
 * service_records — Post-appointment service notes and history.
 *
 * After each lash appointment, staff log detailed notes about the service:
 * lash mapping, products used, retention observations, technique adjustments.
 * This is standard in the beauty industry and essential for providing
 * consistent results across repeat visits.
 *
 * Separate from `bookings.staffNotes` which captures pre/during-appointment
 * context. Service records are the structured post-service documentation.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Service Records                                                    */
/* ------------------------------------------------------------------ */

export const serviceRecords = pgTable(
  "service_records",
  {
    id: serial("id").primaryKey(),

    /** The booking this record documents. */
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    /** The client (denormalized for faster lookups without joining bookings). */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** Staff member who performed the service and wrote the notes. */
    staffId: uuid("staff_id").references(() => profiles.id, {
      onDelete: "set null",
    }),

    /* ------ Lash-specific fields ------ */

    /** Lash mapping notes (e.g. "cat-eye, longer on outer corners"). */
    lashMapping: text("lash_mapping"),

    /** Curl type used (e.g. "C", "D", "CC"). */
    curlType: varchar("curl_type", { length: 20 }),

    /** Lash diameter used (e.g. "0.05mm", "0.07mm"). */
    diameter: varchar("diameter", { length: 20 }),

    /** Lash lengths used (e.g. "9-12mm mixed"). */
    lengths: varchar("lengths", { length: 100 }),

    /** Adhesive used and drying conditions. */
    adhesive: varchar("adhesive", { length: 200 }),

    /** How long the previous set lasted (for retention tracking). */
    retentionNotes: text("retention_notes"),

    /* ------ General fields ------ */

    /** Products used during the service. */
    productsUsed: text("products_used"),

    /** General service notes and observations. */
    notes: text("notes"),

    /** Any reactions or sensitivities observed. */
    reactions: text("reactions"),

    /** Recommendations for next visit. */
    nextVisitNotes: text("next_visit_notes"),

    /**
     * Flexible metadata for service-specific details.
     * E.g. for jewelry: `{ "metal": "14k gold-fill", "chainLength": "16in" }`
     */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    /** Before/after photo storage paths. */
    beforePhotoPath: text("before_photo_path"),
    afterPhotoPath: text("after_photo_path"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("service_records_booking_idx").on(t.bookingId),
    index("service_records_client_idx").on(t.clientId),
    index("service_records_staff_idx").on(t.staffId),
    index("service_records_created_idx").on(t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const serviceRecordsRelations = relations(serviceRecords, ({ one }) => ({
  /** Many-to-one: service_records.booking_id → bookings.id. */
  booking: one(bookings, {
    fields: [serviceRecords.bookingId],
    references: [bookings.id],
  }),
  /** Many-to-one: service_records.client_id → profiles.id. */
  client: one(profiles, {
    fields: [serviceRecords.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: service_records.staff_id → profiles.id. */
  staff: one(profiles, {
    fields: [serviceRecords.staffId],
    references: [profiles.id],
    relationName: "serviceRecordStaff",
  }),
}));
