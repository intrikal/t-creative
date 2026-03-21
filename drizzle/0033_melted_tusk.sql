CREATE INDEX "bookings_staff_starts_status_idx" ON "bookings" USING btree ("staff_id","starts_at","status");--> statement-breakpoint
CREATE INDEX "messages_thread_created_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_thread_read_sender_idx" ON "messages" USING btree ("thread_id","is_read","sender_id");--> statement-breakpoint
CREATE INDEX "payments_client_status_idx" ON "payments" USING btree ("client_id","status");--> statement-breakpoint
CREATE INDEX "profiles_created_at_idx" ON "profiles" USING btree ("created_at");