CREATE TYPE "public"."venue_type" AS ENUM('studio', 'client_home', 'external_venue', 'pop_up_venue', 'corporate_venue');--> statement-breakpoint
CREATE TABLE "event_venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"address" text,
	"venue_type" "venue_type" DEFAULT 'external_venue' NOT NULL,
	"parking_info" text,
	"setup_notes" text,
	"default_travel_fee_in_cents" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_profiles" ADD COLUMN "commission_type" varchar(20) DEFAULT 'percentage' NOT NULL;--> statement-breakpoint
ALTER TABLE "assistant_profiles" ADD COLUMN "commission_flat_fee_in_cents" integer;--> statement-breakpoint
ALTER TABLE "assistant_profiles" ADD COLUMN "tip_split_percent" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "venue_id" integer;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "equipment_notes" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_event_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."event_venues"("id") ON DELETE set null ON UPDATE no action;