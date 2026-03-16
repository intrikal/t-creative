-- Nightly database backup cron job.
--
-- Schedules a daily call to /api/cron/backup, which:
--   1. Queries every table in the schema and builds a structured JSON manifest.
--   2. Gzip-compresses the manifest and uploads it to the configured
--      S3-compatible bucket (AWS S3, Cloudflare R2, or Backblaze B2).
--   3. Writes a summary entry to the audit_log table.
--
-- Prerequisites (complete in this order):
--   1. Enable pg_cron and pg_net extensions in Supabase Dashboard →
--      Database → Extensions (these are already on if other cron jobs work).
--   2. Set the CRON_SECRET env var in your Next.js deployment (Vercel /
--      Railway / etc.) — it must match the value used by other cron jobs.
--   3. Set backup storage env vars in your deployment:
--        BACKUP_S3_BUCKET
--        BACKUP_S3_ACCESS_KEY_ID
--        BACKUP_S3_SECRET_ACCESS_KEY
--        BACKUP_S3_ENDPOINT   (R2 / Backblaze only — omit for AWS S3)
--        BACKUP_S3_REGION     (defaults to "auto")
--   4. Replace YOUR_SITE_URL below with your production URL, then run this
--      SQL in the Supabase Dashboard → SQL Editor.
--   5. Verify the cron_secret database setting is set:
--        ALTER DATABASE postgres
--          SET app.settings.cron_secret = 'your-cron-secret-here';
--
-- To verify the job was created:
--   SELECT jobname, schedule, command FROM cron.job;
--
-- To view recent run history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
--
-- To remove this job:
--   SELECT cron.unschedule('nightly-database-backup');

-- Enable required extensions (idempotent — safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ──────────────────────────────────────────────────────────────────────────
-- Nightly database backup — daily at 2:00 AM UTC
--
-- 2 AM UTC chosen to minimise overlap with business hours (studio is
-- typically closed). Adjust the cron expression if your timezone differs:
--   '0 2 * * *'  →  2:00 AM UTC daily  (default)
--   '0 7 * * *'  →  7:00 AM UTC daily  (midnight PST / 3 AM EST)
-- ──────────────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'nightly-database-backup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url     := 'YOUR_SITE_URL/api/cron/backup',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  current_setting('app.settings.cron_secret', true)
    ),
    body    := '{}'::jsonb
  );
  $$
);
