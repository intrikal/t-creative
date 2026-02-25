CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed', 'bogo');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('supplies', 'rent', 'marketing', 'equipment', 'software', 'travel', 'other');--> statement-breakpoint
CREATE TYPE "public"."gift_card_status" AS ENUM('active', 'redeemed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue');--> statement-breakpoint
ALTER TYPE "public"."client_source" ADD VALUE 'event';--> statement-breakpoint
ALTER TYPE "public"."event_status" ADD VALUE 'draft' BEFORE 'upcoming';--> statement-breakpoint
ALTER TYPE "public"."event_status" ADD VALUE 'confirmed' BEFORE 'in_progress';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'travel';--> statement-breakpoint
ALTER TYPE "public"."event_type" ADD VALUE 'workshop';--> statement-breakpoint
ALTER TYPE "public"."pricing_type" ADD VALUE 'starting_at' BEFORE 'price_range';--> statement-breakpoint
CREATE TABLE "event_guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"service" varchar(200),
	"paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"expense_date" timestamp with time zone NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text NOT NULL,
	"vendor" varchar(150),
	"amount_in_cents" integer NOT NULL,
	"has_receipt" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"purchased_by_client_id" uuid,
	"recipient_name" varchar(150),
	"original_amount_in_cents" integer NOT NULL,
	"balance_in_cents" integer NOT NULL,
	"status" "gift_card_status" DEFAULT 'active' NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" uuid NOT NULL,
	"number" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"amount_in_cents" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"notes" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurrence_interval" varchar(20),
	"next_due_at" timestamp with time zone,
	"parent_invoice_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"lesson_id" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"discount_value" integer NOT NULL,
	"description" text,
	"applies_to" "service_category",
	"max_uses" integer,
	"redemption_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(300) NOT NULL,
	"category" varchar(100),
	"unit" varchar(50) NOT NULL,
	"stock_count" integer DEFAULT 0 NOT NULL,
	"reorder_point" integer DEFAULT 0 NOT NULL,
	"last_restocked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_profiles" ADD COLUMN "commission_rate_percent" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "gift_card_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "promotion_id" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "discount_in_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_paid_in_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "deposit_paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "deposit_in_cents" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "event_source_name" varchar(200);--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "source" varchar(50);--> statement-breakpoint
ALTER TABLE "event_guests" ADD CONSTRAINT "event_guests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_purchased_by_client_id_profiles_id_fk" FOREIGN KEY ("purchased_by_client_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_profiles_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_parent_invoice_id_invoices_id_fk" FOREIGN KEY ("parent_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_training_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_guests_event_idx" ON "event_guests" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "expenses_created_by_idx" ON "expenses" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_cards_code_idx" ON "gift_cards" USING btree ("code");--> statement-breakpoint
CREATE INDEX "gift_cards_purchased_by_idx" ON "gift_cards" USING btree ("purchased_by_client_id");--> statement-breakpoint
CREATE INDEX "gift_cards_status_idx" ON "gift_cards" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_recurring_idx" ON "invoices" USING btree ("is_recurring");--> statement-breakpoint
CREATE INDEX "invoices_next_due_idx" ON "invoices" USING btree ("next_due_at");--> statement-breakpoint
CREATE INDEX "lesson_completions_profile_idx" ON "lesson_completions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "lesson_completions_lesson_idx" ON "lesson_completions" USING btree ("lesson_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_code_idx" ON "promotions" USING btree ("code");--> statement-breakpoint
CREATE INDEX "promotions_active_idx" ON "promotions" USING btree ("is_active");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_gift_card_id_gift_cards_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_gift_card_idx" ON "bookings" USING btree ("gift_card_id");--> statement-breakpoint
CREATE INDEX "bookings_promotion_idx" ON "bookings" USING btree ("promotion_id");