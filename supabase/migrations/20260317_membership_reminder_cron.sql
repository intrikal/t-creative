-- pg_cron job for membership cycle renewal reminder emails.
--
-- Runs daily at 14:00 UTC (10 AM ET). Finds active memberships whose
-- cycle ends in 3–4 days and sends a reminder email. If the member has
-- unused fills, the email highlights them ("You have 1 fill remaining —
-- book now before your cycle resets on April 1").
--
-- Prerequisites (shared with other cron jobs):
--   1. pg_cron and pg_net extensions enabled in Supabase Dashboard
--   2. CRON_SECRET env var set in your Next.js deployment
--   3. Replace YOUR_SITE_URL with your actual production URL
--
-- To apply: run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)

-- ──────────────────────────────────────────────────────────
-- Membership cycle reminders — daily at 14:00 UTC
-- ──────────────────────────────────────────────────────────
SELECT cron.schedule(
  'send-membership-reminders',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SITE_URL/api/cron/membership-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
