CREATE TYPE "public"."subscription_status" AS ENUM('active', 'paused', 'completed', 'cancelled');--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'twilio';--> statement-breakpoint
CREATE TABLE "booking_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"service_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"total_sessions" integer NOT NULL,
	"sessions_used" integer DEFAULT 0 NOT NULL,
	"interval_days" integer NOT NULL,
	"price_per_session_in_cents" integer NOT NULL,
	"total_paid_in_cents" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "subscription_id" integer;--> statement-breakpoint
ALTER TABLE "client_preferences" ADD COLUMN "preferred_rebook_interval_days" integer;--> statement-breakpoint
ALTER TABLE "booking_subscriptions" ADD CONSTRAINT "booking_subscriptions_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_subscriptions" ADD CONSTRAINT "booking_subscriptions_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subs_client_idx" ON "booking_subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "subs_service_idx" ON "booking_subscriptions" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "subs_status_idx" ON "booking_subscriptions" USING btree ("status");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subscription_id_booking_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."booking_subscriptions"("id") ON DELETE set null ON UPDATE no action;