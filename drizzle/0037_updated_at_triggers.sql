-- Shared trigger function + per-table triggers for updated_at maintenance.
--
-- The function fires BEFORE UPDATE on every table that has an updated_at
-- column, setting NEW.updated_at = now(). This is the database-level
-- guarantee that updated_at always reflects the last write time, even for
-- updates made outside the ORM (e.g. direct SQL, migrations, scripts).
--
-- Part 1: Add missing updated_at columns to 7 tables.
-- Part 2: Create the shared trigger function.
-- Part 3: Create one trigger per table.

/* ------------------------------------------------------------------ */
/*  Part 1 — Add updated_at to tables that are missing it             */
/* ------------------------------------------------------------------ */

ALTER TABLE "form_submissions"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "loyalty_transactions"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "notifications"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "quick_replies"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "service_categories"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "threads"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "webhook_events"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

ALTER TABLE "wishlist_items"
  ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();--> statement-breakpoint

/* ------------------------------------------------------------------ */
/*  Part 2 — Shared trigger function                                   */
/* ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

/* ------------------------------------------------------------------ */
/*  Part 3 — One trigger per table                                     */
/* ------------------------------------------------------------------ */

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "assistant_profiles"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "booking_add_ons"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "booking_rules"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "booking_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "business_hours"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "certificates"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "client_forms"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "client_preferences"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "enrollments"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "event_guests"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "event_staff"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "event_venues"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "events"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "expenses"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "form_submissions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "gift_cards"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "inquiries"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "instagram_posts"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "invoices"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "legal_documents"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "lesson_completions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "loyalty_redemptions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "loyalty_rewards"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "loyalty_transactions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "media_items"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "membership_plans"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "membership_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "notifications"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "orders"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "payments"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "policies"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "product_images"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "product_inquiries"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "products"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "promotions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "quick_replies"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "reviews"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "service_add_ons"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "service_bundles"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "service_categories"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "service_records"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "services"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "session_attendance"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "settings"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "shifts"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "supplies"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "threads"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "time_off"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "training_lessons"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "training_modules"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "training_programs"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "training_sessions"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "waitlist"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "webhook_events"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();--> statement-breakpoint

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON "wishlist_items"
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();
