-- ⚠️  REQUIRES REVIEW — This migration adds a new table for storing Google
--    Calendar OAuth2 tokens. It was generated on the feat/google-calendar-sync
--    branch and must be reviewed before applying to production.

CREATE TABLE IF NOT EXISTS "google_calendar_tokens" (
  "id" serial PRIMARY KEY,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "calendar_id" varchar(200) DEFAULT 'primary',
  "sync_enabled" boolean NOT NULL DEFAULT true,
  "last_synced_at" timestamp with time zone,
  "watch_channel_id" varchar(200),
  "watch_resource_id" varchar(200),
  "watch_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE("profile_id")
);

CREATE INDEX "gcal_tokens_profile_idx" ON "google_calendar_tokens"("profile_id");

-- Add Google Calendar event ID to bookings for two-way sync matching.
ALTER TABLE "bookings" ADD COLUMN "google_calendar_event_id" varchar(200);
