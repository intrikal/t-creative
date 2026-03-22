/**
 * form_submissions — Tracks which clients have completed which forms/waivers.
 *
 * Links to `client_forms` for the form definition and stores the submitted
 * data as JSONB. Essential for liability tracking — lash extension waivers,
 * allergy acknowledgments, and aftercare consent must be recorded with
 * timestamps and version tracking.
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
import { clientForms } from "./services";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Form Submissions                                                   */
/* ------------------------------------------------------------------ */

export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: serial("id").primaryKey(),

    /** The client who submitted the form. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /** The form definition that was filled out. */
    formId: integer("form_id")
      .notNull()
      .references(() => clientForms.id, { onDelete: "restrict" }),

    /**
     * Version identifier for the form at submission time.
     * Allows tracking which version of a waiver the client signed
     * (e.g. "2024-01", "2025-03"). Null = unversioned.
     */
    formVersion: varchar("form_version", { length: 50 }),

    /**
     * The submitted form data as JSONB.
     * Shape matches the `fields` definition on the parent `client_forms` row.
     */
    data: jsonb("data").$type<Record<string, unknown>>(),

    /**
     * Supabase Storage path to the signature image or PDF.
     * Null if the form doesn't require a signature.
     */
    signatureUrl: text("signature_url"),

    /** IP address at time of submission (for legal audit trail). */
    ipAddress: varchar("ip_address", { length: 45 }),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("form_submissions_client_idx").on(t.clientId),
    index("form_submissions_form_idx").on(t.formId),
    index("form_submissions_submitted_idx").on(t.submittedAt),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const formSubmissionsRelations = relations(formSubmissions, ({ one }) => ({
  /** Many-to-one: form_submissions.client_id → profiles.id. */
  client: one(profiles, {
    fields: [formSubmissions.clientId],
    references: [profiles.id],
  }),
  /** Many-to-one: form_submissions.form_id → client_forms.id. */
  form: one(clientForms, {
    fields: [formSubmissions.formId],
    references: [clientForms.id],
  }),
}));
