# Integration Setup Guide

Step-by-step instructions for configuring every third-party service used by T Creative Studio. Follow each section in order — required integrations are marked.

> **Tip:** Copy `.env.example` to `.env.local` and fill in values as you go.
>
> ```bash
> cp .env.example .env.local
> ```

---

## Table of Contents

1. [Supabase (required)](#1-supabase-required)
2. [Square (required for payments)](#2-square-required-for-payments)
3. [Resend (required for emails)](#3-resend-required-for-emails)
4. [Zoho CRM + Books + Campaigns](#4-zoho-crm--books--campaigns)
5. [Twilio (optional, for SMS)](#5-twilio-optional-for-sms)
6. [PostHog (optional, for analytics)](#6-posthog-optional-for-analytics)
7. [Sentry (optional, for error tracking)](#7-sentry-optional-for-error-tracking)
8. [Cloudflare Turnstile (required for public forms)](#8-cloudflare-turnstile-required-for-public-forms)
9. [S3-Compatible Backup Storage (optional)](#9-s3-compatible-backup-storage-optional)
10. [Instagram (optional, for feed sync)](#10-instagram-optional-for-feed-sync)
11. [App Configuration](#11-app-configuration)

---

## 1. Supabase (required)

Supabase provides the PostgreSQL database, authentication (Google OAuth via PKCE flow), row-level security, storage, and pg_cron for scheduled jobs.

### Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in (or create an account)
2. Click **New Project**
3. Choose an organization (or create one)
4. Name the project (e.g. `t-creative`)
5. Set a strong database password — **save it now**, it is only shown once
6. Select a region close to your users (e.g. `us-west-1` for California)
7. Click **Create new project** and wait for provisioning (~2 minutes)

### Get API credentials

1. Go to **Project Settings → API**
2. Copy these values into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...      # "anon (public)" key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...           # "service_role" key — keep secret
```

### Get database connection strings

1. Go to **Project Settings → Database**
2. Copy the **Transaction pooler** connection string (port 6543) → `DATABASE_URL`
3. Copy the **Direct connection** string (port 5432) → `DIRECT_URL`

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

> **Why two URLs?** The app uses the pooled connection (`DATABASE_URL`, port 6543) at runtime because Supabase's PgBouncer handles connection limits in serverless environments. Drizzle Kit migrations use the direct connection (`DIRECT_URL`, port 5432) because DDL statements require a non-pooled connection.

### Enable Google OAuth

1. Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URIs: add `https://your-project-ref.supabase.co/auth/v1/callback`
5. Copy the **Client ID** and **Client Secret**
6. In Supabase, go to **Authentication → Providers → Google**
7. Toggle Google to **Enabled**
8. Paste the Client ID and Client Secret
9. Save

The app's auth callback handler (`app/auth/callback/route.ts`) completes the PKCE flow, assigns roles based on email allowlists and invite tokens, checks account status, syncs to PostHog and Zoho CRM, and routes users to the appropriate dashboard.

### Run database migrations

```bash
# Apply Drizzle schema migrations (creates all application tables)
npx drizzle-kit migrate

# Apply Supabase-specific migrations (RLS policies, pg_cron jobs, storage buckets)
# Run each file in supabase/migrations/ via the Supabase SQL Editor:
# Dashboard → SQL Editor → New Query → paste contents → Run
```

> **Important:** In cron migration files, replace `YOUR_SITE_URL` with your actual production URL before running.

### Verify it's working

1. Open the app locally (`npm run dev`)
2. Click "Sign in with Google"
3. You should be redirected through Google, back to Supabase, then to your app's dashboard
4. Check the `profiles` table in Supabase → Table Editor — your profile should appear

### If not configured

The app will not start without Supabase credentials. The database client (`db/index.ts`) throws immediately if `DATABASE_URL` is missing. The Supabase auth client requires both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### Env vars

| Variable                        | Required | Description                                            |
| ------------------------------- | -------- | ------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Project API URL                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Public anon key (safe for browser)                     |
| `SUPABASE_SERVICE_ROLE_KEY`     | Yes      | Service role key (server-only, bypasses RLS)           |
| `DATABASE_URL`                  | Yes      | Connection pooler URL (port 6543)                      |
| `DIRECT_URL`                    | Yes      | Direct connection URL (port 5432, for migrations only) |

---

## 2. Square (required for payments)

Square handles payment processing, payment links, refunds, and tax calculation. The app creates Square orders and payment links for bookings and product orders, then receives webhook events when payments complete.

### Create a Square application

1. Go to [developer.squareup.com](https://developer.squareup.com) and sign in (or create a developer account)
2. Click **+** (Create Application) on the dashboard
3. Name it (e.g. `T Creative Studio`)
4. Click **Save**

### Get credentials

1. In your application, go to **Credentials** (or **OAuth** for production tokens)
2. Copy the **Access Token** (use Sandbox for testing, Production for live)
3. Go to the [Square Dashboard → Locations](https://squareup.com/dashboard/locations)
4. Copy the **Location ID** for your studio location

```env
SQUARE_ACCESS_TOKEN=EAAAl...
SQUARE_LOCATION_ID=L...
SQUARE_ENVIRONMENT=sandbox   # Change to "production" when ready for real payments
```

### Set up the webhook

1. In the [Square Developer Dashboard](https://developer.squareup.com/apps), select your application
2. Go to **Webhooks** → **Add Endpoint**
3. URL: `https://tcreativestudio.com/api/webhooks/square`
4. Subscribe to these events:
   - `payment.completed`
   - `payment.updated`
   - `refund.created`
   - `refund.updated`
5. Click **Save**
6. Copy the **Signature Key** shown after saving

```env
SQUARE_WEBHOOK_SIGNATURE_KEY=your-signature-key
```

The webhook handler (`app/api/webhooks/square/route.ts`) verifies HMAC-SHA256 signatures, stores raw events for audit/replay, auto-links payments to bookings and product orders, sends receipt emails, records payments in Zoho Books, and awards loyalty points. It always returns HTTP 200 to Square — processing failures are tracked in the `webhook_events` table.

### Configure sales tax

1. Go to [Square Dashboard → Settings → Sales Tax](https://squareup.com/dashboard/sales-tax)
2. Enable tax for your San Jose, CA location
3. Set product items as **taxable** and service items as **exempt**

> The webhook handler captures the tax amount reported by Square and stores it in the `payments` table.

### Verify it's working

**Sandbox testing:**

1. Set `SQUARE_ENVIRONMENT=sandbox` in `.env.local`
2. Create a booking in the app — it should generate a Square payment link
3. Complete the payment using Square's [sandbox test card numbers](https://developer.squareup.com/docs/devtools/sandbox/payments)
4. Check the `webhook_events` table for the incoming event
5. Check the `payments` table for the recorded payment

**Production testing:**

1. Switch to `SQUARE_ENVIRONMENT=production` and update `SQUARE_ACCESS_TOKEN`
2. Process a small real payment ($1.00) and verify the webhook fires

### If not configured

The app boots in "cash-only mode." The `isSquareConfigured()` check (`lib/square.ts`) returns `false`, and all payment link creation is skipped. Bookings can still be created, but clients cannot pay online. Callers must check `isSquareConfigured()` before calling any Square API function.

### Env vars

| Variable                       | Required | Description                                 |
| ------------------------------ | -------- | ------------------------------------------- |
| `SQUARE_ACCESS_TOKEN`          | Yes      | API access token                            |
| `SQUARE_LOCATION_ID`           | Yes      | Studio location ID                          |
| `SQUARE_ENVIRONMENT`           | Yes      | `sandbox` or `production`                   |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Yes      | HMAC signature key for webhook verification |

---

## 3. Resend (required for emails)

Resend sends all transactional emails — booking confirmations, payment receipts, reminders, gift card deliveries, and 30+ other templates built with [React Email](https://react.email).

### Create an account

1. Go to [resend.com](https://resend.com) and sign up
2. Go to [API Keys](https://resend.com/api-keys) → **Create API Key**
3. Name it (e.g. `T Creative Production`) and select **Full access** or **Sending access**
4. Copy the key (starts with `re_`)

```env
RESEND_API_KEY=re_...
```

### Verify your sending domain

1. Go to [Domains](https://resend.com/domains) → **Add Domain**
2. Enter `tcreativestudio.com`
3. Resend will show DNS records to add:
   - **SPF** record (TXT)
   - **DKIM** records (CNAME × 3)
   - **DMARC** record (TXT) — recommended
4. Add these records in your DNS provider (e.g. Cloudflare, Namecheap)
5. Click **Verify** in Resend — propagation can take up to 48 hours

### Configure the sender address (optional)

The default sender is `T Creative <noreply@tcreativestudio.com>`. Override with:

```env
RESEND_FROM_EMAIL=studio@tcreativestudio.com
```

### Verify it's working

1. Create a booking in the app
2. A booking confirmation email should arrive at the client's email address
3. Check the `sync_log` table for entries with `provider = 'resend'` — you should see `status = 'success'`

### If not configured

Email sending is skipped with a console warning and returns `false`. The `isResendConfigured()` check in `lib/resend.ts` verifies the API key is present. All email sends are non-fatal — failures are caught, logged to Sentry and the `sync_log` table, and never break the main application flow. The app is fully functional without email, but clients won't receive confirmations or reminders.

### Env vars

| Variable            | Required | Description                                             |
| ------------------- | -------- | ------------------------------------------------------- |
| `RESEND_API_KEY`    | Yes      | API key (starts with `re_`)                             |
| `RESEND_FROM_EMAIL` | No       | Sender address (default: `noreply@tcreativestudio.com`) |

---

## 4. Zoho CRM + Books + Campaigns

Three Zoho products are integrated, all sharing a single OAuth2 token:

- **Zoho CRM** — syncs client contacts and creates deals for bookings/orders
- **Zoho Books** — creates invoices and records payments for accounting
- **Zoho Campaigns** — manages marketing email subscriber lists

All Zoho integrations are **optional** and degrade gracefully. The app works without them.

### Create a Self Client application

1. Go to [api-console.zoho.com](https://api-console.zoho.com) and sign in
2. Click **Add Client** → select **Self Client**
3. Copy the **Client ID** and **Client Secret**

### Generate a refresh token

1. In the Self Client, go to the **Generate Code** tab
2. Enter these scopes (comma-separated):

```
ZohoCRM.modules.ALL,ZohoBooks.invoices.ALL,ZohoBooks.contacts.ALL,ZohoCampaigns.contact.ALL
```

3. Set scope duration to a long period (or max available)
4. Enter a description (e.g. `T Creative Studio integration`)
5. Click **Create** — copy the generated **code**
6. Exchange the code for a refresh token:

```bash
curl -X POST "https://accounts.zoho.com/oauth/v2/token" \
  -d "code=YOUR_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "grant_type=authorization_code"
```

7. Copy the `refresh_token` from the response — this is long-lived

```env
ZOHO_CLIENT_ID=1000.XXXX
ZOHO_CLIENT_SECRET=XXXX
ZOHO_REFRESH_TOKEN=1000.XXXX
```

> The app automatically refreshes the access token using the refresh token (`lib/zoho-auth.ts`). Tokens are cached in memory and refreshed 5 minutes before expiry.

### Get the Zoho Books organization ID

1. Go to [books.zoho.com](https://books.zoho.com) → **Settings → Organization**
2. Copy the **Organization ID**

```env
ZOHO_BOOKS_ORGANIZATION_ID=123456789
```

### Get the Zoho Campaigns list key

1. Go to [campaigns.zoho.com](https://campaigns.zoho.com) → **Contacts → Mailing Lists**
2. Click on your mailing list
3. The list key is in the URL or in the list settings

```env
ZOHO_CAMPAIGNS_LIST_KEY=abc123...
```

### Optional: API domain override

```env
ZOHO_API_DOMAIN=https://www.zohoapis.com   # Default; change for EU/IN/AU data centers
```

### Verify it's working

1. Create a new user account in the app
2. Check [Zoho CRM → Contacts](https://crm.zoho.com) — the contact should appear
3. Create a booking — check Zoho CRM → Deals for the new deal
4. Complete a payment — check Zoho Books → Payments for the recorded payment
5. Check the `sync_log` table for Zoho-related entries

### If not configured

All Zoho functions check `isZohoAuthConfigured()` / `isZohoBooksConfigured()` / `isZohoCampaignsConfigured()` and return early if credentials are missing. Errors are logged to Sentry and the `sync_log` table but never thrown to the caller. The app operates normally without any Zoho integration — no CRM sync, no invoices, no marketing list sync.

### Env vars

| Variable                     | Required | Description                                      |
| ---------------------------- | -------- | ------------------------------------------------ |
| `ZOHO_CLIENT_ID`             | No       | OAuth client ID                                  |
| `ZOHO_CLIENT_SECRET`         | No       | OAuth client secret                              |
| `ZOHO_REFRESH_TOKEN`         | No       | Long-lived refresh token                         |
| `ZOHO_API_DOMAIN`            | No       | API domain (default: `https://www.zohoapis.com`) |
| `ZOHO_BOOKS_ORGANIZATION_ID` | No       | Books organization ID                            |
| `ZOHO_CAMPAIGNS_LIST_KEY`    | No       | Campaigns mailing list key                       |

---

## 5. Twilio (optional, for SMS)

Twilio sends SMS booking reminders and confirmations. The app checks the client's SMS notification preference before sending.

### Create an account

1. Go to [twilio.com](https://www.twilio.com) and sign up
2. From the [Twilio Console dashboard](https://console.twilio.com), copy:
   - **Account SID** (starts with `AC`)
   - **Auth Token**

### Get a phone number

1. Go to [Phone Numbers → Manage → Buy a Number](https://console.twilio.com/us1/develop/phone-numbers/manage/search)
2. Search for a number with SMS capability in your area
3. Buy the number (or use the trial number for testing)

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+14155551234
```

### Verify it's working

1. Ensure a client profile has a phone number and SMS notifications enabled
2. Create a booking for that client
3. The client should receive an SMS confirmation
4. Check the `sync_log` table for entries with `provider = 'twilio'`

### If not configured

SMS sending is skipped entirely. The `isTwilioConfigured()` check in `lib/twilio.ts` verifies all three env vars are present. All SMS sends are non-fatal — the app continues without SMS if Twilio is unavailable or misconfigured.

### Env vars

| Variable             | Required | Description                                               |
| -------------------- | -------- | --------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID` | No       | Account SID (starts with `AC`)                            |
| `TWILIO_AUTH_TOKEN`  | No       | Auth token                                                |
| `TWILIO_FROM_NUMBER` | No       | Outbound phone number (E.164 format, e.g. `+14155551234`) |

---

## 6. PostHog (optional, for analytics)

PostHog provides product analytics, event tracking, and user identification. The app uses a reverse proxy through `/ingest/*` to avoid ad blockers (already configured in `next.config.ts`).

### Create a project

1. Go to [posthog.com](https://posthog.com) and sign up (free tier is generous)
2. Create a project
3. Go to **Project Settings** → copy the **API Key** (starts with `phc_`)

```env
POSTHOG_API_KEY=phc_...                             # Server-side
NEXT_PUBLIC_POSTHOG_KEY=phc_...                     # Client-side (same key)
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # Default US datacenter
```

> Both `POSTHOG_API_KEY` and `NEXT_PUBLIC_POSTHOG_KEY` use the same API key value. They have different names because the server-side key is never bundled into client code, while `NEXT_PUBLIC_` vars are.

### How the reverse proxy works

The app proxies PostHog requests through your own domain to bypass ad blockers. This is already configured in `next.config.ts`:

- `/ingest/static/*` → `https://us-assets.i.posthog.com/static/*`
- `/ingest/*` → `https://us.i.posthog.com/*`
- `/ingest/decide` → `https://us.i.posthog.com/decide`

No additional setup is needed for the proxy.

### What's tracked

- **Server-side** (`lib/posthog.ts`): User sign-in events and identification during OAuth callback
- **Client-side** (`components/providers/PostHogIdentify.tsx`): Links anonymous sessions to authenticated users, enabling session replay and user-level analytics

### Verify it's working

1. Sign in to the app
2. Go to [PostHog → Activity](https://us.posthog.com/events) — you should see sign-in events
3. Go to **Persons** — your user should appear with email, role, and name properties

### If not configured

Analytics are silently skipped. `isPostHogConfigured()` returns `false`, and all `trackEvent()` / `identifyUser()` calls are no-ops. The client-side `PostHogIdentify` component renders nothing. The reverse proxy rewrites remain in `next.config.ts` but serve no traffic.

### Env vars

| Variable                   | Required | Description                                        |
| -------------------------- | -------- | -------------------------------------------------- |
| `POSTHOG_API_KEY`          | No       | Server-side API key                                |
| `NEXT_PUBLIC_POSTHOG_KEY`  | No       | Client-side API key (same value as above)          |
| `NEXT_PUBLIC_POSTHOG_HOST` | No       | PostHog host (default: `https://us.i.posthog.com`) |

---

## 7. Sentry (optional, for error tracking)

Sentry captures unhandled exceptions and performance traces on both client and server. Source maps are uploaded at build time for readable stack traces.

> See [docs/sentry-setup.md](./sentry-setup.md) for additional details on what's instrumented and tuning options.

### Create a project

1. Go to [sentry.io](https://sentry.io) and sign in (or create an account — free tier is sufficient)
2. **Create Organization** (if needed) → name it `t-creative` or similar
3. **Create Project** → choose **Next.js** → name it `t-creative`
4. Copy the **DSN** shown on the project creation screen
   - Also available later at **Settings → Projects → t-creative → Client Keys (DSN)**

### Generate an auth token

1. Go to [Settings → Auth Tokens → Create New Token](https://sentry.io/settings/auth-tokens/)
2. Select scopes: `project:releases` and `org:read`
3. Copy the token (starts with `sntrys_`)

```env
NEXT_PUBLIC_SENTRY_DSN=https://your-key@o0.ingest.sentry.io/your-project-id
SENTRY_DSN=https://your-key@o0.ingest.sentry.io/your-project-id
SENTRY_AUTH_TOKEN=sntrys_xxxx
SENTRY_ORG=your-sentry-org-slug      # Optional — inferred from auth token if omitted
SENTRY_PROJECT=t-creative             # Optional — inferred from DSN if omitted
```

> Both `NEXT_PUBLIC_SENTRY_DSN` and `SENTRY_DSN` use the same DSN value. The `NEXT_PUBLIC_` version is for client-side code; `SENTRY_DSN` is for server-side.

### Verify it's working

1. Start the dev server and trigger an error (e.g. add a temporary `throw` in a server action)
2. Check **Sentry → Issues** — the error should appear within seconds
3. Run `npm run build` with `SENTRY_AUTH_TOKEN` set — you should see source map upload logs

### If not configured

Sentry initializes silently with an undefined DSN — all error reports are dropped. The `@sentry/nextjs` SDK is still bundled but does nothing without a valid DSN. Source map upload is skipped if `SENTRY_AUTH_TOKEN` is missing. The app runs with zero overhead from Sentry when unconfigured.

### Env vars

| Variable                 | Required | Description                                    |
| ------------------------ | -------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | No       | Client-side DSN                                |
| `SENTRY_DSN`             | No       | Server-side DSN (same value)                   |
| `SENTRY_ORG`             | No       | Organization slug (for source map upload)      |
| `SENTRY_PROJECT`         | No       | Project slug (for source map upload)           |
| `SENTRY_AUTH_TOKEN`      | No       | Auth token for source map upload at build time |

---

## 8. Cloudflare Turnstile (required for public forms)

Cloudflare Turnstile protects all public unauthenticated forms (contact, guest booking, waitlist) from bots and spam. It runs in Managed mode — most real users pass automatically with no visible challenge.

> See [docs/TURNSTILE_SETUP.md](./TURNSTILE_SETUP.md) for the full setup guide, including key rotation, test keys for preview environments, and code architecture.

### Create a Turnstile widget

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** → **Add site**
2. Enter a name (e.g. `T Creative Studio`)
3. Add your domain: `tcreativestudio.com`
4. Widget type: **Managed** (invisible by default, challenge only when uncertain)
5. Click **Create** — Cloudflare shows both keys immediately

```env
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...   # "Site Key" — public, used in browser
TURNSTILE_SECRET_KEY=0x...             # "Secret Key" — server-only
```

### For local development

Turnstile verification is automatically skipped in development when `TURNSTILE_SECRET_KEY` is not set (`lib/turnstile.ts` checks `NODE_ENV`). You can also use Cloudflare's test keys:

```env
# Test keys — always pass verification
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Verify it's working

1. Open the contact form on the public site
2. Fill it out and submit — Turnstile should pass silently (no visible widget for most users)
3. Check the server logs for `verifyTurnstileToken` — it should return `true`

### If not configured

In development: forms work normally (verification is skipped). In production without `TURNSTILE_SECRET_KEY`: all public form submissions fail verification and are rejected. Authenticated routes (e.g. waitlist for logged-in users) bypass Turnstile entirely.

### Env vars

| Variable                         | Required   | Description                     |
| -------------------------------- | ---------- | ------------------------------- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes (prod) | Public site key from Cloudflare |
| `TURNSTILE_SECRET_KEY`           | Yes (prod) | Secret key from Cloudflare      |

---

## 9. S3-Compatible Backup Storage (optional)

The app creates full JSON snapshots of all database tables and can upload them to any S3-compatible storage provider — AWS S3, Cloudflare R2, or Backblaze B2. Backups are gzip-compressed and organized by date.

> See [docs/RECOVERY_RUNBOOK.md](./RECOVERY_RUNBOOK.md) for the full disaster recovery guide, restore procedures, and health checks.

### Create a bucket

Choose a provider and create a bucket:

| Provider          | Setup URL                                                                           | Notes                                                |
| ----------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Cloudflare R2** | [dash.cloudflare.com](https://dash.cloudflare.com) → R2 → Create bucket             | Free tier: 10 GB/month — enough for years of backups |
| **AWS S3**        | [s3.console.aws.amazon.com](https://s3.console.aws.amazon.com) → Create bucket      | Standard S3 pricing                                  |
| **Backblaze B2**  | [secure.backblaze.com](https://secure.backblaze.com/b2_buckets.htm) → Create bucket | Free tier: 10 GB storage                             |

### Create access credentials

Generate an access key and secret for the bucket. For R2, go to **R2 → Manage R2 API Tokens → Create API Token**.

```env
BACKUP_S3_BUCKET=t-creative-backups
BACKUP_S3_ACCESS_KEY_ID=your-access-key
BACKUP_S3_SECRET_ACCESS_KEY=your-secret-key
```

### Provider-specific configuration

```env
# Cloudflare R2
BACKUP_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
BACKUP_S3_REGION=auto

# Backblaze B2
BACKUP_S3_ENDPOINT=https://s3.<region>.backblazeb2.com
BACKUP_S3_REGION=us-west-004

# AWS S3 — omit BACKUP_S3_ENDPOINT entirely
BACKUP_S3_REGION=us-west-2
```

### Optional configuration

```env
BACKUP_S3_KEY_PREFIX=backups   # Path prefix in bucket (default: "backups")
```

Backups are stored at: `{prefix}/YYYY/MM/DD/backup-{timestamp}.json.gz`

### Enable nightly backups

Run the cron migration in the Supabase SQL Editor:

```sql
-- supabase/migrations/20260315_nightly_backup_cron.sql
-- Replace YOUR_SITE_URL with your production URL before running
```

The cron fires at 2:00 AM UTC daily. Check the audit log the next morning:

```sql
SELECT created_at, description FROM audit_log
WHERE entity_type = 'backup'
ORDER BY created_at DESC LIMIT 5;
```

### Verify it's working

1. Trigger a manual backup: go to Admin Dashboard → Settings → Data & Backup → Download
2. Or via API: `GET /api/backup` (requires admin session)
3. If S3 is configured, `POST /api/backup` uploads to your bucket and returns the storage key

### If not configured

Backup manifests can still be created and downloaded manually — `isStorageConfigured()` in `lib/backup.ts` checks for the required bucket and credentials before attempting upload. Without storage credentials, the admin dashboard download still works; only the nightly off-site upload is skipped.

### Env vars

| Variable                      | Required | Description                                              |
| ----------------------------- | -------- | -------------------------------------------------------- |
| `BACKUP_S3_BUCKET`            | No       | Bucket name                                              |
| `BACKUP_S3_ACCESS_KEY_ID`     | No       | Access key ID                                            |
| `BACKUP_S3_SECRET_ACCESS_KEY` | No       | Secret access key                                        |
| `BACKUP_S3_REGION`            | No       | Region (default: `auto`)                                 |
| `BACKUP_S3_ENDPOINT`          | No       | Custom endpoint URL (R2/Backblaze only; omit for AWS S3) |
| `BACKUP_S3_KEY_PREFIX`        | No       | Path prefix in bucket (default: `backups`)               |

---

## 10. Instagram (optional, for feed sync)

Instagram feed sync automatically pulls your latest posts and displays them on the landing page. A cron job fetches media every 6 hours from the Instagram Graph API and caches it in the `instagram_posts` table so page loads never hit the IG API directly.

### Get a long-lived access token

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → create or select an app
2. Add the **Instagram Basic Display** product (or **Instagram API with Instagram Login** for newer apps)
3. Add your Instagram account as a test user and accept the invitation in the Instagram app
4. Generate a **short-lived token** from the Basic Display settings page
5. Exchange it for a **long-lived token** (valid 60 days):

```bash
curl -s "https://graph.instagram.com/access_token?\
grant_type=ig_exchange_token&\
client_secret=YOUR_APP_SECRET&\
access_token=YOUR_SHORT_LIVED_TOKEN" | jq .
```

6. Copy the `access_token` from the response

```env
INSTAGRAM_ACCESS_TOKEN=IGQ...
```

> **Token refresh:** Long-lived tokens expire after 60 days. The cron job at `/api/cron/instagram-sync` can refresh the token automatically — call `refreshLongLivedToken()` from `lib/instagram.ts`. You can also manually refresh before expiry with the same exchange endpoint using `grant_type=ig_refresh_token`.

### Set up the cron job

Add a pg_cron entry in the Supabase SQL Editor (or Vercel Cron):

```sql
SELECT cron.schedule(
  'instagram-sync',
  '0 */6 * * *',  -- every 6 hours
  $$SELECT net.http_get(
    url := 'YOUR_SITE_URL/api/cron/instagram-sync',
    headers := jsonb_build_object('x-cron-secret', 'YOUR_CRON_SECRET')
  )$$
);
```

### Verify it's working

1. Trigger a manual sync: `curl -H "x-cron-secret: YOUR_SECRET" https://your-site.com/api/cron/instagram-sync`
2. Check the `instagram_posts` table — it should contain your latest posts
3. Visit the landing page — the "Fresh from the studio" section should appear between FeaturedProducts and Testimonials
4. Check the `sync_log` table for entries with `provider = 'instagram'`

### If not configured

The Instagram feed section is hidden entirely. `isInstagramConfigured()` in `lib/instagram.ts` checks for the access token. The landing page query returns an empty array and `<InstagramFeed>` renders nothing when there are no posts. No errors, no empty states — the section simply doesn't appear.

### Env vars

| Variable                  | Required | Description                                  |
| ------------------------- | -------- | -------------------------------------------- |
| `INSTAGRAM_ACCESS_TOKEN`  | No       | Long-lived Instagram user token (60-day TTL) |

---

## 11. App Configuration

These env vars configure the application itself, independent of any third-party service.

### Site URL

```env
NEXT_PUBLIC_SITE_URL=https://tcreativestudio.com
```

Used for generating absolute URLs in emails, OAuth redirects, and webhook verification. Set to `http://localhost:3000` for local development.

### Cron secret

```env
CRON_SECRET=your-random-string
```

Authenticates [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) — cron routes check this secret to prevent unauthorized access. Also stored in the Supabase database for pg_cron jobs to include when calling the API.

### Invite secret

```env
INVITE_SECRET=your-random-string
```

Used to sign and verify assistant invite JWTs. When an admin invites an assistant, a JWT is created with this secret and sent via email. The auth callback verifies the token to assign the assistant role.

### Admin email

```env
ADMIN_EMAIL=admin@example.com
```

The admin user's email address, used for system notifications.

### Generating secrets

Use `openssl` to generate cryptographically secure random strings:

```bash
# Generate a 32-byte random string (base64-encoded)
openssl rand -base64 32
```

Run this once for `CRON_SECRET` and once for `INVITE_SECRET` — use different values for each.

### Env vars

| Variable               | Required | Description                                         |
| ---------------------- | -------- | --------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Yes      | Production URL (e.g. `https://tcreativestudio.com`) |
| `CRON_SECRET`          | Yes      | Random string for cron job authentication           |
| `INVITE_SECRET`        | Yes      | Random string for signing invite JWTs               |
| `ADMIN_EMAIL`          | Yes      | Admin email address for system notifications        |

---

## Complete Env Var Reference

| Variable                         | Service   | Required   |
| -------------------------------- | --------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase  | Yes        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase  | Yes        |
| `SUPABASE_SERVICE_ROLE_KEY`      | Supabase  | Yes        |
| `DATABASE_URL`                   | Supabase  | Yes        |
| `DIRECT_URL`                     | Supabase  | Yes        |
| `SQUARE_ACCESS_TOKEN`            | Square    | Yes        |
| `SQUARE_LOCATION_ID`             | Square    | Yes        |
| `SQUARE_ENVIRONMENT`             | Square    | Yes        |
| `SQUARE_WEBHOOK_SIGNATURE_KEY`   | Square    | Yes        |
| `RESEND_API_KEY`                 | Resend    | Yes        |
| `RESEND_FROM_EMAIL`              | Resend    | No         |
| `ZOHO_CLIENT_ID`                 | Zoho      | No         |
| `ZOHO_CLIENT_SECRET`             | Zoho      | No         |
| `ZOHO_REFRESH_TOKEN`             | Zoho      | No         |
| `ZOHO_API_DOMAIN`                | Zoho      | No         |
| `ZOHO_BOOKS_ORGANIZATION_ID`     | Zoho      | No         |
| `ZOHO_CAMPAIGNS_LIST_KEY`        | Zoho      | No         |
| `TWILIO_ACCOUNT_SID`             | Twilio    | No         |
| `TWILIO_AUTH_TOKEN`              | Twilio    | No         |
| `TWILIO_FROM_NUMBER`             | Twilio    | No         |
| `POSTHOG_API_KEY`                | PostHog   | No         |
| `NEXT_PUBLIC_POSTHOG_KEY`        | PostHog   | No         |
| `NEXT_PUBLIC_POSTHOG_HOST`       | PostHog   | No         |
| `NEXT_PUBLIC_SENTRY_DSN`         | Sentry    | No         |
| `SENTRY_DSN`                     | Sentry    | No         |
| `SENTRY_ORG`                     | Sentry    | No         |
| `SENTRY_PROJECT`                 | Sentry    | No         |
| `SENTRY_AUTH_TOKEN`              | Sentry    | No         |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile | Yes (prod) |
| `TURNSTILE_SECRET_KEY`           | Turnstile | Yes (prod) |
| `BACKUP_S3_BUCKET`               | Backup    | No         |
| `BACKUP_S3_ACCESS_KEY_ID`        | Backup    | No         |
| `BACKUP_S3_SECRET_ACCESS_KEY`    | Backup    | No         |
| `BACKUP_S3_REGION`               | Backup    | No         |
| `BACKUP_S3_ENDPOINT`             | Backup    | No         |
| `BACKUP_S3_KEY_PREFIX`           | Backup    | No         |
| `INSTAGRAM_ACCESS_TOKEN`         | Instagram | No         |
| `NEXT_PUBLIC_SITE_URL`           | App       | Yes        |
| `CRON_SECRET`                    | App       | Yes        |
| `INVITE_SECRET`                  | App       | Yes        |
| `ADMIN_EMAIL`                    | App       | Yes        |
