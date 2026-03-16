# Sentry Setup

Error monitoring and performance tracing via [@sentry/nextjs](https://docs.sentry.io/platforms/javascript/guides/nextjs/).

---

## 1. Create a Sentry project

1. Sign in at [sentry.io](https://sentry.io) (or create an account — free tier is sufficient for a small studio)
2. **Create Organisation** (if you don't have one) → name it `t-creative` or similar
3. **Create Project** → choose **Next.js** → name it `t-creative`
4. Copy the **DSN** shown on the project creation screen (also available later at **Settings → Projects → t-creative → Client Keys (DSN)**)

---

## 2. Generate an auth token

The auth token is used at **build time** to upload source maps so Sentry can show readable stack traces.

1. Go to **Settings → Auth Tokens → Create New Token**
2. Select scope: `project:releases` and `org:read` (minimum required for source map upload)
3. Copy the token — it starts with `sntrys_`

---

## 3. Set environment variables

Add the following to your `.env.local` (never commit this file):

```env
# Both vars point to the same DSN — split so client-side code
# only ever sees the NEXT_PUBLIC_ version.
NEXT_PUBLIC_SENTRY_DSN=https://your-key@o0.ingest.sentry.io/your-project-id
SENTRY_DSN=https://your-key@o0.ingest.sentry.io/your-project-id

# Build-time only — used by withSentryConfig to upload source maps.
# Never expose this in client-side code.
SENTRY_AUTH_TOKEN=sntrys_xxxx
```

**Optional** — only needed if you want the build plugin to auto-tag releases by org/project:

```env
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=t-creative
```

If `SENTRY_ORG` / `SENTRY_PROJECT` are omitted, the plugin infers them from the auth token and DSN. Releases and source maps still upload correctly without them.

### Hosting (Vercel / Railway / etc.)

Add all four vars above to your hosting provider's environment variable settings. `SENTRY_AUTH_TOKEN` is needed in the **build environment** specifically — mark it as a build secret if your host distinguishes between build-time and runtime vars.

---

## 4. Verify the integration

### Local smoke test

Start the dev server and deliberately trigger an error. The fastest way is to add a temporary throw to any server action and call it from the browser. Check **Sentry → Issues** — it should appear within a few seconds.

### Build-time source map upload

Run `npm run build` locally (with `SENTRY_AUTH_TOKEN` set). You should see output like:

```
[Sentry] Uploading source maps for release ...
[Sentry] Successfully uploaded source maps
```

If source maps upload successfully, Sentry will show readable file/line references in stack traces instead of minified bundles.

---

## 5. What's instrumented

### Automatic (SDK-level)

- All **unhandled exceptions** in server components, route handlers, and client components
- **Performance traces** for 10% of requests (`tracesSampleRate: 0.1`) — tuned for low traffic; raise to `0.5` or `1.0` temporarily if you need more data

### Manual `captureException` calls

These are the locations where errors are swallowed (non-fatal, fire-and-forget flows) but still need visibility:

| File                                    | What's covered                                                     |
| --------------------------------------- | ------------------------------------------------------------------ |
| `app/api/webhooks/square/route.ts`      | Square payment/refund event processing failures                    |
| `app/api/cron/backup/route.ts`          | Nightly backup manifest creation and S3 upload failures            |
| `app/api/cron/zoho-books/route.ts`      | Per-entity invoice sync failures (bookings, orders, enrollments)   |
| `app/api/cron/campaigns/route.ts`       | Per-profile Zoho Campaigns subscriber sync failures                |
| `app/api/cron/waitlist-expiry/route.ts` | Waitlist advancement notification failures                         |
| `lib/resend.ts`                         | Email send failures                                                |
| `lib/zoho.ts`                           | CRM contact upsert, deal create/update, note failures              |
| `lib/zoho-books.ts`                     | Customer ensure, invoice create, payment record failures           |
| `lib/zoho-campaigns.ts`                 | Subscriber sync and unsubscribe failures                           |
| `lib/square.ts`                         | Order and payment link creation failures (re-throws after capture) |

In all cases `Sentry.captureException` is added **alongside** existing error handling — `console.error` logs and `sync_log` database writes are preserved.

### Global error boundary

`app/global-error.tsx` catches unhandled React render errors and calls `Sentry.captureException` before showing the branded fallback UI. This is the last line of defence for client-side crashes that escape component-level boundaries.

---

## 6. What's intentionally excluded

| Feature                | Reason                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Session replay         | PostHog already handles this — `replaysSessionSampleRate: 0` |
| Sentry feedback widget | Not needed — clients contact the studio directly             |
| User feedback on error | Out of scope for current setup                               |

---

## 7. Tuning for production

Once live, revisit these settings in `sentry.client.config.ts` and `sentry.server.config.ts`:

- **`tracesSampleRate`** — `0.1` (10%) is conservative. Raise it if you need richer performance data; lower it if you hit Sentry's transaction quota.
- **Alerting** — set up a Sentry alert rule to email/Slack on new issues: **Alerts → Create Alert → Issue Alert → "A new issue is created"**
- **Environments** — Sentry automatically tags events with `development` / `production` based on `NODE_ENV`. Filter by environment in the Issues view.
