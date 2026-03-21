-- Add TOS acceptance fields to bookings for legal record-keeping.
-- tos_accepted_at: timestamp when the client accepted the terms (NULL = pre-feature or admin-created).
-- tos_version:     the version string of the policy accepted (e.g. '2025-01').
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS tos_version     text;
