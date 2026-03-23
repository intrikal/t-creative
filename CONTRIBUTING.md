# Contributing to T Creative Studio

## Getting Started

```bash
# Clone and install
git clone <repo-url>
cd t-creative
npm install

# Start development server
npm run dev
```

## Prerequisites

- Node.js 20+
- npm 10+

## Scripts

| Command                | Description              |
| ---------------------- | ------------------------ |
| `npm run dev`          | Start Next.js dev server |
| `npm run build`        | Production build         |
| `npm run lint`         | Run ESLint               |
| `npm run format`       | Format with Prettier     |
| `npm run format:check` | Check formatting         |
| `npm test`             | Run Vitest tests         |
| `npm run test:watch`   | Run tests in watch mode  |

## Architecture

- **Framework**: Next.js 16 (App Router, Server Components)
- **3D**: React Three Fiber + Three.js (procedural geometry only, no GLTF)
- **State**: Zustand (single store with state machine)
- **Styling**: Tailwind CSS v4
- **Animation**: Framer Motion (2D), lerp in useFrame (3D)

See [docs/ENGINEERING_STANDARDS.md](docs/ENGINEERING_STANDARDS.md) for the complete technical specification.

## Directory Structure

```
app/              # Next.js routes (Server Components + metadata)
components/
  atelier/        # Studio HUD overlays (StudioNav, ZoneOverlay)
  landing/        # Landing page sections
  three/          # React Three Fiber components
  ui/             # Reusable UI primitives
stores/           # Zustand stores
lib/              # Constants, utilities, types
docs/             # Engineering standards, architecture docs
```

## Code Standards

- All source files must have a JSDoc file header
- Named exports for all non-page components
- No `console.log`, no `: any` types
- `"use client"` only when required (hooks, browser APIs, interactivity)
- Three.js components must never set React state inside `useFrame`
- Import order: React > Next > third-party > local (`@/`)

## Pre-commit Hooks

Husky + lint-staged run automatically on commit:

- ESLint with auto-fix on `.ts`/`.tsx` files
- Prettier formatting on all staged files

## Three.js Guidelines

- Procedural geometry only (no GLTF/texture imports)
- DPR capped at `[1, 1.5]`
- All animation via lerp in `useFrame` (never `setState`)
- No `new THREE.*` allocations inside `useFrame`
- Canvas loaded via `next/dynamic` with `ssr: false`
- Support `prefers-reduced-motion` (snap instead of lerp)

## Manual Workflows (GitHub Actions)

Some workflows are `workflow_dispatch` only — they never run automatically and
must be triggered manually before a deploy or migration.

### Setup: authenticate the GitHub CLI

```bash
gh auth login
# Choose: GitHub.com → HTTPS → Login with a web browser
```

Verify it worked:

```bash
gh auth status
```

### Trigger the database backup

```bash
gh workflow run backup-db.yml \
  --repo <org>/<repo> \
  --field reason="pre-deploy backup"
```

Check the run status:

```bash
gh run list --workflow=backup-db.yml --limit 5
```

Then confirm the backup file appears in the `db-backups` Supabase Storage bucket
before proceeding with any migration or deploy.

### Required repository secrets

The backup workflow reads these from **Settings → Secrets and variables → Actions**:

| Secret                      | Description                                   |
| --------------------------- | --------------------------------------------- |
| `DIRECT_URL`                | Direct Postgres connection string (port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL`  | Supabase project URL                          |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key (storage admin access)       |

---

## Database Migration Checklist

Follow this sequence for every schema migration in production:

1. **Run the backup script**

   ```bash
   DIRECT_URL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
     ./scripts/backup-db.sh
   ```

2. **Verify the backup exists** — confirm the new `backup-YYYY-MM-DD-HHmmss.sql.gz`
   appears in the `db-backups` Supabase Storage bucket before proceeding.

3. **Run the migration**

   ```bash
   npx drizzle-kit migrate
   ```

4. **Verify the health check passes**

   ```bash
   curl --fail https://<your-domain>/api/health
   ```

   The endpoint must return HTTP 200. Inspect logs if it does not.

5. **If the health check fails — run the rollback script**
   ```bash
   DIRECT_URL=... SENTRY_DSN=... \
     ./scripts/rollback-migration.sh <migration-name>
   # Example:
   DIRECT_URL=... SENTRY_DSN=... \
     ./scripts/rollback-migration.sh 0051_polite_silver_surfer
   ```
   The script calls `drizzle-kit drop` and logs the event to Sentry automatically.

> **Tip:** The backup step can also be triggered manually via GitHub Actions —
> see the **Backup Database** workflow (`workflow_dispatch`) in the Actions tab.

## Testing

Tests use Vitest + React Testing Library. Priority test targets:

- `useStudioStore` (state machine transitions)
- `Button` (polymorphic rendering)
- `zones` (data integrity)

Run tests before submitting PRs:

```bash
npm test
```
