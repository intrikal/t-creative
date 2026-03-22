-- Intake form definitions & submissions (per-service, versioned, booking-linked)

CREATE TYPE "intake_field_type" AS ENUM (
  'text', 'textarea', 'select', 'multiselect', 'checkbox', 'date'
);

CREATE TABLE "intake_form_definitions" (
  "id" serial PRIMARY KEY,
  "service_id" integer REFERENCES "services"("id") ON DELETE CASCADE,
  "name" varchar(200) NOT NULL,
  "description" text,
  "fields" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "version" integer NOT NULL DEFAULT 1,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "intake_form_submissions" (
  "id" serial PRIMARY KEY,
  "booking_id" integer NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "form_definition_id" integer NOT NULL REFERENCES "intake_form_definitions"("id") ON DELETE RESTRICT,
  "client_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "responses" jsonb NOT NULL,
  "form_version" integer NOT NULL,
  "submitted_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "intake_form_defs_service_idx" ON "intake_form_definitions" ("service_id");
CREATE INDEX "intake_form_defs_active_idx" ON "intake_form_definitions" ("is_active");
CREATE INDEX "intake_subs_booking_idx" ON "intake_form_submissions" ("booking_id");
CREATE INDEX "intake_subs_definition_idx" ON "intake_form_submissions" ("form_definition_id");
CREATE INDEX "intake_subs_client_idx" ON "intake_form_submissions" ("client_id");
