ALTER TABLE "bookings" ADD COLUMN "zoho_invoice_id" varchar(100);--> statement-breakpoint
ALTER TABLE "enrollments" ADD COLUMN "zoho_invoice_id" varchar(100);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "zoho_invoice_id" varchar(100);--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "zoho_customer_id" varchar(100);--> statement-breakpoint
CREATE INDEX "profiles_zoho_customer_idx" ON "profiles" USING btree ("zoho_customer_id");