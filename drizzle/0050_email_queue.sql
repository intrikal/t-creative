-- Email queue: fallback table for Resend emails that exceed the daily rate limit.
-- The queue is drained daily by the cron/email-queue-drain Inngest function.

CREATE TYPE "public"."email_queue_status" AS ENUM('pending', 'sent', 'failed');

CREATE TABLE "email_queue" (
  "id" serial PRIMARY KEY NOT NULL,
  "to" varchar(320) NOT NULL,
  "subject" varchar(500) NOT NULL,
  "html" text NOT NULL,
  "from" varchar(320) NOT NULL,
  "entity_type" varchar(100) NOT NULL,
  "local_id" varchar(100) NOT NULL,
  "status" "email_queue_status" DEFAULT 'pending' NOT NULL,
  "resend_id" varchar(100),
  "error_message" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "queued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "email_queue_status_idx" ON "email_queue" ("status");
CREATE INDEX "email_queue_queued_idx" ON "email_queue" ("queued_at");
