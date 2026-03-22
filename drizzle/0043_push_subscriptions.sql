-- Add web_push to integration_provider enum for sync_log tracking.
ALTER TYPE "public"."integration_provider" ADD VALUE IF NOT EXISTS 'web_push';--> statement-breakpoint

-- Web Push notification subscriptions.
-- Each row = one browser/device that granted push permission.

CREATE TABLE "push_subscriptions" (
  "id" serial PRIMARY KEY,
  "profile_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone
);--> statement-breakpoint

CREATE INDEX "push_subs_profile_idx" ON "push_subscriptions" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "push_subs_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
