# T Creative Studio — Engineering Standards

Production-grade engineering standards for the Next.js 16 + React 19 + Three.js application powering T Creative Studio.

**Enforced for all contributors. No exceptions unless documented here.**

---

## Table of Contents

1. [Architecture Documentation](#1-architecture-documentation)
2. [Page-Level Standards](#2-page-level-standards)
3. [Component Standards](#3-component-standards)
4. [Custom Hooks](#4-custom-hooks)
5. [Utility Functions](#5-utility-functions)
6. [Three.js Scenes & WebGL Lifecycle](#6-threejs-scenes--webgl-lifecycle)
7. [Performance Requirements](#7-performance-requirements)
8. [Accessibility (WCAG 2.1 AA)](#8-accessibility-wcag-21-aa)
9. [SEO Standards](#9-seo-standards)
10. [Code Splitting & Bundle Strategy](#10-code-splitting--bundle-strategy)
11. [Rendering Strategy](#11-rendering-strategy)
12. [Testing Expectations](#12-testing-expectations)
13. [Memory Management (Three.js)](#13-memory-management-threejs)
14. [Reduced Motion & Device Adaptation](#14-reduced-motion--device-adaptation)
15. [Naming Conventions & Folder Structure](#15-naming-conventions--folder-structure)

---

## 1. Architecture Documentation

### Required Documentation

Every system boundary, data flow, and non-obvious design decision must be documented.

| Artifact              | Location                          | Required Contents                                                  |
| --------------------- | --------------------------------- | ------------------------------------------------------------------ |
| 3D Architecture       | `docs/THREE_JS_ARCHITECTURE.md`   | Scene graph, camera system, animation strategy, performance budget |
| Engineering Standards | `docs/ENGINEERING_STANDARDS.md`   | This document — enforced rules for the entire codebase             |
| Component-level docs  | Inline JSDoc block at top of file | Purpose, key decisions, Three.js concepts used (if applicable)     |
| State machines        | Inline or `docs/`                 | State flow diagrams for any state with > 3 modes                   |

### Documentation Rules

1. **Document the "why," not the "what."** Code says what. Comments say why.
2. **Every file starts with a JSDoc block** explaining its role, what changed from any prior version, and key concepts a new developer needs.
3. **ASCII diagrams over prose.** Layout diagrams, state flow charts, and component trees are mandatory for spatial or stateful systems.
4. **Keep docs co-located.** Component docs live in the component file. System docs live in `docs/`.
5. **Update docs when code changes.** Stale documentation is worse than none. If you change a camera position, update the architecture doc.

---

## 2. Page-Level Standards

### File Structure

Every route in `app/` follows this pattern:

```
app/
  route-name/
    page.tsx          ← Server Component. Exports metadata. Minimal JSX.
    RoutePage.tsx      ← Client Component ("use client"). All interactive logic.
    loading.tsx        ← REQUIRED. Skeleton/placeholder during navigation.
    error.tsx          ← REQUIRED for routes with data fetching.
```

### Metadata

Every `page.tsx` must export a `Metadata` object:

```typescript
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Title | T Creative Studio",
  description: "Unique, descriptive summary under 160 characters.",
  openGraph: {
    title: "Page Title",
    description: "Same or slightly different OG description.",
    type: "website",
  },
};
```

**Rules:**

- Title format: `"Page Name | T Creative Studio"` (pipe-separated, brand last)
- Root layout title is the exception: full brand + location + services
- Description: 120–160 characters, unique per page, no keyword stuffing
- Every page must have `openGraph` at minimum. `twitter` card recommended.

### Server vs. Client Boundary

```
page.tsx (Server Component)
  └─ RoutePage.tsx ("use client")
       └─ Interactive children
```

- `page.tsx` handles metadata, data fetching, and layout. No `"use client"`.
- `RoutePage.tsx` handles interactivity, animations, and browser APIs.
- Push the `"use client"` boundary as deep as possible. Never mark a layout as client.

---

## 3. Component Standards

### File Naming

| Type             | Convention              | Example                         |
| ---------------- | ----------------------- | ------------------------------- |
| React component  | PascalCase              | `Button.tsx`, `ServiceZone.tsx` |
| Hook             | camelCase, `use` prefix | `useStudioStore.ts`             |
| Utility          | camelCase               | `formatDate.ts`                 |
| Constants/config | camelCase               | `zones.ts`, `socials.ts`        |
| Types-only file  | camelCase               | `types.ts`                      |

### Component Structure

```typescript
"use client"; // Only if needed

/**
 * ComponentName — One-line description.
 *
 * KEY DECISIONS / CONCEPTS:
 * - Why this approach was chosen
 * - Three.js concepts used (if 3D component)
 */

// 1. Imports (grouped: react, libraries, local, types)
import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useStudioStore } from "@/stores/useStudioStore";
import type { ZoneId } from "@/lib/zones";

// 2. Types/interfaces (exported if shared)
interface ComponentProps {
  zone: ZoneDefinition;
}

// 3. Constants (module-level, UPPER_SNAKE or descriptive camelCase)
const LERP_RATE = 0.025;

// 4. Component (named export preferred for non-page components)
export function ComponentName({ zone }: ComponentProps) {
  // hooks first
  // derived state
  // effects
  // handlers
  // render
}

// 5. Sub-components (private to this file, below main export)
function InternalHelper() {}
```

### Props

- Use `interface` for component props, not `type`.
- Props interface name: `ComponentNameProps`.
- Destructure props in the function signature.
- Default values via destructuring, not `defaultProps`.
- Never use `any`. Use `unknown` and narrow with type guards.

### Exports

- **Named exports** for components, hooks, and utilities.
- **Default exports** only for `page.tsx` files (Next.js requirement).
- Re-export through `index.ts` barrel files only when a directory has > 5 related exports.

---

## 4. Custom Hooks

### Naming

All hooks start with `use`. File name matches hook name:

```
stores/useStudioStore.ts  → export const useStudioStore = create<...>()
hooks/useMediaQuery.ts    → export function useMediaQuery(query: string)
```

### Rules

1. **One hook per file** unless hooks are tightly coupled (e.g., `useStudioStore` actions).
2. **Return types must be explicit** for hooks consumed by more than one component.
3. **Never call hooks conditionally.** This is a React rule. No exceptions.
4. **Zustand stores go in `stores/`**, not `hooks/`. Zustand is state management, not a hook pattern.
5. **Document the hook's contract** — what it expects, what it returns, side effects.

### Zustand-Specific Rules

```typescript
// GOOD — typed store with explicit interface
export const useStudioStore = create<StudioState>((set, get) => ({
  mode: "landing",
  // ...
}));

// BAD — untyped store
export const useStore = create((set) => ({ ... }));
```

- Always define a `StoreNameState` interface.
- Actions live inside the store, not as standalone functions.
- Never mutate state directly. Always use `set()`.
- Use `get()` to read current state within actions, never closures over stale state.
- Guard against race conditions: check `isTransitioning` before starting new transitions.

---

## 5. Utility Functions

### Location

```
lib/           ← Domain logic, data definitions, business rules
utils/         ← Infrastructure utilities (Supabase, auth, formatting)
```

### Rules

1. **Pure functions preferred.** No side effects unless the utility's purpose is a side effect (e.g., Supabase client).
2. **Typed inputs and outputs.** No implicit `any`.
3. **Export types alongside data.** If `zones.ts` exports `ZONES`, it also exports `ZoneId` and `ZoneDefinition`.
4. **Freeze configuration objects** or use `as const` for literal types:

```typescript
export const ZONE_ORDER: ZoneId[] = ["lash", "jewelry", "crochet", "consulting"];
```

5. **No barrel exports** (`index.ts`) for `lib/` or `utils/` — import directly from the source file.

---

## 6. Three.js Scenes & WebGL Lifecycle

### Canvas Setup

```tsx
<Canvas
  camera={{ position: [0, 2.8, 9], fov: 50, near: 0.1, far: 100 }}
  dpr={[1, 1.5]}        // Cap pixel ratio for performance
  gl={{ antialias: true, alpha: false }}
>
```

**Rules:**

- **DPR capped at 1.5.** Retina at full DPR doubles GPU work for marginal visual gain.
- **Alpha: false** unless the canvas must be transparent. Saves a blend pass.
- **FOV: 50** (our standard). Lower = more telephoto/cinematic. Higher = more distortion.

### Component Boundaries

| Component Type   | Reads Store | Writes Store | Uses useFrame | Renders HTML    |
| ---------------- | ----------- | ------------ | ------------- | --------------- |
| Camera           | Yes         | Yes          | Yes           | No              |
| Lighting         | No          | No           | No            | No              |
| Room/Environment | No          | No           | No            | No              |
| Interactive Zone | Yes         | Yes          | Yes           | Yes (drei Html) |
| Display Objects  | No          | No           | Optional      | No              |

**Rules:**

- **Lighting and Room components are static.** They read no store, run no frame logic.
- **Only camera and interactive components use `useFrame`.** Minimize frame-loop work.
- **Never set React state inside `useFrame`.** Use refs for mutable values.

```typescript
// FORBIDDEN — causes 60 re-renders per second
useFrame(() => setState(camera.position.x));

// CORRECT — mutates ref directly
useFrame(() => {
  posRef.current = camera.position.x;
});
```

### Animation

All 3D animation uses **lerp-based interpolation** inside `useFrame`:

```typescript
const rate = prefersReducedMotion ? 1.0 : 0.025;
camera.position.x = THREE.MathUtils.lerp(current, target, rate);
```

| Rate      | Feel               | Use Case                     |
| --------- | ------------------ | ---------------------------- |
| 0.02      | Slow, cinematic    | Camera transitions           |
| 0.04–0.06 | Smooth, responsive | Material glow, opacity fades |
| 0.08–0.1  | Quick feedback     | Hover effects                |
| 1.0       | Instant            | Reduced motion mode          |

**Do not use GSAP, Tween.js, or CSS transitions for 3D animation.** Lerp inside `useFrame` is the standard. Framer Motion handles all HTML/2D animation.

### Material Standards

```tsx
<meshStandardMaterial
  color="#E8DFD0" // Base color
  roughness={0.6} // 0 = mirror, 1 = matte
  metalness={0.05} // 0 = plastic, 1 = chrome
  emissive={zoneColor} // Self-glow color (for hover/focus effects)
  emissiveIntensity={0.02}
/>
```

- **No shadows.** `castShadow={false}` everywhere. Shadows are too expensive for this scene.
- **Emissive for glow effects**, not additional lights. Cheaper and more controllable.
- **Transparent materials** must set `transparent={true}` explicitly.
- **No textures/images** on materials. Procedural colors only (keeps bundle at zero texture bytes).

### Geometry Standards

- All geometry is built from **Three.js primitives** (box, cylinder, sphere, torus, plane, ring, circle).
- **No GLTF/GLB model imports** unless explicitly approved. Procedural geometry is the aesthetic.
- Geometry args are specified inline: `<boxGeometry args={[width, height, depth]} />`.
- Segment counts should be minimal: 8–24 for cylinders, 16–32 for spheres. Higher only if curvature is visible.

---

## 7. Performance Requirements

### Core Web Vitals Targets

| Metric                              | Target  | Measurement            |
| ----------------------------------- | ------- | ---------------------- |
| **LCP** (Largest Contentful Paint)  | < 2.5s  | Lighthouse, web-vitals |
| **FID** (First Input Delay)         | < 100ms | Lighthouse             |
| **CLS** (Cumulative Layout Shift)   | < 0.1   | Lighthouse             |
| **INP** (Interaction to Next Paint) | < 200ms | Lighthouse             |
| **TTI** (Time to Interactive)       | < 3.5s  | Lighthouse             |

### 3D Performance Budget

| Metric                    | Budget           | Enforcement                        |
| ------------------------- | ---------------- | ---------------------------------- |
| Draw calls                | < 30             | Visual count in renderer.info      |
| Triangle count            | < 50,000         | Primitive geometry keeps this low  |
| Texture memory            | 0 MB             | No texture files — procedural only |
| Frame rate                | > 30 fps minimum | Test on mid-range hardware         |
| Three.js bundle (gzipped) | < 160 KB         | Tree-shaken by R3F                 |

### Bundle Size Rules

- **Total JS (gzipped):** < 250 KB first load (excluding Three.js, which is lazy-loaded).
- **Three.js + R3F + drei** are loaded via `next/dynamic` with `ssr: false`. They do not block first paint.
- **No dependency > 50 KB gzipped** without documented justification and team approval.
- Run `npx next build` and review the output table. No route should exceed 300 KB first-load JS.

### Image Rules

- All images use `next/image` with explicit `width`/`height` or `fill`.
- Hero images use `priority={true}`.
- Format: WebP or AVIF via Next.js automatic optimization.
- No image > 200 KB after optimization.

---

## 8. Accessibility (WCAG 2.1 AA)

### Non-Negotiable Requirements

| Requirement         | Implementation                                                                         | Standard   |
| ------------------- | -------------------------------------------------------------------------------------- | ---------- |
| Keyboard navigation | Arrow keys cycle zones, Enter/Space activates, Escape exits                            | WCAG 2.1.1 |
| Focus visible       | `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`            | WCAG 2.4.7 |
| Color contrast      | All text meets 4.5:1 (normal) or 3:1 (large) against background                        | WCAG 1.4.3 |
| Reduced motion      | System preference disables all animation; 3D scene replaced with 2D fallback           | WCAG 2.3.3 |
| Semantic HTML       | Use `<main>`, `<nav>`, `<section>`, `<footer>`, `<header>` — not `<div>` for landmarks | WCAG 1.3.1 |
| Form labels         | Every `<input>` has an associated `<label>` via `htmlFor`                              | WCAG 1.3.1 |
| Alt text            | Every `<img>` / `<Image>` has descriptive `alt`. Decorative images use `alt=""`        | WCAG 1.1.1 |
| Live regions        | Zone focus changes announced via `aria-live="polite"`                                  | WCAG 4.1.3 |
| Skip links          | "Skip to main content" link as first focusable element                                 | WCAG 2.4.1 |
| Touch targets       | Minimum 44×44px for all interactive elements                                           | WCAG 2.5.8 |

### ARIA Rules

- Prefer semantic HTML over ARIA. A `<button>` is better than `<div role="button">`.
- Use `aria-label` on icon-only buttons and links.
- Use `aria-hidden="true"` on decorative 3D canvas (content is replicated in HTML).
- Never use `aria-label` on elements that have visible text — it overrides the visible text for screen readers.

### Focus Management

- When a zone overlay opens, focus moves to the overlay's first interactive element.
- When a zone overlay closes, focus returns to the zone that was clicked.
- Tab order must follow visual reading order.

---

## 9. SEO Standards

### Required Per Route

```typescript
export const metadata: Metadata = {
  title: "...",                    // REQUIRED
  description: "...",              // REQUIRED (120-160 chars)
  openGraph: { ... },             // REQUIRED
  twitter: {                       // RECOMMENDED
    card: "summary_large_image",
    title: "...",
    description: "...",
  },
};
```

### Site-Level SEO (TODO — Implement)

| Artifact                  | Status                | Location                                                |
| ------------------------- | --------------------- | ------------------------------------------------------- |
| `robots.txt`              | Required              | `app/robots.ts` or `public/robots.txt`                  |
| `sitemap.xml`             | Required              | `app/sitemap.ts`                                        |
| Canonical URLs            | Required              | Via metadata `alternates.canonical`                     |
| Structured data (JSON-LD) | Required for services | In `page.tsx` via `<script type="application/ld+json">` |
| Social preview images     | Required              | OG images per route                                     |

### Content Rules

- Every page has a single `<h1>`.
- Heading hierarchy is sequential: `h1` → `h2` → `h3`. No skipping levels.
- Links have descriptive text. Never "click here."
- `<html lang="en">` is set in root layout (already done).

---

## 10. Code Splitting & Bundle Strategy

### Dynamic Imports

The 3D scene is the largest dependency. It must never be in the critical path:

```typescript
const QuietRoom = dynamic(() => import("@/components/three/QuietRoom"), {
  ssr: false,
  loading: () => <HeroFallback />,
});
```

**Rules:**

- **Three.js, R3F, and drei** are always loaded via `next/dynamic` with `ssr: false`.
- **Framer Motion** is allowed in the main bundle (it's used on most pages).
- **Supabase client** should be dynamically imported in route-level components, not in the root layout.
- **Form libraries** (`@tanstack/react-form`, `zod`) are only imported in route components that use forms.

### Route-Level Splitting

Next.js App Router automatically code-splits per route. Maintain this by:

- Not importing heavy page-specific components in the root layout.
- Keeping `layout.tsx` minimal (Navbar only).
- Using `next/dynamic` for below-fold sections that include heavy dependencies.

---

## 11. Rendering Strategy

### Decision Matrix

| Content                                 | Strategy                        | Why                                               |
| --------------------------------------- | ------------------------------- | ------------------------------------------------- |
| Root layout + Navbar                    | Server Component                | Static shell, no interactivity needed server-side |
| Page metadata                           | Server Component                | Must be server-rendered for SEO                   |
| Landing sections (Hero, Services, etc.) | Client Component                | Framer Motion animations require client           |
| 3D Studio                               | Client Component + `ssr: false` | WebGL requires browser APIs                       |
| Contact form                            | Client Component                | Form state, validation, submission                |
| About / static pages                    | Server Component where possible | Faster TTFB, better SEO                           |

### Rules

1. **Default to Server Components.** Only add `"use client"` when you need:
   - `useState`, `useEffect`, `useRef` (with DOM access)
   - Browser APIs (`window`, `document`, `navigator`)
   - Event handlers (`onClick`, `onChange`, etc.)
   - Third-party client libraries (Framer Motion, R3F, Zustand)
2. **Never mark `layout.tsx` as `"use client"`.** It breaks server component benefits for all children.
3. **Data fetching happens in Server Components** or via API routes, never in `useEffect` (except for real-time subscriptions).

---

## 12. Testing Expectations

### Current State

No test runner is configured. The following standards apply once testing is implemented.

### Required Test Coverage (Target)

| Layer             | Tool                                  | Minimum Coverage                                                  |
| ----------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Unit tests        | Vitest                                | Utility functions, Zustand store logic, Zod schemas               |
| Component tests   | Vitest + React Testing Library        | UI components, form validation, navigation                        |
| Integration tests | Playwright                            | Critical user flows (studio navigation, form submission, booking) |
| Visual regression | Playwright screenshots                | Landing page, studio scene (2D fallback)                          |
| Accessibility     | axe-core (via Playwright or jest-axe) | Every page passes axe scan with 0 violations                      |
| Performance       | Lighthouse CI                         | Core Web Vitals pass on every PR                                  |

### What to Test

- **Always test:** State transitions in Zustand stores, form validation schemas, utility functions, keyboard navigation flows.
- **Never test:** Three.js rendering output (too flaky), CSS class names, implementation details of animations.

### Test File Location

```
__tests__/
  unit/
    stores/useStudioStore.test.ts
    lib/zones.test.ts
  integration/
    studio-navigation.test.ts
    contact-form.test.ts
```

Test files live in `__tests__/` at the project root, mirroring the source structure.

---

## 13. Memory Management (Three.js)

### The Problem

Three.js objects (geometries, materials, textures) allocate GPU memory. Unlike DOM elements, they are **not garbage collected automatically** when React unmounts components. You must explicitly dispose them.

### Rules

1. **R3F handles disposal for declarative JSX meshes.** If you write `<mesh><boxGeometry /><meshStandardMaterial /></mesh>`, R3F disposes it on unmount. You don't need to.

2. **Imperative Three.js objects must be manually disposed:**

```typescript
useEffect(() => {
  const geometry = new THREE.BufferGeometry();
  const material = new THREE.MeshStandardMaterial();
  // ... use them ...

  return () => {
    geometry.dispose();
    material.dispose();
  };
}, []);
```

3. **Never create Three.js objects inside `useFrame`.** This allocates new objects 60× per second and leaks memory.

```typescript
// FORBIDDEN — allocates a new Vector3 every frame
useFrame(() => {
  camera.position.copy(new THREE.Vector3(x, y, z));
});

// CORRECT — reuse a ref
const target = useRef(new THREE.Vector3());
useFrame(() => {
  target.current.set(x, y, z);
  camera.position.lerp(target.current, 0.025);
});
```

4. **If you load textures or GLTF models** (currently not used), dispose them in cleanup:

```typescript
useEffect(() => {
  const texture = new THREE.TextureLoader().load(url);
  return () => texture.dispose();
}, [url]);
```

5. **Monitor with `renderer.info`** during development:

```typescript
useFrame(({ gl }) => {
  console.log(gl.info.memory); // { geometries, textures }
  console.log(gl.info.render); // { calls, triangles, points, lines }
});
```

If `geometries` or `textures` count grows over time, you have a leak.

---

## 14. Reduced Motion & Device Adaptation

### Reduced Motion

Users with `prefers-reduced-motion: reduce` get:

1. **No 3D scene.** The Canvas is not rendered. `HeroFallback.tsx` (2D) is shown instead.
2. **No CSS animations.** Global rule in `globals.css` sets all durations to `0.01ms`.
3. **Framer Motion respects system preference** when configured (use `useReducedMotion()` from Framer).

```css
/* globals.css — already implemented */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Mobile Adaptation

| Viewport     | Behavior                                                   |
| ------------ | ---------------------------------------------------------- |
| < 768px      | 3D scene replaced with 2D fallback. Full HTML experience.  |
| 768px–1024px | 3D scene rendered at reduced DPR. Simplified interactions. |
| > 1024px     | Full 3D experience.                                        |

### Device Capability Detection

Before rendering the Canvas, check:

```typescript
const canRender3D =
  typeof window !== "undefined" &&
  window.innerWidth >= 768 &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
```

If any check fails, render the 2D fallback. Never force 3D on incapable devices.

---

## 15. Naming Conventions & Folder Structure

### Project Structure

```
t-creative/
├── app/                        # Next.js App Router — pages and layouts
│   ├── layout.tsx              # Root layout (Server Component)
│   ├── page.tsx                # Home page
│   ├── globals.css             # Design tokens, theme, global resets
│   ├── route-name/
│   │   ├── page.tsx            # Route entry (Server Component, exports metadata)
│   │   └── RouteNamePage.tsx   # Client Component with interactive content
│   └── ...
│
├── components/                 # React components
│   ├── ui/                     # Reusable, generic UI primitives
│   │   ├── Button.tsx
│   │   ├── SectionWrapper.tsx
│   │   └── ...
│   ├── landing/                # Landing page sections
│   │   ├── Hero.tsx
│   │   ├── Services.tsx
│   │   └── ...
│   ├── three/                  # React Three Fiber 3D components
│   │   ├── QuietRoom.tsx       # Canvas wrapper (entry point)
│   │   ├── StudioScene.tsx     # Scene composer
│   │   ├── StudioCamera.tsx    # Camera controller
│   │   ├── StudioRoom.tsx      # Room geometry
│   │   ├── StudioLighting.tsx  # Lights
│   │   ├── ServiceZone.tsx     # Interactive zone
│   │   ├── ZoneDisplays.tsx    # Zone-specific 3D objects
│   │   └── HeroFallback.tsx    # 2D fallback
│   ├── atelier/                # Studio UI overlays
│   │   ├── StudioNav.tsx
│   │   └── ZoneOverlay.tsx
│   └── Navbar.tsx              # Global navigation
│
├── lib/                        # Domain logic, configuration, data
│   ├── zones.ts                # Zone definitions, camera targets
│   └── socials.ts              # Social media links
│
├── stores/                     # Zustand state stores
│   └── useStudioStore.ts
│
├── utils/                      # Infrastructure utilities
│   └── supabase/               # Supabase client and middleware
│
├── docs/                       # Documentation
│   ├── ENGINEERING_STANDARDS.md
│   └── THREE_JS_ARCHITECTURE.md
│
├── public/                     # Static assets (images, fonts, favicon)
│
└── __tests__/                  # Test files (when implemented)
```

### Naming Rules

| Entity               | Convention                        | Example                                           |
| -------------------- | --------------------------------- | ------------------------------------------------- |
| React component      | PascalCase                        | `StudioCamera.tsx`                                |
| Component file       | Matches component name            | `ServiceZone.tsx` → `export function ServiceZone` |
| Hook                 | camelCase with `use` prefix       | `useStudioStore.ts`                               |
| Zustand store        | `use[Name]Store`                  | `useStudioStore`                                  |
| Utility file         | camelCase                         | `zones.ts`, `formatPrice.ts`                      |
| Type/Interface       | PascalCase                        | `ZoneDefinition`, `StudioState`                   |
| Type union           | PascalCase                        | `StudioMode`, `ZoneId`                            |
| Constant (config)    | camelCase or UPPER_SNAKE          | `HERO_CAMERA`, `LERP_RATE`                        |
| CSS variable         | `--color-name` or `--layout-name` | `--color-studio-blush`                            |
| Tailwind theme token | kebab-case                        | `bg-background`, `text-foreground`                |
| Route directory      | kebab-case                        | `app/about/`, `app/contact/`                      |
| Three.js mesh keys   | kebab-case with prefix            | `key="lash-leg-0"`                                |
| Event handlers       | `handle[Event]` or `on[Event]`    | `handleClick`, `onPointerOver`                    |

### Import Order

Within every file, imports are grouped and ordered:

```typescript
// 1. React / Next.js
import { useRef, useState } from "react";
import type { Metadata } from "next";

// 2. Third-party libraries
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { motion } from "framer-motion";

// 3. Internal — components
import { Button } from "@/components/ui/Button";

// 4. Internal — lib / stores / utils
import { useStudioStore } from "@/stores/useStudioStore";
import { ZONES } from "@/lib/zones";

// 5. Types (type-only imports last)
import type { ZoneId, ZoneDefinition } from "@/lib/zones";
```

### Path Aliases

All internal imports use the `@/` alias (mapped to project root in `tsconfig.json`):

```typescript
// GOOD
import { Button } from "@/components/ui/Button";

// BAD — relative paths are fragile
import { Button } from "../../../components/ui/Button";
```

---

## Appendix A: Design Tokens

All colors are defined as CSS custom properties in `app/globals.css` and mapped to Tailwind via `@theme inline`. Never hardcode hex values in components — use Tailwind classes or CSS variables.

| Token                                       | Hex       | Usage            |
| ------------------------------------------- | --------- | ---------------- |
| `--color-ivory` / `bg-background`           | `#FAF6F1` | Page background  |
| `--color-deep-espresso` / `text-foreground` | `#2C2420` | Body text        |
| `--color-warm-cream` / `bg-surface`         | `#F3ECE4` | Card backgrounds |
| `--color-warm-stone` / `text-muted`         | `#6B5D52` | Secondary text   |
| `--color-studio-blush` / `text-accent`      | `#C4907A` | Accent color     |
| `--color-focus-ring` / `ring-focus`         | `#A06B52` | Focus indicators |

**Exception:** Three.js materials use hex strings directly (`color="#E8DFD0"`) because Three.js cannot read CSS variables. These colors are documented in `ZoneDisplays.tsx` as module-level constants.

---

## Appendix B: Git & Workflow Standards

### Branch Naming

```
feature/short-description    # New feature
fix/short-description        # Bug fix
refactor/short-description   # Code restructuring
docs/short-description       # Documentation only
```

### Commit Messages

```
Add lash zone treatment bed and ring light
Fix camera lerp rate on zone transition
Update Three.js architecture docs for new zone layout
```

- Imperative mood ("Add", not "Added" or "Adds")
- Under 72 characters for the subject line
- Body explains "why," not "what" (the diff shows what)
- No emoji in commit messages

### Pre-Merge Checklist

Before merging any PR:

- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] No `console.log` statements (except guarded debug output)
- [ ] No `any` types introduced
- [ ] New components have JSDoc block
- [ ] Accessibility: keyboard navigable, focus visible, color contrast met
- [ ] Performance: no new dynamic imports skipping `ssr: false` for browser-only code
- [ ] Three.js: no `new THREE.*` inside `useFrame`, no React state in `useFrame`

---

## Appendix C: Enforcement

These standards are enforced through:

1. **ESLint** — TypeScript strict rules, Next.js core-web-vitals preset
2. **TypeScript strict mode** — no implicit any, strict null checks
3. **Code review** — every PR reviewed against this document
4. **Build gate** — `npm run build` must pass before merge
5. **This document** — the source of truth. If it's not here, it's not a rule.

Standards are living. Update this document via PR when patterns evolve. Never silently deviate.
