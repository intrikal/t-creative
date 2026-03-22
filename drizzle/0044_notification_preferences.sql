-- Granular notification preferences: per-channel, per-type controls.

CREATE TYPE "notif_channel" AS ENUM ('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "notif_type" AS ENUM ('booking_reminder', 'review_request', 'fill_reminder', 'birthday_promo', 'marketing');--> statement-breakpoint

CREATE TABLE "notification_preferences" (
  "id" serial PRIMARY KEY,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "channel" "notif_channel" NOT NULL,
  "notification_type" "notif_type" NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE UNIQUE INDEX "notif_prefs_unique_idx" ON "notification_preferences" ("profile_id", "channel", "notification_type");--> statement-breakpoint
CREATE INDEX "notif_prefs_profile_idx" ON "notification_preferences" ("profile_id");
