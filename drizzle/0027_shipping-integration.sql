ALTER TYPE "public"."integration_provider" ADD VALUE 'instagram';--> statement-breakpoint
ALTER TYPE "public"."integration_provider" ADD VALUE 'easypost';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'shipped' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "event_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"staff_id" uuid NOT NULL,
	"role" varchar(100),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instagram_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ig_media_id" varchar(100) NOT NULL,
	"ig_username" varchar(100) NOT NULL,
	"media_type" varchar(30) NOT NULL,
	"media_url" text NOT NULL,
	"thumbnail_url" text,
	"permalink" text NOT NULL,
	"caption" text,
	"posted_at" timestamp with time zone NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instagram_posts_ig_media_id_unique" UNIQUE("ig_media_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_address" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "easypost_shipment_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" varchar(200);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" varchar(500);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_label_url" varchar(500);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipping_cost_in_cents" integer;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_staff_id_profiles_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_staff_event_idx" ON "event_staff" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "event_staff_staff_idx" ON "event_staff" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "instagram_posts_username_idx" ON "instagram_posts" USING btree ("ig_username");--> statement-breakpoint
CREATE INDEX "instagram_posts_posted_at_idx" ON "instagram_posts" USING btree ("posted_at");--> statement-breakpoint
CREATE INDEX "instagram_posts_visible_idx" ON "instagram_posts" USING btree ("is_visible","posted_at");