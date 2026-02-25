ALTER TABLE "bookings" ADD COLUMN "square_order_id" varchar(100);--> statement-breakpoint
CREATE INDEX "bookings_square_order_idx" ON "bookings" USING btree ("square_order_id");