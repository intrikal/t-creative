# CLAUDE.md — T Creative Studio

## Project

Full-stack operations platform for a multi-service creative studio.
Next.js 16 (App Router), React 19, TypeScript 5, PostgreSQL (Supabase), Drizzle ORM, Square payments.

## Architecture

- Server Components for data fetching; Client Components for interactivity
- Server Actions (not API routes) for all dashboard mutations
- Role-based dashboards: admin, assistant, client — each page.tsx checks role and renders different components
- Supabase Auth (cookie-based SSR), Drizzle bypasses RLS via service role
- Square webhooks → Inngest for async processing

## Auth hierarchy

- `getCurrentUser()` — read-only, returns null if unauthenticated
- `getUser()` — throws 401 if unauthenticated (does NOT check role)
- `requireStaff()` — throws 403 if not admin or assistant
- `requireAdmin()` — throws 403 if not admin
  All defined in `lib/auth.ts`. Wrapped with React `cache()`.

## Code standards (from CONTRIBUTING.md & ENGINEERING_STANDARDS.md)

- All source files must have a JSDoc file header explaining purpose
- Named exports for all non-page components
- No `console.log`, no `: any` types
- `"use client"` only when required (hooks, browser APIs, interactivity)
- Import order: React > Next > third-party > local (`@/`)
- Every mutation server action must validate input with Zod before touching DB
- Every mutation must call `revalidatePath()` after success
- Every catch block must call `Sentry.captureException(err)`
- Tests use Vitest + React Testing Library; test files live next to source

## File conventions

- Dashboard pages: `app/dashboard/<section>/page.tsx` (server) + `<Section>Page.tsx` (client)
- Actions: `app/dashboard/<section>/actions.ts` (barrel) or `actions/<domain>.ts`
- DB schema: `db/schema/<table>.ts`, always import from `@/db/schema` (barrel)
- Emails: `emails/<TemplateName>.tsx` (React Email components)

## Testing

- `npm test` — Vitest unit tests
- `npm run test:e2e` — Playwright E2E tests
- Tests for server actions mock `lib/auth`, `@/db`, and external services

## Do NOT

- Add new dependencies without asking
- Change the database schema (no new migrations)
- Modify proxy.ts rate limit thresholds without reason
- Remove or weaken any existing auth checks
