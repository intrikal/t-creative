-- Defensive CHECK constraints — database-level last line of defense
-- if a bug bypasses Zod validation in server actions.

-- bookings
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_total_in_cents_nonneg"
    CHECK (total_in_cents >= 0),
  ADD CONSTRAINT "bookings_duration_minutes_pos"
    CHECK (duration_minutes > 0),
  ADD CONSTRAINT "bookings_discount_in_cents_nonneg"
    CHECK (discount_in_cents >= 0),
  ADD CONSTRAINT "bookings_discount_lte_total"
    CHECK (discount_in_cents <= total_in_cents),
  ADD CONSTRAINT "bookings_deposit_paid_nonneg"
    CHECK (deposit_paid_in_cents IS NULL OR deposit_paid_in_cents >= 0);--> statement-breakpoint

-- payments
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_amount_in_cents_pos"
    CHECK (amount_in_cents > 0);--> statement-breakpoint

-- gift_cards
ALTER TABLE "gift_cards"
  ADD CONSTRAINT "gift_cards_balance_in_cents_nonneg"
    CHECK (balance_in_cents >= 0);
