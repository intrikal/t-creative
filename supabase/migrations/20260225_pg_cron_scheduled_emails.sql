-- pg_cron scheduled jobs for deferred email sending.
--
-- These jobs call Next.js API routes secured with CRON_SECRET.
-- pg_net (Supabase HTTP extension) is used to make HTTP requests.
--
-- Prerequisites:
--   1. Enable pg_cron and pg_net extensions in Supabase Dashboard → Database → Extensions
--   2. Set CRON_SECRET env var in your Next.js deployment
--   3. Replace YOUR_SITE_URL below with your actual production URL
--
-- To apply: run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)

-- Enable required extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ──────────────────────────────────────────────────────────
-- 1. Birthday greetings — daily at 9:00 AM UTC
-- ──────────────────────────────────────────────────────────
SELECT cron.schedule(
  'send-birthday-emails',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SITE_URL/api/cron/birthdays',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ──────────────────────────────────────────────────────────
-- 2. Booking reminders (24h + 48h) — every hour
-- ──────────────────────────────────────────────────────────
SELECT cron.schedule(
  'send-booking-reminders',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SITE_URL/api/cron/booking-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ──────────────────────────────────────────────────────────
-- 3. Post-booking review requests — daily at 10:00 AM UTC
-- ──────────────────────────────────────────────────────────
SELECT cron.schedule(
  'send-review-requests',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SITE_URL/api/cron/review-requests',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ──────────────────────────────────────────────────────────
-- Helper: set the cron secret as a database setting
-- Run this ONCE after creating the jobs:
--
--   ALTER DATABASE postgres SET app.settings.cron_secret = 'your-secret-here';
--
-- Or pass the secret directly in the URL headers above.
-- ──────────────────────────────────────────────────────────
