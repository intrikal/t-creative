/**
 * intake_form_definitions & intake_form_submissions — Service-level intake forms.
 *
 * Separate from the existing `client_forms` / `form_submissions` system which
 * handles waivers and consent forms. Intake forms are:
 * - Tied to a specific service (or global if service_id is null)
 * - Versioned — each edit bumps the version so historical submissions reference
 *   the exact field set the client saw
 * - Linked to bookings, not just clients — staff sees responses in booking detail
 * - Pre-fillable from the client's last submission for the same form definition
 *
 * Field types: text, textarea, select, multiselect, checkbox, date.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { bookings } from "./bookings";
import { services } from "./services";
import { profiles } from "./users";

/* ------------------------------------------------------------------ */
/*  Enums                                                              */
/* ------------------------------------------------------------------ */

export const intakeFieldTypeEnum = pgEnum("intake_field_type", [
  "text",
  "textarea",
  "select",
  "multiselect",
  "checkbox",
  "date",
]);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Shape of each field in the `fields` JSONB column.
 * Stored as an array of these objects.
 */
export type IntakeFormField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "checkbox" | "date";
  required: boolean;
  /** Options for select / multiselect fields. */
  options?: string[];
};

/* ------------------------------------------------------------------ */
/*  Intake Form Definitions                                            */
/* ------------------------------------------------------------------ */

export const intakeFormDefinitions = pgTable(
  "intake_form_definitions",
  {
    id: serial("id").primaryKey(),

    /** Nullable — null means this form applies globally to all services. */
    serviceId: integer("service_id").references(() => services.id, {
      onDelete: "cascade",
    }),

    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),

    /**
     * JSONB array of IntakeFormField objects.
     * Defines the field set for this version.
     */
    fields: jsonb("fields").$type<IntakeFormField[]>().notNull().default([]),

    /** Monotonically increasing version number. Bumped on each field edit. */
    version: integer("version").notNull().default(1),

    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("intake_form_defs_service_idx").on(t.serviceId),
    index("intake_form_defs_active_idx").on(t.isActive),
  ],
);

/* ------------------------------------------------------------------ */
/*  Intake Form Submissions                                            */
/* ------------------------------------------------------------------ */

export const intakeFormSubmissions = pgTable(
  "intake_form_submissions",
  {
    id: serial("id").primaryKey(),

    /** The booking this submission is attached to. */
    bookingId: integer("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    /** The form definition that was filled out. */
    formDefinitionId: integer("form_definition_id")
      .notNull()
      .references(() => intakeFormDefinitions.id, { onDelete: "restrict" }),

    /** The client who submitted. */
    clientId: uuid("client_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),

    /**
     * JSONB object mapping field IDs to their submitted values.
     * Shape: Record<string, string | string[] | boolean>
     */
    responses: jsonb("responses").$type<Record<string, unknown>>().notNull(),

    /** Snapshot of the form version at submission time. */
    formVersion: integer("form_version").notNull(),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("intake_subs_booking_idx").on(t.bookingId),
    index("intake_subs_definition_idx").on(t.formDefinitionId),
    index("intake_subs_client_idx").on(t.clientId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Relations                                                          */
/* ------------------------------------------------------------------ */

export const intakeFormDefinitionsRelations = relations(intakeFormDefinitions, ({ one, many }) => ({
  service: one(services, {
    fields: [intakeFormDefinitions.serviceId],
    references: [services.id],
  }),
  submissions: many(intakeFormSubmissions),
}));

export const intakeFormSubmissionsRelations = relations(intakeFormSubmissions, ({ one }) => ({
  booking: one(bookings, {
    fields: [intakeFormSubmissions.bookingId],
    references: [bookings.id],
  }),
  formDefinition: one(intakeFormDefinitions, {
    fields: [intakeFormSubmissions.formDefinitionId],
    references: [intakeFormDefinitions.id],
  }),
  client: one(profiles, {
    fields: [intakeFormSubmissions.clientId],
    references: [profiles.id],
  }),
}));
