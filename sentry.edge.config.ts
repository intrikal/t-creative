import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Capture 10% of transactions — small studio, not high traffic.
  tracesSampleRate: 0.1,
});
