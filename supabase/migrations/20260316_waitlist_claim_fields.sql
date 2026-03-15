-- Add waitlist claim token fields for self-booking from notification emails.
--
-- When a booking is cancelled, the next person on the waitlist receives a
-- notification email containing a unique /book/claim/<token> link. These
-- columns store the token and the specific slot being offered so the client
-- can confirm with one click.
--
-- To apply: run in Supabase SQL Editor (Dashboard → SQL Editor)

ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS claim_token        VARCHAR(100) UNIQUE,
  ADD COLUMN IF NOT EXISTS claim_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offered_slot_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offered_staff_id   UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for fast token lookups on the claim page
CREATE INDEX IF NOT EXISTS waitlist_claim_token_idx
  ON waitlist (claim_token)
  WHERE claim_token IS NOT NULL;
