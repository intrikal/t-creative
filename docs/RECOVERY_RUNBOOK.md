# Recovery Runbook

This document covers what to do when Supabase has an incident — or when you
need to restore data for any reason. It is written as a step-by-step checklist
so you can follow it under pressure.

---

## Quick start

**Manual download works immediately** — no setup required:

```bash
# As an admin, hit this endpoint to download a full JSON snapshot
GET https://tcreativestudio.com/api/backup
```

Or open the admin dashboard → Settings → Data & Backup and click Download.

**To enable nightly off-site backups:**

1. Create a [Cloudflare R2](https://dash.cloudflare.com) bucket (free tier — 10 GB/month, enough for years of backups at this data volume).
2. Add three env vars to your deployment:
   ```
   BACKUP_S3_BUCKET=t-creative-backups
   BACKUP_S3_ACCESS_KEY_ID=<your-r2-key-id>
   BACKUP_S3_SECRET_ACCESS_KEY=<your-r2-secret>
   BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```
3. Run `supabase/migrations/20260315_nightly_backup_cron.sql` in the Supabase SQL Editor (replace `YOUR_SITE_URL` first).

That's it. The cron fires at 2 AM UTC. Check the audit log or your bucket the next morning to confirm.

---

## Table of Contents

0. [Quick start](#quick-start)
1. [Backup architecture overview](#1-backup-architecture-overview)
2. [Scenario A — Supabase project is down (temporary outage)](#2-scenario-a--supabase-project-is-down-temporary-outage)
3. [Scenario B — Data loss or corruption (partial restore)](#3-scenario-b--data-loss-or-corruption-partial-restore)
4. [Scenario C — Supabase project is deleted or unrecoverable (full restore)](#4-scenario-c--supabase-project-is-deleted-or-unrecoverable-full-restore)
5. [Environment variable reference](#5-environment-variable-reference)
6. [Supabase project settings reference](#6-supabase-project-settings-reference)
7. [Nightly backup health checks](#7-nightly-backup-health-checks)
8. [Manual backup procedures](#8-manual-backup-procedures)
9. [RTO / RPO expectations](#9-rto--rpo-expectations)

---

## 1. Backup architecture overview

The application uses three layers of data protection:

| Layer                             | What it covers                          | Managed by                  | Recovery method                         |
| --------------------------------- | --------------------------------------- | --------------------------- | --------------------------------------- |
| **Supabase managed backups**      | Full PostgreSQL snapshot                | Supabase                    | Restore via Dashboard or support ticket |
| **Point-in-Time Recovery (PITR)** | Any moment in the last 7–30 days        | Supabase (Pro+ plans)       | Dashboard → Database → Backups          |
| **Nightly JSON backups**          | All application tables, structured JSON | You (S3-compatible storage) | Import script or manual re-insertion    |

The JSON backups are produced by:

- **Automated**: `POST /api/cron/backup` — runs daily at 2:00 AM UTC via pg_cron
- **Manual**: Admin dashboard or `GET /api/backup` — download locally on demand

Backup files are stored at:

```
{BACKUP_S3_KEY_PREFIX}/YYYY/MM/DD/backup-{timestamp}.json.gz
```

e.g. `backups/2026/03/15/backup-1742054400000.json.gz`

The file is gzip-compressed JSON. Decompress with `gunzip` or any archive tool.

### What the JSON backup contains

Every table in the Drizzle schema, grouped by domain:

| Group             | Tables                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `identity`        | profiles                                                                                                                              |
| `services`        | services, serviceAddOns, serviceBundles, clientForms                                                                                  |
| `bookings`        | bookings, bookingAddOns                                                                                                               |
| `payments`        | payments, invoices, expenses                                                                                                          |
| `commerce`        | orders, products, productImages, promotions                                                                                           |
| `crm`             | clientPreferences, loyaltyTransactions, serviceRecords, reviews, formSubmissions, waitlist                                            |
| `giftCards`       | giftCards, giftCardTransactions                                                                                                       |
| `memberships`     | membershipPlans, membershipSubscriptions, bookingSubscriptions                                                                        |
| `staff`           | assistantProfiles, shifts                                                                                                             |
| `configuration`   | settings, policies, businessHours, timeOff, bookingRules, supplies                                                                    |
| `training`        | trainingPrograms, trainingSessions, trainingModules, trainingLessons, enrollments, certificates, lessonCompletions, sessionAttendance |
| `events`          | eventVenues, events, eventGuests                                                                                                      |
| `communications`  | threads, messages, threadParticipants, quickReplies, notifications                                                                    |
| `media`           | mediaItems, wishlistItems                                                                                                             |
| `inquiries`       | inquiries, productInquiries                                                                                                           |
| `integrationLogs` | syncLog, webhookEvents                                                                                                                |
| `audit`           | auditLog                                                                                                                              |

> **Note:** Media files (images, uploads) are stored in Supabase Storage, not in the
> database. They are **not** included in the JSON backup. Download them separately via
> the Supabase Dashboard → Storage before a project is deleted.

---

## 2. Scenario A — Supabase project is down (temporary outage)

**Symptoms:** Dashboard shows an incident, API returns 5xx, app is unavailable.

**Steps:**

1. **Check the Supabase status page**: https://status.supabase.com
2. **Check the Supabase Discord** for real-time updates.
3. **Do nothing** to the database — do not attempt restores during an active incident.
4. If the outage affects client-facing bookings, post a status update to clients
   via SMS (Twilio) or email (Resend) from a local script.
5. Once Supabase confirms resolution, verify the app is healthy:
   - Open the admin dashboard and confirm bookings load.
   - Check the audit log for any gaps during the outage window.

**Recovery time:** Typically minutes to hours depending on Supabase SLA tier.
No action required on your end for a pure outage.

---

## 3. Scenario B — Data loss or corruption (partial restore)

**Symptoms:** Records are missing, corrupted, or accidentally deleted.

### Option 1 — Supabase PITR (fastest, most complete)

> Requires Pro plan with PITR enabled. Check Dashboard → Database → Backups.

1. Note the timestamp **before** the corruption occurred.
2. Go to Supabase Dashboard → Database → Backups → Point in Time.
3. Select a recovery point before the corruption.
4. Supabase will restore the entire database to that point in time.
5. **Warning:** This is a full-database restore. Any changes made after the
   selected point will be lost. Export any new data first if needed.

### Option 2 — Restore from nightly JSON backup

Use this when PITR is unavailable or you only need to restore specific tables.

**Step 1 — Download the most recent backup before the incident**

```bash
# From your S3 bucket (adjust for your provider)
aws s3 cp s3://your-bucket/backups/2026/03/14/backup-1741996800000.json.gz ./restore.json.gz

# For Cloudflare R2
aws s3 cp s3://your-bucket/backups/2026/03/14/backup-1741996800000.json.gz ./restore.json.gz \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com

# Decompress
gunzip restore.json.gz
# → restore.json
```

**Step 2 — Inspect the backup**

```bash
# Check row counts per group
cat restore.json | jq '.summary'

# Preview a specific table
cat restore.json | jq '.groups.payments.tables.payments.rows | .[0:3]'
```

**Step 3 — Restore specific rows**

Extract the rows you need and re-insert via the Supabase SQL Editor or a
migration script. Example for restoring a deleted client:

```bash
# Extract a specific profile by ID
cat restore.json | jq '.groups.identity.tables.profiles.rows[] | select(.id == "uuid-here")'
```

Then paste the extracted values into a SQL `INSERT` statement in the Supabase
SQL Editor, or use `drizzle-kit studio` to insert them via the GUI.

---

## 4. Scenario C — Supabase project is deleted or unrecoverable (full restore)

Use this when the project itself is gone or Supabase is unable to restore it.

### Phase 1 — Create a new Supabase project

1. Go to https://supabase.com/dashboard and create a new project.
2. Note the new project's **URL**, **anon key**, and **service role key** —
   you will need these in Phase 3.
3. **Copy the database password** shown during project creation. Save it
   securely — it is only shown once.

### Phase 2 — Replay migrations (rebuild the schema)

The schema is fully reproducible from `supabase/migrations/`.

```bash
# In the project root, point Drizzle at the new project
export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres"

# Run all migrations
npx drizzle-kit migrate
```

Alternatively, copy the SQL from each migration file and run them in order in
the Supabase SQL Editor. Migration files are named chronologically — run in
alphabetical order:

```
20260225_pg_cron_scheduled_emails.sql
20260315_fill_reminder_cron.sql
20260315_nightly_backup_cron.sql
20260316_waitlist_claim_fields.sql
20260316_waitlist_expiry_cron.sql
```

> Remember to replace `YOUR_SITE_URL` in the cron migration files with the
> actual production URL before running.

### Phase 3 — Update environment variables

Update these in your deployment (Vercel / Railway / etc.):

| Variable                        | Where to find the new value                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Dashboard → Project Settings → API → Project URL                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → anon (public) key                           |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase Dashboard → Project Settings → API → service_role (secret) key                   |
| `DATABASE_URL`                  | Supabase Dashboard → Project Settings → Database → Connection string (Transaction pooler) |

All other variables (Square, Resend, Twilio, Zoho, PostHog) are **unchanged** —
they point to external services, not Supabase.

### Phase 4 — Restore auth users

Supabase auth users live in the `auth.users` table, which is managed by
Supabase and is **not** in your JSON backup (the `profiles` table references
auth users but the auth records themselves are in Supabase's internal schema).

Options:

- **Ask clients to sign up again** — easiest for a small studio. Send an email
  blast via Resend explaining the situation. Client profiles can be pre-populated
  from the backup.
- **Contact Supabase support** to request an auth export from the old project
  before it is fully purged.
- **Use the Supabase Management API** to re-invite users programmatically if
  you have a list of email addresses from the backup.

### Phase 5 — Restore application data from JSON backup

**Step 1 — Download the most recent backup**

```bash
aws s3 cp s3://your-bucket/backups/2026/03/15/backup-latest.json.gz ./restore.json.gz
gunzip restore.json.gz
```

**Step 2 — Write a restore script**

Create a one-off script that reads `restore.json` and bulk-inserts the rows
using the Drizzle client pointed at the new project. Example structure:

```typescript
// scripts/restore.ts
import restoreData from "./restore.json";
import { db } from "@/db";
import * as schema from "@/db/schema";

// Restore in dependency order (parents before children)
const groups = restoreData.groups;

// 1. Configuration (no foreign keys)
await db
  .insert(schema.settings)
  .values(groups.configuration.tables.settings.rows)
  .onConflictDoNothing();
await db
  .insert(schema.policies)
  .values(groups.configuration.tables.policies.rows)
  .onConflictDoNothing();

// 2. Services (referenced by bookings)
await db.insert(schema.services).values(groups.services.tables.services.rows).onConflictDoNothing();
await db
  .insert(schema.serviceAddOns)
  .values(groups.services.tables.serviceAddOns.rows)
  .onConflictDoNothing();

// 3. Profiles (after auth users exist in auth.users)
await db.insert(schema.profiles).values(groups.identity.tables.profiles.rows).onConflictDoNothing();

// 4. Continue for each table in FK dependency order...
// bookings → payments → invoices → etc.
```

Run the script with `npx tsx scripts/restore.ts`.

**Restore order** (FK dependency order, parents first):

```
1. settings, policies, businessHours, bookingRules  (no FKs)
2. services, serviceAddOns, serviceBundles           (no FKs)
3. products, promotions, supplies                    (no FKs)
4. membershipPlans, trainingPrograms, eventVenues    (no FKs)
5. profiles                                          (→ auth.users)
6. assistantProfiles                                 (→ profiles)
7. bookings, bookingAddOns                           (→ profiles, services)
8. payments                                          (→ bookings, profiles)
9. invoices                                          (→ profiles)
10. orders                                           (→ profiles, products)
11. giftCards, giftCardTransactions                  (→ profiles)
12. membershipSubscriptions, bookingSubscriptions    (→ profiles, plans)
13. loyaltyTransactions, serviceRecords, reviews     (→ profiles, bookings)
14. clientPreferences, formSubmissions, waitlist     (→ profiles, services)
15. enrollments, certificates                        (→ profiles, programs)
16. events, eventGuests                              (→ eventVenues, profiles)
17. threads, messages, threadParticipants            (→ profiles)
18. mediaItems, wishlistItems, notifications         (→ profiles)
19. inquiries, productInquiries                      (→ profiles, products)
20. auditLog                                         (→ profiles, optional)
```

### Phase 6 — Re-configure pg_cron jobs

Cron jobs are stored in the Supabase database, not in the application code.
After migrating the schema (Phase 2), run the cron migration files again to
re-register the jobs — or run the `SELECT cron.schedule(...)` statements
directly in the SQL Editor.

Set the cron secret on the new project:

```sql
ALTER DATABASE postgres SET app.settings.cron_secret = 'your-cron-secret-here';
```

### Phase 7 — Verify

- [ ] App loads without errors
- [ ] Admin can log in
- [ ] Booking list shows historical bookings
- [ ] Payment records are present
- [ ] Cron job history appears in `cron.job_run_details` after the next run
- [ ] A new nightly backup completes successfully

---

## 5. Environment variable reference

These are the variables that change between Supabase projects. All others
(Square, Twilio, Resend, Zoho, PostHog) are external services and remain the same.

| Variable                        | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Project API URL (`https://xyz.supabase.co`)                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (safe to expose in browser)                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | Service role key (server-only, bypasses RLS)                |
| `DATABASE_URL`                  | Postgres connection string (Transaction pooler recommended) |
| `CRON_SECRET`                   | Secret shared between pg_cron and the API cron routes       |

These control where backups are stored:

| Variable                      | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `BACKUP_S3_BUCKET`            | Bucket name                                                |
| `BACKUP_S3_ACCESS_KEY_ID`     | Access key ID                                              |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Secret access key                                          |
| `BACKUP_S3_REGION`            | Region (default: `auto`, works for R2 + Backblaze)         |
| `BACKUP_S3_ENDPOINT`          | Custom endpoint URL (R2 / Backblaze only; omit for AWS S3) |
| `BACKUP_S3_KEY_PREFIX`        | Path prefix inside the bucket (default: `backups`)         |

### Provider-specific endpoint URLs

| Provider      | Endpoint format                                 |
| ------------- | ----------------------------------------------- |
| AWS S3        | _(omit `BACKUP_S3_ENDPOINT`)_                   |
| Cloudflare R2 | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| Backblaze B2  | `https://s3.<REGION>.backblazeb2.com`           |

---

## 6. Supabase project settings reference

Find these in Supabase Dashboard → Project Settings:

| Setting           | Location                                              |
| ----------------- | ----------------------------------------------------- |
| Project URL       | API → Project URL                                     |
| Anon key          | API → Project API keys → anon (public)                |
| Service role key  | API → Project API keys → service_role                 |
| Database password | Database → Database password (only shown at creation) |
| Connection string | Database → Connection string → Transaction pooler     |
| PITR enabled      | Database → Backups                                    |
| pg_cron extension | Database → Extensions → pg_cron                       |
| pg_net extension  | Database → Extensions → pg_net                        |

---

## 7. Nightly backup health checks

**Verify backups are running** — check the audit log:

```sql
SELECT created_at, description, metadata
FROM audit_log
WHERE entity_type = 'backup'
ORDER BY created_at DESC
LIMIT 10;
```

**Verify backup files exist in storage:**

```bash
# List the last 7 days of backups
aws s3 ls s3://your-bucket/backups/ --recursive | sort | tail -14

# For R2
aws s3 ls s3://your-bucket/backups/ --recursive \
  --endpoint-url https://<account-id>.r2.cloudflarestorage.com | sort | tail -14
```

**Spot-check a backup file:**

```bash
aws s3 cp s3://your-bucket/backups/2026/03/15/backup-latest.json.gz - | \
  gunzip | jq '.summary'
```

Expected output:

```json
{
  "identity": 150,
  "services": 25,
  "bookings": 800,
  "payments": 600,
  ...
  "_total": 3500
}
```

If a day's backup is missing, trigger a manual backup:

```bash
curl -X POST https://tcreativestudio.com/api/backup \
  -H "Cookie: <admin-session-cookie>"
```

---

## 8. Manual backup procedures

### Download a JSON backup (admin dashboard)

The admin dashboard exposes a backup button at Settings → Data & Backup.
This calls `GET /api/backup` and downloads a `.json` file to your computer.

### Trigger an off-site upload from the browser

```bash
curl -X POST https://tcreativestudio.com/api/backup \
  -H "Cookie: <admin-session-cookie>"
```

Returns:

```json
{
  "ok": true,
  "key": "backups/2026/03/15/backup-1742054400000.json.gz",
  "compressedBytes": 51200,
  "rawBytes": 1048576,
  "compressionRatio": "95.1%",
  "uploadedAt": "2026-03-15T02:00:00.000Z",
  "summary": { "_total": 3500, ... }
}
```

### Export CSVs for specific date ranges

Use `GET /api/export?type=<type>&from=YYYY-MM-DD&to=YYYY-MM-DD` for flat
CSV exports of individual tables. Supported types:
`clients`, `bookings`, `payments`, `expenses`, `invoices`, `orders`.

These are useful for handing data to an accountant or importing into another
system, but they are not a substitute for a full backup.

---

## 9. RTO / RPO expectations

| Scenario                             | RPO (data loss)                      | RTO (downtime)   |
| ------------------------------------ | ------------------------------------ | ---------------- |
| Supabase temporary outage            | 0 (no data loss)                     | Minutes to hours |
| Partial corruption + PITR restore    | Minutes (to last PITR checkpoint)    | ~30 min          |
| Partial corruption + JSON restore    | Up to 24 hours (last nightly backup) | 1–3 hours        |
| Full project loss + migration replay | Up to 24 hours                       | 4–8 hours        |

**RPO** = Recovery Point Objective (maximum acceptable data loss)
**RTO** = Recovery Time Objective (maximum acceptable downtime)

To improve RPO: increase backup frequency (e.g. every 6 hours) by adding more
`cron.schedule()` entries in the migration file, or by calling `POST /api/backup`
after major operations (e.g. end of business day).

To improve RTO: keep this runbook up to date, store a printed copy offsite,
and do a practice restore drill once per quarter on a staging project.
