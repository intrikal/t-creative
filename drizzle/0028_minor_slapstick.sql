CREATE INDEX "bookings_starts_at_status_idx" ON "bookings" USING btree ("starts_at","status");--> statement-breakpoint
CREATE INDEX "bookings_client_starts_at_idx" ON "bookings" USING btree ("client_id","starts_at");--> statement-breakpoint
CREATE INDEX "payments_status_paid_at_idx" ON "payments" USING btree ("status","paid_at");