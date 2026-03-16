import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions — small studio, not high traffic.
  tracesSampleRate: 0.1,

  // PostHog handles session replay — disable Sentry's.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
