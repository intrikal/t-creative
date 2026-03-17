-- pg_cron job for recurring booking auto-creation (safety net).
--
-- Runs hourly at minute 45 (staggered from other hourly jobs).
-- Catches cases where the inline generateNextRecurringBooking() call
-- silently failed when a booking was marked completed.
--
-- Prerequisites (shared with other cron jobs):
--   1. pg_cron and pg_net extensions enabled in Supabase Dashboard
--   2. CRON_SECRET env var set in your Next.js deployment
--   3. Replace YOUR_SITE_URL with your actual production URL

-- ──────────────────────────────────────────────────────────
-- Recurring booking auto-creation — hourly at :45
-- ──────────────────────────────────────────────────────────
SELECT cron.schedule(
  'generate-recurring-bookings',
  '45 * * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SITE_URL/api/cron/recurring-bookings',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
