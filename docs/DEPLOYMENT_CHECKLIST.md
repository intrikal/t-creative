# Deployment Checklist

Step-by-step checklist for deploying T Creative Studio to Vercel from scratch. Each step links to the relevant setup guide where applicable.

---

## Prerequisites

- [ ] Node.js 18+ installed
- [ ] A [Vercel](https://vercel.com) account
- [ ] A [Supabase](https://supabase.com) account
- [ ] A [Square Developer](https://developer.squareup.com) account
- [ ] A [Resend](https://resend.com) account
- [ ] A [Cloudflare](https://dash.cloudflare.com) account (for Turnstile)

---

## 1. Clone the repository

```bash
git clone https://github.com/your-org/t-creative.git
cd t-creative
npm install
```

---

## 2. Create `.env.local`

```bash
cp .env.example .env.local
```

Fill in values as you work through each integration below.

---

## 3. Set up each integration

Follow [docs/INTEGRATION_SETUP.md](./INTEGRATION_SETUP.md) for detailed instructions on each service. Complete them in this order:

- [ ] **Supabase** — Create project, get API keys and database URLs, enable Google OAuth
      → [Setup instructions](./INTEGRATION_SETUP.md#1-supabase-required)
- [ ] **Square** — Create application, get access token and location ID
      → [Setup instructions](./INTEGRATION_SETUP.md#2-square-required-for-payments)
- [ ] **Inngest** — Create app, get Event Key and Signing Key
      → [Setup instructions](./INTEGRATION_SETUP.md#13-inngest-required-for-background-jobs)
- [ ] **Resend** — Get API key, verify sending domain
      → [Setup instructions](./INTEGRATION_SETUP.md#3-resend-required-for-emails)
- [ ] **Cloudflare Turnstile** — Create widget, get site key and secret key
      → [Setup instructions](./INTEGRATION_SETUP.md#8-cloudflare-turnstile-required-for-public-forms)
- [ ] **Generate secrets** — Run `openssl rand -base64 32` twice for `CRON_SECRET` and `INVITE_SECRET`
      → [Setup instructions](./INTEGRATION_SETUP.md#10-app-configuration)

Optional integrations (can be added later):

- [ ] **Zoho CRM + Books + Campaigns** → [Setup instructions](./INTEGRATION_SETUP.md#4-zoho-crm--books--campaigns)
- [ ] **Twilio** → [Setup instructions](./INTEGRATION_SETUP.md#5-twilio-optional-for-sms)
- [ ] **PostHog** → [Setup instructions](./INTEGRATION_SETUP.md#6-posthog-optional-for-analytics)
- [ ] **Sentry** → [Setup instructions](./INTEGRATION_SETUP.md#7-sentry-optional-for-error-tracking)
- [ ] **S3 Backup Storage** → [Setup instructions](./INTEGRATION_SETUP.md#9-s3-compatible-backup-storage-optional)

---

## 4. Run database migrations

```bash
# Apply Drizzle schema migrations (all application tables)
npx drizzle-kit migrate
```

---

## 5. Run Supabase migrations

Apply each file in `supabase/migrations/` via the Supabase SQL Editor:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. For each migration file, click **New Query**, paste the contents, and click **Run**
3. Apply them in alphabetical order (they are named chronologically)

> **Important:** Replace `YOUR_SITE_URL` in cron migration files with your production URL before running.

These migrations set up:

- [ ] Row-Level Security (RLS) policies
- [ ] Storage buckets and policies
- [ ] pg_cron scheduled jobs (email reminders, backups, waitlist expiry)

---

## 6. Connect to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your Git repository
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy** — the first build will fail because env vars are missing (that's expected)

---

## 7. Add environment variables in Vercel

1. Go to your Vercel project → **Settings → Environment Variables**
2. Add every variable from your `.env.local`
3. Scope each variable appropriately:
   - Most variables: **Production**, **Preview**, **Development**
   - `SENTRY_AUTH_TOKEN`: **Production** only (build-time secret)
   - `SQUARE_ENVIRONMENT`: set to `sandbox` for Preview, `production` for Production
4. Click **Save** and trigger a redeploy

> **Tip:** You can bulk-paste from `.env.local` using Vercel's "Import .env" feature.

---

## 8. Configure Square webhook URL

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps) → your application → **Webhooks**
2. Update the webhook URL to your production domain:
   ```
   https://tcreativestudio.com/api/webhooks/square
   ```
3. Ensure these events are subscribed:
   - [ ] `payment.completed`
   - [ ] `payment.updated`
   - [ ] `refund.created`
   - [ ] `refund.updated`
   - [ ] `subscription.updated`
   - [ ] `invoice.payment_made`
   - [ ] `gift_card.activity.created`

---

## 9. Sync Inngest functions

1. Go to [app.inngest.com](https://app.inngest.com) → **Apps**
2. Click **Sync New App** and enter: `https://tcreativestudio.com/api/inngest`
3. Click **Sync** — all 16 functions should appear under **Functions**
4. Confirm `square-webhook-processor` is listed (handles Square webhook processing)

> Inngest re-syncs automatically on each subsequent Vercel deploy via the `PUT /api/inngest` handler. This manual sync is only needed on first setup.

---

## 10. Verify cron jobs are running

1. Go to your Vercel project → **Settings → Cron Jobs**
2. Confirm that cron routes are registered (defined in `vercel.json`)
3. After the first scheduled run, check the `audit_log` table for cron entries:

```sql
SELECT created_at, entity_type, description
FROM audit_log
WHERE entity_type IN ('backup', 'cron')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 11. Test the health endpoint

```bash
curl https://tcreativestudio.com/api/health
```

Expected response: HTTP 200 with a JSON body confirming the app is running.

---

## 12. Test a booking flow end to end

- [ ] Sign in with Google as the admin account
- [ ] Create a test service in the admin dashboard
- [ ] Create a booking for a test client
- [ ] Complete the Square payment (use sandbox test cards if still in sandbox mode)
- [ ] Verify the webhook fires and payment is recorded in the `payments` table
- [ ] Verify the client receives a booking confirmation email
- [ ] Verify the booking appears in Zoho CRM (if configured)

---

## 13. Configure custom domain

1. Go to your Vercel project → **Settings → Domains**
2. Add `tcreativestudio.com` (and `www.tcreativestudio.com` if desired)
3. Update DNS records as instructed by Vercel (typically a CNAME or A record)
4. Wait for DNS propagation and SSL certificate provisioning (~5 minutes)
5. Update these settings to use the custom domain:
   - [ ] `NEXT_PUBLIC_SITE_URL` in Vercel env vars → `https://tcreativestudio.com`
   - [ ] Square webhook URL → `https://tcreativestudio.com/api/webhooks/square`
   - [ ] Google OAuth redirect URI → update to include the Supabase callback URL
   - [ ] Cloudflare Turnstile → add the custom domain to the widget's allowed domains

---

## Post-deployment

- [ ] Switch `SQUARE_ENVIRONMENT` to `production` and update `SQUARE_ACCESS_TOKEN` with the production token
- [ ] Process a small real payment to verify the production Square integration
- [ ] Set up a [Sentry alert rule](https://docs.sentry.io/product/alerts/) to notify on new issues
- [ ] Verify nightly backups are running (check your S3 bucket the next morning)
- [ ] Bookmark the [Recovery Runbook](./RECOVERY_RUNBOOK.md) for incident response
