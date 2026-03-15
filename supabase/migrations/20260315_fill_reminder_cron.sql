-- pg_cron job for lash fill reminder emails.
--
-- Runs daily at 11:00 AM UTC. Finds clients whose last completed lash
-- booking was 18–19 days ago and who have no upcoming lash appointment,
-- then sends a "time for your fill" reminder email via the Next.js API.
--
-- Prerequisites (shared with other cron jobs):
--   1. pg_cron and pg_net extensions enabled in Supabase Dashboard
--   2. CRON_SECRET env var set in your Next.js deployment
--   3. Replace YOUR_SITE_URL with your actual production URL (or update
--      the existing jobs to use a shared variable)
--
-- To apply: run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)

-- ──────────────────────────────────────────────────────────
-- Lash fill reminders — daily at 11:00 AM UTC
-- ──────────────────────────────────────────────────────────
SELECT cron.schedule(
  'send-fill-reminders',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url := 'YOUR_SITE_URL/api/cron/fill-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
