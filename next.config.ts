import { withSentryConfig } from "@sentry/nextjs";
import withSerwist from "@serwist/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    useCache: true,
    optimizePackageImports: [
      "recharts",
      "lucide-react",
      "framer-motion",
      "date-fns",
      "@react-email/components",
      "react-icons",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "ftautvgyauxyzxxznife.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // PostHog reverse proxy — routes tracking requests through our own domain
  // so ad-blockers and privacy extensions don't intercept them.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  async redirects() {
    return [
      { source: "/client", destination: "/dashboard", permanent: true },
      { source: "/client/:path*", destination: "/dashboard/:path*", permanent: true },
      // Consolidated dashboard pages
      { source: "/dashboard/revenue", destination: "/dashboard/financial", permanent: true },
      { source: "/dashboard/expenses", destination: "/dashboard/financial", permanent: true },
      { source: "/dashboard/memberships", destination: "/dashboard/bookings", permanent: true },
      { source: "/dashboard/subscriptions", destination: "/dashboard/bookings", permanent: true },
      { source: "/dashboard/assistants", destination: "/dashboard/team", permanent: false },
      { source: "/dashboard/staff", destination: "/dashboard/team", permanent: true },
      { source: "/dashboard/legal", destination: "/dashboard/settings", permanent: true },
      { source: "/dashboard/media", destination: "/dashboard/services", permanent: true },
    ];
  },
  async headers() {
    // 'unsafe-eval' is only needed in development (e.g. Next.js hot-reload, React DevTools).
    // Never include it in production builds.
    const unsafeEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${unsafeEval} https://challenges.cloudflare.com https://us-assets.i.posthog.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://lh3.googleusercontent.com https://*.supabase.co; connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://connect.squareup.com https://*.sentry.io; frame-src https://challenges.cloudflare.com; font-src 'self'; object-src 'none'; base-uri 'self'`,
          },
        ],
      },
    ];
  },
};

const withSerwistConfig = withSerwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSentryConfig(withSerwistConfig(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  autoInstrumentServerFunctions: false,
  autoInstrumentMiddleware: false,
  autoInstrumentAppDirectory: false,
});
