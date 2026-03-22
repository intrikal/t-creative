-- Partial indexes — smaller and faster than full indexes because they skip
-- rows that are never touched in normal query paths.

-- Active (non-deleted, non-cancelled) bookings per client ordered by date.
-- Used by the client history view and calendar queries.
CREATE INDEX "bookings_active_client_idx"
  ON "bookings" ("client_id", "starts_at")
  WHERE "deleted_at" IS NULL AND "status" NOT IN ('cancelled');--> statement-breakpoint

-- Paid payments within a date range.
-- Used by the financial dashboard and revenue reports.
CREATE INDEX "payments_paid_range_idx"
  ON "payments" ("paid_at")
  WHERE "status" = 'paid';--> statement-breakpoint

-- Currently live promotions.
-- Used by the booking flow's promo-code lookup.
CREATE INDEX "promotions_live_idx"
  ON "promotions" ("starts_at", "ends_at")
  WHERE "is_active" = true;
