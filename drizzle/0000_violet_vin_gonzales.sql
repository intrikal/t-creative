CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."client_source" AS ENUM('instagram', 'word_of_mouth', 'google_search', 'referral', 'website_direct');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('waitlisted', 'enrolled', 'in_progress', 'completed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('private_party', 'pop_up', 'corporate', 'bridal', 'birthday');--> statement-breakpoint
CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'read', 'replied', 'archived');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('square', 'zoho');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('image', 'video', 'before_after');--> statement-breakpoint
CREATE TYPE "public"."message_channel" AS ENUM('internal', 'email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('inquiry', 'quoted', 'accepted', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('square_card', 'square_cash', 'square_wallet', 'square_gift_card', 'square_other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."policy_type" AS ENUM('aftercare', 'studio_policy');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('fixed_price', 'price_range', 'contact_for_quote');--> statement-breakpoint
CREATE TYPE "public"."product_availability" AS ENUM('in_stock', 'made_to_order', 'pre_order', 'out_of_stock');--> statement-breakpoint
CREATE TYPE "public"."product_inquiry_status" AS ENUM('new', 'contacted', 'quote_sent', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('custom_order', 'ready_made');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."service_category" AS ENUM('lash', 'jewelry', 'crochet', 'consulting');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('success', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."thread_status" AS ENUM('new', 'pending', 'contacted', 'approved', 'rejected', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."thread_type" AS ENUM('request', 'inquiry', 'confirmation', 'reminder', 'booking', 'general');--> statement-breakpoint
CREATE TYPE "public"."time_off_type" AS ENUM('day_off', 'vacation');--> statement-breakpoint
CREATE TYPE "public"."training_format" AS ENUM('in_person', 'hybrid', 'online');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'assistant', 'client');--> statement-breakpoint
CREATE TABLE "assistant_profiles" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"title" varchar(200),
	"specialties" text,
	"bio" text,
	"hourly_rate_in_cents" integer,
	"average_rating" numeric(3, 2),
	"is_available" boolean DEFAULT true NOT NULL,
	"start_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_add_ons" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"add_on_name" varchar(200) NOT NULL,
	"price_in_cents" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"buffer_between_minutes" integer DEFAULT 15 NOT NULL,
	"buffer_before_first_minutes" integer DEFAULT 0 NOT NULL,
	"buffer_after_last_minutes" integer DEFAULT 0 NOT NULL,
	"require_advance_notice" boolean DEFAULT true NOT NULL,
	"advance_notice_hours" integer DEFAULT 24 NOT NULL,
	"allow_same_day_cancellation" boolean DEFAULT false NOT NULL,
	"late_cancel_fee_percent" integer DEFAULT 50 NOT NULL,
	"no_show_fee_percent" integer DEFAULT 100 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"staff_id" uuid,
	"service_id" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_minutes" integer NOT NULL,
	"total_in_cents" integer NOT NULL,
	"client_notes" text,
	"staff_notes" text,
	"location" varchar(200),
	"square_appointment_id" varchar(100),
	"zoho_project_id" varchar(100),
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "business_hours" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" uuid,
	"day_of_week" smallint NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"opens_at" time,
	"closes_at" time,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrollment_id" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"program_id" integer NOT NULL,
	"certificate_code" varchar(100) NOT NULL,
	"pdf_storage_path" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "certificates_certificate_code_unique" UNIQUE("certificate_code")
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"program_id" integer NOT NULL,
	"session_id" integer,
	"status" "enrollment_status" DEFAULT 'enrolled' NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"amount_paid_in_cents" integer DEFAULT 0 NOT NULL,
	"square_payment_id" varchar(100),
	"sessions_completed" integer DEFAULT 0 NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"enrolled_by" uuid,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_id" uuid NOT NULL,
	"staff_id" uuid,
	"event_type" "event_type" NOT NULL,
	"status" "event_status" DEFAULT 'upcoming' NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" varchar(500),
	"address" text,
	"max_attendees" integer,
	"travel_fee_in_cents" integer,
	"price_in_cents" integer,
	"expected_revenue_in_cents" integer,
	"contact_name" varchar(200),
	"contact_email" varchar(320),
	"contact_phone" varchar(30),
	"services" text,
	"metadata" jsonb,
	"internal_notes" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid,
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"interest" "service_category",
	"name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30),
	"message" text NOT NULL,
	"staff_reply" text,
	"replied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "media_type" DEFAULT 'image' NOT NULL,
	"category" "service_category",
	"client_id" uuid,
	"title" varchar(300),
	"alt_text" varchar(500),
	"caption" text,
	"storage_path" text NOT NULL,
	"before_storage_path" text,
	"public_url" text,
	"file_size_bytes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" integer NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid,
	"channel" "message_channel" DEFAULT 'internal' NOT NULL,
	"body" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"client_id" uuid NOT NULL,
	"product_id" integer,
	"inquiry_id" integer,
	"status" "order_status" DEFAULT 'inquiry' NOT NULL,
	"category" "service_category",
	"title" varchar(300) NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"quoted_in_cents" integer,
	"final_in_cents" integer,
	"metadata" jsonb,
	"square_order_id" varchar(100),
	"internal_notes" text,
	"estimated_completion_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"method" "payment_method",
	"amount_in_cents" integer NOT NULL,
	"tip_in_cents" integer DEFAULT 0 NOT NULL,
	"refunded_in_cents" integer DEFAULT 0 NOT NULL,
	"square_payment_id" varchar(100),
	"square_order_id" varchar(100),
	"square_invoice_id" varchar(100),
	"square_receipt_url" text,
	"notes" text,
	"paid_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "policy_type" NOT NULL,
	"slug" varchar(200) NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text NOT NULL,
	"category" "service_category",
	"icon" varchar(50),
	"is_published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text,
	"alt_text" varchar(300),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"client_id" uuid,
	"status" "product_inquiry_status" DEFAULT 'new' NOT NULL,
	"client_name" varchar(200) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30),
	"quantity" integer DEFAULT 1 NOT NULL,
	"message" text,
	"customizations" text,
	"quoted_in_cents" integer,
	"internal_notes" text,
	"contacted_at" timestamp with time zone,
	"quote_sent_at" timestamp with time zone,
	"converted_order_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(300) NOT NULL,
	"slug" varchar(300) NOT NULL,
	"description" text,
	"product_type" "product_type" NOT NULL,
	"category" varchar(100) NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'fixed_price' NOT NULL,
	"price_in_cents" integer,
	"price_min_in_cents" integer,
	"price_max_in_cents" integer,
	"availability" "product_availability" DEFAULT 'made_to_order' NOT NULL,
	"lead_time" varchar(100),
	"stock_count" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 3 NOT NULL,
	"tags" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"square_catalog_id" varchar(100),
	"image_storage_path" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(320) NOT NULL,
	"phone" varchar(30),
	"display_name" varchar(200),
	"avatar_url" text,
	"internal_notes" text,
	"is_vip" boolean DEFAULT false NOT NULL,
	"tags" text,
	"source" "client_source",
	"notify_sms" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_marketing" boolean DEFAULT false NOT NULL,
	"referral_code" varchar(50),
	"referred_by" uuid,
	"square_customer_id" varchar(100),
	"zoho_contact_id" varchar(100),
	"onboarding_data" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email"),
	CONSTRAINT "profiles_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "quick_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" integer,
	"client_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"body" text,
	"service_name" varchar(300),
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"staff_response" text,
	"staff_responded_at" timestamp with time zone,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_add_ons" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price_in_cents" integer DEFAULT 0 NOT NULL,
	"additional_minutes" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" "service_category" NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"price_in_cents" integer,
	"duration_minutes" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"enrollment_id" integer NOT NULL,
	"attended" boolean DEFAULT true NOT NULL,
	"notes" text,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"label" varchar(300) NOT NULL,
	"description" text,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" serial PRIMARY KEY NOT NULL,
	"assistant_id" uuid NOT NULL,
	"status" "shift_status" DEFAULT 'scheduled' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"location" varchar(500),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"direction" "sync_direction" NOT NULL,
	"status" "sync_status" NOT NULL,
	"entity_type" varchar(100) NOT NULL,
	"local_id" varchar(100),
	"remote_id" varchar(100),
	"message" text,
	"error_message" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject" varchar(300) NOT NULL,
	"client_id" uuid NOT NULL,
	"thread_type" "thread_type" DEFAULT 'general' NOT NULL,
	"status" "thread_status" DEFAULT 'new' NOT NULL,
	"booking_id" integer,
	"is_starred" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"assigned_staff_id" uuid,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_off" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" uuid,
	"type" time_off_type NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"label" varchar(200),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_lessons" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"title" varchar(300) NOT NULL,
	"content" text,
	"resource_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "training_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"name" varchar(300) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "training_programs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"slug" varchar(300) NOT NULL,
	"description" text,
	"category" "service_category",
	"format" "training_format" DEFAULT 'in_person' NOT NULL,
	"duration_hours" integer,
	"duration_days" integer,
	"price_in_cents" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_students" integer,
	"certification_provided" boolean DEFAULT false NOT NULL,
	"kit_included" boolean DEFAULT false NOT NULL,
	"certificate_description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"program_id" integer NOT NULL,
	"status" "session_status" DEFAULT 'scheduled' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"location" varchar(300),
	"duration_hours" integer,
	"meeting_url" text,
	"max_students" integer,
	"is_waitlist_open" boolean DEFAULT true NOT NULL,
	"materials" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"external_event_id" varchar(200),
	"event_type" varchar(200) NOT NULL,
	"payload" jsonb NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"product_id" integer NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_profiles" ADD CONSTRAINT "assistant_profiles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_staff_id_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_enrolled_by_profiles_id_fk" FOREIGN KEY ("enrolled_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_host_id_profiles_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_staff_id_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_inquiries" ADD CONSTRAINT "product_inquiries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_inquiries" ADD CONSTRAINT "product_inquiries_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_add_ons" ADD CONSTRAINT "service_add_ons_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_session_id_training_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."training_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_attendance" ADD CONSTRAINT "session_attendance_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_assistant_id_profiles_id_fk" FOREIGN KEY ("assistant_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_assigned_staff_id_profiles_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_staff_id_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lessons" ADD CONSTRAINT "training_lessons_module_id_training_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."training_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_modules" ADD CONSTRAINT "training_modules_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_program_id_training_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."training_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_add_ons_booking_idx" ON "booking_add_ons" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bookings_staff_idx" ON "bookings" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "bookings_service_idx" ON "bookings" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_starts_at_idx" ON "bookings" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "bookings_square_id_idx" ON "bookings" USING btree ("square_appointment_id");--> statement-breakpoint
CREATE INDEX "business_hours_staff_day_idx" ON "business_hours" USING btree ("staff_id","day_of_week");--> statement-breakpoint
CREATE INDEX "certificates_client_idx" ON "certificates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "certificates_program_idx" ON "certificates" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "certificates_code_idx" ON "certificates" USING btree ("certificate_code");--> statement-breakpoint
CREATE INDEX "enrollments_client_idx" ON "enrollments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "enrollments_program_idx" ON "enrollments" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "enrollments_session_idx" ON "enrollments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "enrollments_status_idx" ON "enrollments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_host_idx" ON "events" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "events_staff_idx" ON "events" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "inquiries_client_idx" ON "inquiries" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "inquiries_status_idx" ON "inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "inquiries_email_idx" ON "inquiries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "media_client_idx" ON "media_items" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "media_category_idx" ON "media_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "media_published_idx" ON "media_items" USING btree ("is_published","sort_order");--> statement-breakpoint
CREATE INDEX "media_featured_idx" ON "media_items" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_recipient_idx" ON "messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "messages_unread_idx" ON "messages" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "orders_client_idx" ON "orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "orders_product_idx" ON "orders" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_category_idx" ON "orders" USING btree ("category");--> statement-breakpoint
CREATE INDEX "orders_square_idx" ON "orders" USING btree ("square_order_id");--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payments_client_idx" ON "payments" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "payments_square_id_idx" ON "payments" USING btree ("square_payment_id");--> statement-breakpoint
CREATE INDEX "policies_type_idx" ON "policies" USING btree ("type");--> statement-breakpoint
CREATE INDEX "policies_category_idx" ON "policies" USING btree ("category");--> statement-breakpoint
CREATE INDEX "policies_published_idx" ON "policies" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "policies_type_sort_idx" ON "policies" USING btree ("type","sort_order");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_inquiries_product_idx" ON "product_inquiries" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_inquiries_client_idx" ON "product_inquiries" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "product_inquiries_status_idx" ON "product_inquiries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_inquiries_email_idx" ON "product_inquiries" USING btree ("email");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_type_idx" ON "products" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "products_availability_idx" ON "products" USING btree ("availability");--> statement-breakpoint
CREATE INDEX "products_featured_idx" ON "products" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "products_published_idx" ON "products" USING btree ("is_published");--> statement-breakpoint
CREATE INDEX "products_square_id_idx" ON "products" USING btree ("square_catalog_id");--> statement-breakpoint
CREATE INDEX "profiles_role_idx" ON "profiles" USING btree ("role");--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "profiles_vip_idx" ON "profiles" USING btree ("is_vip");--> statement-breakpoint
CREATE INDEX "profiles_source_idx" ON "profiles" USING btree ("source");--> statement-breakpoint
CREATE INDEX "profiles_referral_code_idx" ON "profiles" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "profiles_referred_by_idx" ON "profiles" USING btree ("referred_by");--> statement-breakpoint
CREATE INDEX "profiles_square_id_idx" ON "profiles" USING btree ("square_customer_id");--> statement-breakpoint
CREATE INDEX "profiles_zoho_id_idx" ON "profiles" USING btree ("zoho_contact_id");--> statement-breakpoint
CREATE INDEX "reviews_booking_idx" ON "reviews" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "reviews_client_idx" ON "reviews" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "reviews_status_idx" ON "reviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reviews_featured_idx" ON "reviews" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "reviews_rating_idx" ON "reviews" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "add_ons_service_idx" ON "service_add_ons" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("category");--> statement-breakpoint
CREATE INDEX "services_active_sort_idx" ON "services" USING btree ("is_active","sort_order");--> statement-breakpoint
CREATE INDEX "attendance_session_idx" ON "session_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attendance_enrollment_idx" ON "session_attendance" USING btree ("enrollment_id");--> statement-breakpoint
CREATE INDEX "shifts_assistant_idx" ON "shifts" USING btree ("assistant_id");--> statement-breakpoint
CREATE INDEX "shifts_starts_at_idx" ON "shifts" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "sync_log_provider_idx" ON "sync_log" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "sync_log_entity_idx" ON "sync_log" USING btree ("entity_type","local_id");--> statement-breakpoint
CREATE INDEX "sync_log_created_idx" ON "sync_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "threads_client_idx" ON "threads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "threads_status_idx" ON "threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "threads_type_idx" ON "threads" USING btree ("thread_type");--> statement-breakpoint
CREATE INDEX "threads_starred_idx" ON "threads" USING btree ("is_starred");--> statement-breakpoint
CREATE INDEX "threads_archived_idx" ON "threads" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "threads_assigned_idx" ON "threads" USING btree ("assigned_staff_id");--> statement-breakpoint
CREATE INDEX "threads_last_message_idx" ON "threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "time_off_staff_idx" ON "time_off" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "time_off_dates_idx" ON "time_off" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "lessons_module_idx" ON "training_lessons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "modules_program_idx" ON "training_modules" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "sessions_program_idx" ON "training_sessions" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "sessions_starts_at_idx" ON "training_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "training_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "webhook_provider_idx" ON "webhook_events" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "webhook_event_type_idx" ON "webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhook_external_id_idx" ON "webhook_events" USING btree ("external_event_id");--> statement-breakpoint
CREATE INDEX "webhook_unprocessed_idx" ON "webhook_events" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "wishlist_client_idx" ON "wishlist_items" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "wishlist_product_idx" ON "wishlist_items" USING btree ("product_id");