CREATE TYPE "public"."loyalty_tx_type" AS ENUM('profile_complete', 'birthday_added', 'referral_referrer', 'referral_referee', 'first_booking', 'rebook', 'review', 'social_share', 'product_purchase', 'class_attendance', 'milestone_5th', 'milestone_10th', 'anniversary', 'new_service', 'redeemed', 'manual_credit', 'manual_debit', 'expired');--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"type" "loyalty_tx_type" NOT NULL,
	"description" text,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loyalty_tx_profile_idx" ON "loyalty_transactions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "loyalty_tx_type_idx" ON "loyalty_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "loyalty_tx_created_idx" ON "loyalty_transactions" USING btree ("created_at");