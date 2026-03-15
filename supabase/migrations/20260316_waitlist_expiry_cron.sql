-- pg_cron job for advancing the waitlist queue when claim tokens expire.
--
-- Runs hourly. Finds "notified" waitlist entries whose 24-hour claim window
-- has passed without being claimed, marks them as "expired", and offers the
-- same slot to the next person in line via the Next.js API.
--
-- Prerequisites (shared with other cron jobs):
--   1. pg_cron and pg_net extensions enabled in Supabase Dashboard
--   2. CRON_SECRET env var set in your Next.js deployment
--   3. Replace YOUR_SITE_URL with your actual production URL
--
-- To apply: run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)

-- ──────────────────────────────────────────────────────────────────────
-- Waitlist expiry — hourly (runs at minute 30 to stagger with reminders)
-- ──────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'waitlist-expiry',
  '30 * * * *',
  $$
  SELECT net.http_get(
    url := 'YOUR_SITE_URL/api/cron/waitlist-expiry',
    headers := jsonb_build_object(
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    )
  );
  $$
);
