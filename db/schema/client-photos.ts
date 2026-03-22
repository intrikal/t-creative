/**
 * client_photos — Per-booking photo gallery for before/after/reference images.
 *
 * Stores metadata for photos uploaded to Supabase Storage bucket `client-photos`.
 * Photos are organized by booking and accessible to both staff (who upload them)
 * and clients (who view their own gallery). RLS enforces that clients can only
 * read their own photos and staff can only insert for bookings they're assigned to.
 */
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const photoTypeEnum = pgEnum("photo_type", ["before", "after", "reference"]);

/* ------------------------------------------------------------------ */
/*  Table                                                              */
/* ------------------------------------------------------------------ */

export const clientPhotos = pgTable(
  "client_photos",
  {
    id: serial("id").primaryKey(),

    /** The booking this photo belongs to. */
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    /** The client whose gallery this photo appears in. */
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The staff member or client who uploaded the photo. */
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => profiles.id, { onDelete: "set null" }),

    photoType: photoTypeEnum("photo_type").notNull(),

    /** Supabase Storage path: client-photos/{profile_id}/{booking_id}/{filename} */
    storagePath: text("storage_path").notNull(),

    /** Optional notes about the photo (e.g. "Left eye close-up"). */
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("client_photos_booking_idx").on(t.bookingId),
    index("client_photos_profile_idx").on(t.profileId),
    index("client_photos_uploaded_by_idx").on(t.uploadedBy),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const clientPhotosRelations = relations(clientPhotos, ({ one }) => ({
  booking: one(bookings, {
    fields: [clientPhotos.bookingId],
    references: [bookings.id],
  }),
  profile: one(profiles, {
    fields: [clientPhotos.profileId],
    references: [profiles.id],
    relationName: "clientPhotosOwner",
  }),
  uploader: one(profiles, {
    fields: [clientPhotos.uploadedBy],
    references: [profiles.id],
    relationName: "clientPhotosUploader",
  }),
}));
