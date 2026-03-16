CREATE TYPE "public"."membership_status" AS ENUM('active', 'paused', 'cancelled', 'expired');--> statement-breakpoint
CREATE TABLE "membership_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"price_in_cents" integer NOT NULL,
	"fills_per_cycle" integer DEFAULT 1 NOT NULL,
	"product_discount_percent" integer DEFAULT 0 NOT NULL,
	"cycle_interval_days" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"perks" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membership_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "membership_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"plan_id" integer NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"fills_remaining_this_cycle" integer NOT NULL,
	"cycle_start_at" timestamp with time zone NOT NULL,
	"cycle_ends_at" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_subscriptions" ADD CONSTRAINT "membership_subscriptions_plan_id_membership_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."membership_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mem_subs_client_idx" ON "membership_subscriptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "mem_subs_plan_idx" ON "membership_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "mem_subs_status_idx" ON "membership_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mem_subs_cycle_ends_idx" ON "membership_subscriptions" USING btree ("cycle_ends_at");