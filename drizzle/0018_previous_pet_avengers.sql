ALTER TABLE "threads" ADD COLUMN "reference_photo_urls" text[];--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "claim_token" varchar(100);--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "claim_token_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "offered_slot_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "waitlist" ADD COLUMN "offered_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_offered_staff_id_profiles_id_fk" FOREIGN KEY ("offered_staff_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waitlist" ADD CONSTRAINT "waitlist_claim_token_unique" UNIQUE("claim_token");