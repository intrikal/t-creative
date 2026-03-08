CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'status_change', 'login', 'export');--> statement-breakpoint
CREATE TYPE "public"."gift_card_tx_type" AS ENUM('purchase', 'redemption', 'refund', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'clicked');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('booking_reminder', 'booking_confirmation', 'booking_cancellation', 'review_request', 'waitlist_alert', 'promotion', 'form_request', 'general');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'notified', 'booked', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"description" text,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_preferences" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"preferred_lash_style" varchar(100),
	"preferred_curl_type" varchar(20),
	"preferred_lengths" varchar(50),
	"preferred_diameter" varchar(20),
	"natural_lash_notes" text,
	"retention_profile" text,
	"allergies" text,
	"skin_type" varchar(200),
	"adhesive_sensitivity" boolean DEFAULT false NOT NULL,
	"health_notes" text,
	"birthday" date,
	"preferred_contact_method" varchar(50),
	"preferred_service_types" text,
	"general_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"form_id" integer NOT NULL,
	"form_version" varchar(50),
	"data" jsonb,
	"signature_url" text,
	"ip_address" varchar(45),
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"gift_card_id" integer NOT NULL,
	"type" "gift_card_tx_type" NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"balance_after_in_cents" integer NOT NULL,
	"booking_id" integer,
	"performed_by" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "message_channel" NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"title" varchar(300) NOT NULL,
	"body" text,
	"related_entity_type" varchar(50),
	"related_entity_id" integer,
	"external_id" varchar(200),
	"error_message" text,
	"scheduled_for" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"staff_id" uuid,
	"lash_mapping" text,
	"curl_type" varchar(20),
	"diameter" varchar(20),
	"lengths" varchar(100),
	"adhesive" varchar(200),
	"retention_notes" text,
	"products_used" text,
	"notes" text,
	"reactions" text,
	"next_visit_notes" text,
	"metadata" jsonb,
	"before_photo_path" text,
	"after_photo_path" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" integer NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"preferred_date_start" date,
	"preferred_date_end" date,
	"time_preference" text,
	"notes" text,
	"notified_at" timestamp with time zone,
	"booked_booking_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "recurrence_rule" varchar(200);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "parent_booking_id" integer;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "tax_amount_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "client_consent_given" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "service_id" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tax_amount_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "tax_amount_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "client_preferences" ADD CONSTRAINT "client_preferences_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_client_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."client_forms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transactions" ADD CONSTRAINT "gift_card_transactions_performed_by_profiles_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_records" ADD CONSTRAINT "service_records_staff_id_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "client_prefs_birthday_idx" ON "client_preferences" USING btree ("birthday");--> statement-breakpoint
CREATE INDEX "form_submissions_client_idx" ON "form_submissions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "form_submissions_submitted_idx" ON "form_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "gift_card_tx_card_idx" ON "gift_card_transactions" USING btree ("gift_card_id");--> statement-breakpoint
CREATE INDEX "gift_card_tx_type_idx" ON "gift_card_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gift_card_tx_booking_idx" ON "gift_card_transactions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "gift_card_tx_created_idx" ON "gift_card_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_profile_idx" ON "notifications" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "notifications_type_idx" ON "notifications" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_scheduled_idx" ON "notifications" USING btree ("scheduled_for");--> statement-breakpoint
CREATE INDEX "notifications_entity_idx" ON "notifications" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "service_records_booking_idx" ON "service_records" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "service_records_client_idx" ON "service_records" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "service_records_staff_idx" ON "service_records" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "service_records_created_idx" ON "service_records" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "waitlist_client_idx" ON "waitlist" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "waitlist_service_idx" ON "waitlist" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "waitlist_status_idx" ON "waitlist" USING btree ("status");--> statement-breakpoint
CREATE INDEX "waitlist_dates_idx" ON "waitlist" USING btree ("preferred_date_start","preferred_date_end");--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;