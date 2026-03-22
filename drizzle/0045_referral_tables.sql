-- Referral codes and referral tracking tables.
-- Complements the existing referralCode/referredBy fields on profiles
-- by providing booking-level referral tracking and configurable cash rewards.

CREATE TYPE "referral_status" AS ENUM ('pending', 'completed', 'expired');

CREATE TABLE "referral_codes" (
  "id" serial PRIMARY KEY,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL UNIQUE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "referral_codes_profile_idx" ON "referral_codes" ("profile_id");

CREATE TABLE "referrals" (
  "id" serial PRIMARY KEY,
  "referrer_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "referred_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "booking_id" integer REFERENCES "bookings"("id") ON DELETE SET NULL,
  "status" "referral_status" NOT NULL DEFAULT 'pending',
  "reward_amount_in_cents" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "referrals_referrer_idx" ON "referrals" ("referrer_id");
CREATE INDEX "referrals_referred_idx" ON "referrals" ("referred_id");
CREATE INDEX "referrals_booking_idx" ON "referrals" ("booking_id");
CREATE INDEX "referrals_status_idx" ON "referrals" ("status");

-- Track which referral code was used when the booking was created.
-- Stored on the booking so we can credit the referrer on completion.
ALTER TABLE "bookings" ADD COLUMN "referrer_code" varchar(50);
