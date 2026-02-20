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

## Testing

Tests use Vitest + React Testing Library. Priority test targets:

- `useStudioStore` (state machine transitions)
- `Button` (polymorphic rendering)
- `zones` (data integrity)

Run tests before submitting PRs:

```bash
npm test
```
