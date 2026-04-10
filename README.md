# T Creative Studio

Full-stack operations platform for a multi-service creative studio in San Jose, CA offering lash extensions, permanent jewelry, custom crochet, 3D printing, consulting, and aesthetics. Replaces manual scheduling, payment tracking, and client management with a unified platform covering bookings, payments, CRM, staff management, e-commerce, and automated operations. Built with Next.js 16, React 19, TypeScript, PostgreSQL (Supabase), Drizzle ORM, and Square.

## Features

**Admin Dashboard**

- Revenue tracking with daily/weekly/monthly views
- Booking management with calendar and waitlist
- Client CRM with loyalty and referral tracking
- Staff management with commission and payroll tracking
- Financial dashboard with P&L and tax estimates
- Analytics with retention and at-risk client detection
- Service and pricing configuration
- Event management with corporate inquiry flow
- Training program administration
- Marketplace with inventory and gift cards
- Media gallery
- Membership tiers and subscription packages

**Assistant Dashboard**

- Daily schedule with shift management
- Booking management for assigned clients
- Earnings and commission tracking
- Training enrollment and progress
- Client aftercare protocols
- Reviews and ratings
- Messages

**Client Portal**

- Self-service booking with constraint-based scheduling
- Upcoming and past appointment history
- Loyalty points and rewards
- Invoices and payment history
- Messages with staff
- Shop and gift cards
- Event RSVP
- Training enrollment
- Aftercare instructions
- Settings and notification preferences

**Public Pages**

- Landing page with interactive 3D studio diorama (React Three Fiber)
- Auto-synced Instagram feed (cron-cached from Graph API)
- Service catalog with pricing
- Portfolio gallery
- Training program listings
- E-commerce shop
- Booking storefront
- Corporate event inquiry
- About, contact, privacy policy, terms of service

## Tech Stack

| Category         | Technology                                             |
| ---------------- | ------------------------------------------------------ |
| Framework        | Next.js 16.1.6 (App Router)                            |
| Language         | TypeScript 5                                           |
| Database         | PostgreSQL 15 (Supabase)                               |
| ORM              | Drizzle ORM 0.45.1                                     |
| Auth             | Supabase Auth (@supabase/ssr)                          |
| Payments         | Square 44.0.0                                          |
| Shipping         | EasyPost (@easypost/api)                               |
| Email            | Resend 6.9.2 (React Email templates)                   |
| SMS              | Twilio 5.13.0                                          |
| CRM/Accounting   | Zoho CRM v7 (REST API via fetch)                       |
| Analytics        | PostHog (posthog-js 1.354.3)                           |
| Error Tracking   | Sentry (@sentry/nextjs 10.43.0)                        |
| Bot Protection   | Google reCAPTCHA v3                                    |
| Styling          | Tailwind CSS 4                                         |
| 3D Graphics      | Three.js 0.183.0, React Three Fiber 9.5.0, Drei 10.7.7 |
| State Management | Zustand 5.0.11                                         |
| Forms            | TanStack React Form 1.28.3, Zod 4.3.6                  |
| Testing          | Vitest 4.0.18, Playwright 1.58.2, axe-core             |
| CI/CD            | GitHub Actions (6 parallel jobs)                       |
| Hosting          | Vercel                                                 |
| Backup           | S3-compatible object storage (gzipped JSON manifests)  |

## Architecture

Server Components handle data fetching and metadata at the page level, while Client Components manage interactivity. Mutations use `useOptimistic` for instant UI feedback before server confirmation. The `"use client"` boundary is pushed as deep as possible to maximize server-rendered content.

Server Actions with `revalidatePath` handle all data mutations. Suspense boundaries provide streaming for slower queries. Financial and analytics dashboards use parallel server component composition to load multiple data sources concurrently.

Routing is role-based: each `page.tsx` in the dashboard checks the user's role (admin, assistant, or client) and renders a completely different component with different data queries. There is no shared dashboard view between roles.

Square webhooks handle real-time payment reconciliation. The webhook route verifies HMAC-SHA256 signatures, stores raw events in `webhook_events` for audit and replay, then processes payment and refund events into the local database.

Cron jobs automate recurring operations: hourly booking reminders, daily review requests, daily birthday greetings, weekly re-engagement campaigns, daily Zoho Books sync, daily lash fill reminders, hourly waitlist expiry cleanup, recurring booking generation, membership renewal reminders, and 6-hourly Instagram feed sync.

Row-level security is enforced on every table via Supabase RLS policies. The Next.js Proxy (middleware) handles rate limiting on public POST endpoints and auth session refresh before requests reach route handlers.

## Getting Started

### Manual Setup

```bash
git clone https://github.com/intrikal/t-creative.git
cd t-creative
npm install
cp .env.example .env.local
# Fill in values — see docs/INTEGRATION_SETUP.md
npm run db:migrate
npm run dev
```

### Docker Setup

```bash
git clone https://github.com/intrikal/t-creative.git
cd t-creative
cp .env.example .env.local
# Fill in values — see docs/INTEGRATION_SETUP.md
docker compose up
```

This starts Postgres 15, Redis 7, and the Next.js dev server with hot reload. The database is available at `localhost:5432` and the app at `localhost:3000`.

To customize ports or environment variables, copy the override example:

```bash
cp docker-compose.override.yml.example docker-compose.override.yml
# Edit as needed — Docker Compose merges it automatically
```

See [docs/INTEGRATION_SETUP.md](docs/INTEGRATION_SETUP.md) for step-by-step instructions on configuring all third-party services.

## Documentation

- [Integration Setup](docs/INTEGRATION_SETUP.md) -- Square, Supabase, Resend, Twilio, Zoho, PostHog, Sentry, Turnstile, Instagram, S3, EasyPost
- [Deployment Checklist](docs/DEPLOYMENT_CHECKLIST.md)
- [Engineering Standards](docs/ENGINEERING_STANDARDS.md)
- [Recovery Runbook](docs/RECOVERY_RUNBOOK.md)
- [Migration Checklist](docs/MIGRATION_CHECKLIST.md)
- [Turnstile Setup](docs/TURNSTILE_SETUP.md)
- [Sentry Setup](docs/sentry-setup.md)
- [Three.js Architecture](docs/THREE_JS_ARCHITECTURE.md)
- [Contributing](CONTRIBUTING.md)

## Scripts

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start Next.js dev server on localhost:3000     |
| `npm run build`        | Production build                               |
| `npm run start`        | Start production server                        |
| `npm run lint`         | Run ESLint across the project                  |
| `npm run format`       | Format all files with Prettier                 |
| `npm run format:check` | Check formatting without writing               |
| `npm test`             | Run Vitest unit tests                          |
| `npm run test:watch`   | Run Vitest in watch mode                       |
| `npm run test:e2e`     | Run Playwright end-to-end tests                |
| `npm run test:e2e:ui`  | Run Playwright with interactive UI             |
| `npm run db:generate`  | Generate Drizzle migration from schema changes |
| `npm run db:migrate`   | Apply pending database migrations              |
| `npm run db:push`      | Push schema changes directly (dev only)        |
| `npm run db:studio`    | Open Drizzle Studio database browser           |

## Project Structure

```
app/                       Next.js routes and pages
  dashboard/                 Role-based dashboards (30 sections)
  api/                       API routes, webhooks, cron jobs (19 routes)
  auth/                      OAuth callback and error handling
  book/                      Public booking storefront
  shop/                      E-commerce storefront
  events/corporate/          Corporate event inquiry
components/                  Reusable UI components
  landing/                   Landing page sections (33 components)
  three/                     React Three Fiber 3D components (12)
  onboarding/                Multi-step onboarding flows (55 components)
  booking/                   Booking request components
  ui/                        Shared UI primitives
db/schema/                   Drizzle ORM schema (77 tables)
drizzle/                     Database migrations (52)
emails/                      React Email templates (30)
lib/                         Integrations and utilities
stores/                      Zustand stores
e2e/                         Playwright E2E tests (22 specs)
docs/                        Documentation
```

## License

Private -- not open source.
