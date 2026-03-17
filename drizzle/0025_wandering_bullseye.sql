ALTER TABLE "bookings" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "company_name" varchar(200);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "billing_email" varchar(200);--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "po_number" varchar(100);