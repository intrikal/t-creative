CREATE TYPE "public"."loyalty_redemption_status" AS ENUM('pending', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."loyalty_reward_category" AS ENUM('discount', 'add_on', 'service', 'product');--> statement-breakpoint
CREATE TABLE "loyalty_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"reward_id" integer NOT NULL,
	"transaction_id" uuid NOT NULL,
	"status" "loyalty_redemption_status" DEFAULT 'pending' NOT NULL,
	"booking_id" integer,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" varchar(200) NOT NULL,
	"points_cost" integer NOT NULL,
	"discount_in_cents" integer,
	"category" "loyalty_reward_category" NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_reward_id_loyalty_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_rewards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_transaction_id_loyalty_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."loyalty_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_redemptions" ADD CONSTRAINT "loyalty_redemptions_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loyalty_redemptions_profile_idx" ON "loyalty_redemptions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "loyalty_redemptions_status_idx" ON "loyalty_redemptions" USING btree ("profile_id","status");--> statement-breakpoint
CREATE INDEX "loyalty_redemptions_reward_idx" ON "loyalty_redemptions" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX "loyalty_rewards_active_idx" ON "loyalty_rewards" USING btree ("active","sort_order");