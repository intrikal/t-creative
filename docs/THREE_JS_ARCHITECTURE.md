# T Creative Studio — 3D Interactive Architecture

Senior-level reference for the React Three Fiber scene powering the T Creative Studio digital flagship experience.

---

## Table of Contents

1. [Mental Model](#1-mental-model)
2. [Technology Stack](#2-technology-stack)
3. [Scene Graph Layout](#3-scene-graph-layout)
4. [Component Architecture](#4-component-architecture)
5. [State Management](#5-state-management)
6. [Camera System](#6-camera-system)
7. [Animation Strategy](#7-animation-strategy)
8. [Zone Interaction Model](#8-zone-interaction-model)
9. [UX Guardrails](#9-ux-guardrails)
10. [Performance](#10-performance)
11. [Accessibility](#11-accessibility)
12. [File Map](#12-file-map)

---

## 1. Mental Model

### What Three.js Actually Is

Three.js is a JavaScript library that draws 3D graphics using WebGL (the browser's GPU-accelerated rendering API). Think of it as:

- **Scene** = a stage. Everything visible lives here.
- **Camera** = your eyes. It determines what you see and from what angle.
- **Renderer** = the projectionist. It converts the 3D scene into 2D pixels on your screen every frame (ideally 60 times per second).
- **Mesh** = an object. A mesh = geometry (shape) + material (appearance).
- **Geometry** = the wireframe shape (box, sphere, plane, custom).
- **Material** = how the surface looks (color, roughness, metalness, transparency).
- **Light** = illumination sources. Without light, everything is black.

### What React Three Fiber (R3F) Is

R3F is a React renderer for Three.js. Instead of writing imperative Three.js code:

```javascript
// Imperative Three.js (you won't write this)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: "red" });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

You write declarative JSX:

```tsx
// React Three Fiber (what you write)
<mesh>
  <boxGeometry args={[1, 1, 1]} />
  <meshStandardMaterial color="red" />
</mesh>
```

**Every Three.js class has a JSX equivalent in R3F.** The class name becomes camelCase:

- `THREE.BoxGeometry` → `<boxGeometry />`
- `THREE.MeshStandardMaterial` → `<meshStandardMaterial />`
- `THREE.PointLight` → `<pointLight />`

### What @react-three/drei Is

Drei is a utility library for R3F. It provides pre-built components for common patterns:

- `<Html>` — renders real HTML/CSS inside the 3D scene (for labels, overlays)
- `<Float>` — makes objects gently bob up and down
- `<MeshReflectorMaterial>` — creates realistic floor reflections
- `<Environment>` — adds ambient environment lighting

### The Render Loop

R3F runs a render loop at ~60fps. The `useFrame` hook lets you run code every frame:

```tsx
useFrame((state, delta) => {
  // state.camera — the camera object
  // state.pointer — normalized mouse position (-1 to 1)
  // delta — time since last frame (use for frame-rate-independent animation)
  mesh.current.rotation.y += delta * 0.5; // rotate 0.5 radians per second
});
```

**Critical rule**: Never set React state inside `useFrame`. It causes re-renders at 60fps and crashes your app. Use refs instead:

```tsx
// BAD — causes 60 re-renders per second
useFrame(() => setPosition(camera.position.x));

// GOOD — mutates ref directly, no re-render
useFrame(() => {
  positionRef.current = camera.position.x;
});
```

---

## 2. Technology Stack

| Layer         | Tool                                | Role                                                   |
| ------------- | ----------------------------------- | ------------------------------------------------------ |
| 3D Engine     | Three.js                            | WebGL rendering, geometry, materials, lighting         |
| React Binding | @react-three/fiber                  | Declarative Three.js via JSX, render loop              |
| 3D Utilities  | @react-three/drei                   | Pre-built components (Html, Float, reflectors)         |
| Animation     | R3F useFrame + THREE.MathUtils.lerp | Frame-based interpolation (chosen over GSAP)           |
| State         | Zustand                             | Cross-boundary state (works inside and outside Canvas) |
| 2D Animation  | Framer Motion                       | HTML overlay animations (fade, slide, spring)          |
| Styling       | Tailwind CSS v4                     | UI overlays and landing page                           |

### Why R3F useFrame over GSAP for 3D

GSAP is excellent for DOM animation but adds complexity when mixed with R3F:

- GSAP runs its own ticker, competing with R3F's render loop
- Interpolating Three.js Vector3 objects with GSAP requires manual wiring
- `THREE.MathUtils.lerp` is simpler, runs inside `useFrame`, and gives buttery smooth results

We use **lerp (linear interpolation)** for all 3D animation:

```typescript
// lerp(current, target, rate) — moves current toward target by rate% each frame
// rate 0.02 = slow, cinematic drift
// rate 0.05 = responsive, snappy
// rate 1.0 = instant snap (reduced motion)
camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, 0.025);
```

Framer Motion handles all HTML overlay animations (the 2D layer on top of the Canvas).

---

## 3. Scene Graph Layout

### Physical Space — Top-Down View

```
                    ┌─────────────────────────┐
                    │                         │
                    │    LASH EXTENSIONS       │
                    │    (Back-Left Zone)      │
                    │    Z: -4, X: -3          │
                    │                         │
    ┌───────────────┼─────────────────────────┼───────────────┐
    │               │                         │               │
    │  HR &         │                         │  PERMANENT    │
    │  CONSULTING   │      CENTER ATRIUM      │  JEWELRY      │
    │  (Front-Left) │      (Camera Home)      │  (Front-Right)│
    │  Z: -2, X: -3 │      Z: 0, X: 0        │  Z: -2, X: 3  │
    │               │                         │               │
    └───────────────┼─────────────────────────┼───────────────┘
                    │                         │
                    │    CROCHET              │
                    │    MARKETPLACE           │
                    │    (Back-Right Zone)     │
                    │    Z: -4, X: 3           │
                    │                         │
                    └─────────────────────────┘

    Camera starts at [0, 2.2, 6] looking at [0, 1, 0]
    Each zone has a camera target that frames it.
```

### Why This Layout (Not Linear Rooms)

The previous design used a linear corridor (rooms connected along Z-axis). This created:

- A journey that felt sequential and long
- Camera transitions that only moved forward/backward
- No sense of spatial overview

The new radial layout:

- Lets the camera survey the whole space from center
- Each zone feels equally accessible (no hierarchy)
- Transitions are short, varied angles — more cinematic
- The space feels like a boutique showroom, not a hallway

### The Room Structure

One large open room (16×5×16 units) with:

- Four pedestals/display areas, one per zone
- A center floor marker (the "home" position)
- Soft partition walls between zones (not full walls — low dividers)
- Each zone has its own accent lighting

---

## 4. Component Architecture

### Component Tree

```
<Canvas>                          ← R3F Canvas (WebGL context)
  <Suspense>
    <StudioScene>                 ← Master scene composer
      <StudioLighting />          ← All lights
      <StudioCamera />            ← Camera controller (reads store)
      <StudioRoom />              ← Floor, walls, ceiling geometry
      <ServiceZone />             ← Lash Extensions (interactive)
      <ServiceZone />             ← Permanent Jewelry
      <ServiceZone />             ← Crochet Marketplace
      <ServiceZone />             ← HR Consulting
      <CenterMarker />            ← Floor accent at camera home
    </StudioScene>
  </Suspense>
</Canvas>

{/* HTML Layer (outside Canvas) */}
<StudioNav />                     ← Navigation dots + exit button
<ZoneOverlay />                   ← Service detail panel (booking/inquiry)
```

### Key Principle: Separation of Concerns

| Component      | Reads Store? | Writes Store?            | Uses useFrame? | Renders HTML?   |
| -------------- | ------------ | ------------------------ | -------------- | --------------- |
| StudioCamera   | Yes          | Yes (completeTransition) | Yes            | No              |
| ServiceZone    | Yes (mode)   | Yes (navigate, hover)    | Yes (glow)     | Yes (drei Html) |
| StudioLighting | No           | No                       | No             | No              |
| StudioRoom     | No           | No                       | No             | No              |
| StudioNav      | Yes          | Yes                      | No             | Yes (real DOM)  |
| ZoneOverlay    | Yes          | Yes                      | No             | Yes (real DOM)  |

---

## 5. State Management

### Why Zustand (Not Context, Not Redux)

The 3D scene runs inside an R3F `<Canvas>`, which creates a **separate React reconciler**. React Context from the outer app does NOT cross into the Canvas. Zustand's vanilla store works everywhere — inside `useFrame`, inside Canvas components, and in regular React components.

### Store Shape

```typescript
type StudioMode = "landing" | "entering" | "exploring" | "focused" | "exiting";
type ZoneId = "lash" | "jewelry" | "crochet" | "consulting";

interface StudioState {
  mode: StudioMode;
  activeZone: ZoneId | null; // which zone the camera is focused on
  targetZone: ZoneId | null; // where the camera is transitioning to
  isTransitioning: boolean; // camera is in motion
  hoveredZone: ZoneId | null; // which zone has mouse hover

  enterStudio: () => void; // landing → entering → exploring
  exitStudio: () => void; // exploring → exiting → landing
  focusZone: (id: ZoneId) => void; // move camera to zone
  unfocusZone: () => void; // return camera to center
  completeTransition: () => void; // called when camera arrives
  setHoveredZone: (id: ZoneId | null) => void;
}
```

### State Flow Diagram

```
LANDING ──[Enter Studio]──→ ENTERING ──[camera arrives]──→ EXPLORING
                                                              │
                                                    [click zone]
                                                              │
                                                              ▼
                                                          FOCUSED
                                                              │
                                                    [click back / overlay close]
                                                              │
                                                              ▼
                                                          EXPLORING
                                                              │
                                                    [click exit]
                                                              │
                                                              ▼
                                                          EXITING ──→ LANDING
```

---

## 6. Camera System

### Named Camera Positions

Each state has a specific camera position and lookAt target:

| State               | Position     | LookAt        | Feeling              |
| ------------------- | ------------ | ------------- | -------------------- |
| Landing (hero)      | [0, 2.2, 8]  | [0, 1, 0]     | Distant overview     |
| Exploring (center)  | [0, 2.2, 6]  | [0, 1, 0]     | Inside the room      |
| Focused: Lash       | [-2.5, 2, 0] | [-3, 1.2, -4] | Close to left-back   |
| Focused: Jewelry    | [2.5, 2, 0]  | [3, 1.2, -2]  | Close to right-front |
| Focused: Crochet    | [2.5, 2, -2] | [3, 1.2, -4]  | Close to right-back  |
| Focused: Consulting | [-2.5, 2, 0] | [-3, 1.2, -2] | Close to left-front  |

### Transition Mechanics

```typescript
useFrame(() => {
  // 1. Determine target based on store state
  const target = getTargetForCurrentState();

  // 2. Lerp camera position toward target
  camera.position.lerp(target.position, 0.025);
  lookAtRef.current.lerp(target.lookAt, 0.025);
  camera.lookAt(lookAtRef.current);

  // 3. Add mouse parallax (only when not transitioning)
  if (!isTransitioning) {
    camera.position.x += pointer.x * 0.15;
    camera.position.y += pointer.y * 0.08;
  }

  // 4. Check arrival
  if (isTransitioning && distanceToTarget < 0.05) {
    completeTransition();
  }
});
```

### Why Lerp Feels Premium

Lerp with a low rate (0.02-0.03) creates an **ease-out** effect naturally:

- When far from target: moves fast (large distance × rate = large step)
- When close to target: moves slow (small distance × rate = small step)
- Result: quick departure, gentle arrival — cinematic

---

## 7. Animation Strategy

### What Animates and How

| Element         | Technique                | Trigger            | Speed            |
| --------------- | ------------------------ | ------------------ | ---------------- |
| Camera position | R3F useFrame + lerp      | Store state change | 0.025 rate       |
| Zone hover glow | useFrame + emissive lerp | Pointer events     | 0.08 rate        |
| Zone pulse      | useFrame + Math.sin      | Continuous (idle)  | 0.002 freq       |
| Fog density     | useFrame + lerp          | Focus/unfocus      | 0.03 rate        |
| HTML overlays   | Framer Motion            | AnimatePresence    | Spring physics   |
| Label fade      | CSS + Tailwind           | Hover state        | 200ms transition |

### The "Breath" Pattern

Idle objects use a sinusoidal pulse to feel alive without demanding attention:

```typescript
useFrame(() => {
  const pulse = 1 + Math.sin(Date.now() * 0.002) * 0.02;
  mesh.current.scale.setScalar(baseScale * pulse);
});
```

- Amplitude 0.02 = barely perceptible (2% size change)
- Frequency 0.002 = slow, calm breathing (~3 second cycle)
- Higher values feel anxious. Lower values feel dead.

### Focus/Blur Effect

When a zone is focused:

1. Camera transitions to zone's camera position (lerp)
2. Fog `near` pulls closer (makes non-focused zones fade)
3. Non-focused zones reduce opacity to 0.3
4. Focused zone emissive increases slightly
5. HTML overlay slides in from the right (Framer Motion spring)

---

## 8. Zone Interaction Model

### Hover → Click → Focus → Action

```
[User hovers zone]
  → Cursor becomes pointer
  → Zone emissive glow increases (warm)
  → Label fades in above zone
  → Other zones unaffected

[User clicks zone]
  → Store: focusZone(id)
  → Camera transitions to zone camera position
  → Fog increases (background zones fade)
  → Overlay slides in with service details + CTA

[User clicks CTA in overlay]
  → "Book Now" / "Request Consultation" / "Browse"
  → Opens external link or scrolls to booking section

[User clicks back / closes overlay]
  → Store: unfocusZone()
  → Camera returns to center
  → Fog returns to normal
  → All zones visible again
```

### Pointer Events in R3F

R3F meshes support DOM-like events:

```tsx
<mesh
  onPointerOver={() => setHovered(true)}   // mouse enters mesh
  onPointerOut={() => setHovered(false)}    // mouse leaves mesh
  onClick={() => focusZone('lash')}         // click mesh
>
```

**Important**: These events use raycasting — R3F projects a ray from the camera through the mouse position and checks if it intersects any mesh. This is automatic; you don't need to set it up.

---

## 9. UX Guardrails for Premium Feel

### DO

- **Slow transitions** (lerp rate 0.02-0.03). Fast = cheap. Slow = luxury.
- **Low contrast animations**. Glow from 0 to 0.3 emissive, not 0 to 1.
- **Muted palette**. Ivory, cream, blush, warm stone. No saturated colors.
- **Minimal text in 3D**. Labels only. Details go in HTML overlays.
- **One action at a time**. User focuses one zone. No split attention.
- **Generous whitespace**. Zones spaced apart. Room should feel spacious.
- **Consistent timing**. All transitions use the same lerp rate.

### DO NOT

- Orbit controls (feels like a 3D model viewer, not a boutique)
- Particle effects (feels like a game)
- Loading spinners in 3D (use the 2D fallback during load)
- Sound effects (unless the brand specifically wants ambient audio)
- Scroll-jacking (the landing page below scrolls normally)
- Neon or saturated accent colors
- Fast or bouncy spring animations
- More than 4 zones (cognitive overload)

### The "Gallery Test"

Ask: "Would this interaction feel at home in a high-end gallery?"

- Floating label on hover? Yes (like a museum placard).
- Bouncing icon? No (like a mobile game).
- Smooth camera glide? Yes (like a Steadicam shot).
- Snap zoom? No (like Google Street View).

---

## 10. Performance

### Budget

| Metric                 | Target         | Why                                |
| ---------------------- | -------------- | ---------------------------------- |
| Draw calls             | < 30           | Each mesh + material = 1 draw call |
| Triangles              | < 50,000       | Primitive geometry keeps this low  |
| Texture memory         | < 20MB         | No textures (procedural materials) |
| Frame rate             | 30fps minimum  | DPR capped at 1.5                  |
| Bundle size (Three.js) | ~150KB gzipped | Tree-shaken by R3F                 |

### Techniques Used

- **`dpr={[1, 1.5]}`** on Canvas — caps pixel ratio, halves GPU work on retina
- **Procedural geometry** — no external model files to load
- **Conditional Html rendering** — drei `<Html>` labels only render within distance
- **No shadows** — `castShadow={false}` everywhere (shadows are expensive)
- **Fog** — hides distant geometry so GPU can skip it (frustum culling)
- **Dynamic import** — `next/dynamic` with `ssr: false` for the entire Canvas

### Mobile Fallback

When viewport < 768px or `prefers-reduced-motion: reduce`:

- Canvas is not rendered at all
- 2D fallback (HeroFallback.tsx) shows instead
- "Enter the Studio" scrolls to service cards on the landing page

---

## 11. Accessibility

| Requirement      | Implementation                                      |
| ---------------- | --------------------------------------------------- |
| Keyboard nav     | Arrow keys cycle zones, Enter focuses, Escape exits |
| Screen reader    | `aria-live="polite"` announces zone changes         |
| Reduced motion   | Lerp rate set to 1.0 (instant), no pulse animation  |
| Focus management | Focus moves to overlay on open, returns on close    |
| Color contrast   | All HTML text meets WCAG AA (4.5:1 minimum)         |
| Mobile           | Full 2D alternative, no 3D required                 |

---

## 12. File Map

```
lib/
  zones.ts                    ← Zone definitions, camera targets, content

stores/
  useStudioStore.ts           ← Zustand store for studio state

components/
  three/
    QuietRoom.tsx             ← R3F Canvas wrapper (entry point)
    StudioScene.tsx           ← Scene composer (replaces old Scene.tsx)
    StudioCamera.tsx          ← Camera controller with lerp transitions
    StudioRoom.tsx            ← Room geometry (floor, walls, ceiling)
    StudioLighting.tsx        ← All light sources
    ServiceZone.tsx           ← Reusable interactive zone (mesh + label)
    HeroFallback.tsx          ← 2D fallback for mobile

  atelier/
    StudioNav.tsx             ← Navigation overlay (dots, exit button)
    ZoneOverlay.tsx           ← Service detail panel + CTA

  landing/
    Hero.tsx                  ← Hero section (orchestrates 3D vs 2D)
    LandingContent.tsx        ← Below-fold sections
```

---

## Glossary

| Term       | Meaning                                                                 |
| ---------- | ----------------------------------------------------------------------- |
| Mesh       | A 3D object = geometry + material                                       |
| Geometry   | The shape (box, sphere, plane, custom)                                  |
| Material   | Surface appearance (color, roughness, emissive glow)                    |
| Lerp       | Linear interpolation — smoothly move from A to B over time              |
| Emissive   | Self-illumination on a material (makes it glow without a light)         |
| Raycasting | Detecting which 3D object the mouse is pointing at                      |
| Fog        | Distance-based fade effect (objects far from camera become invisible)   |
| DPR        | Device Pixel Ratio — how many physical pixels per CSS pixel             |
| useFrame   | R3F hook that runs every animation frame (~60fps)                       |
| Zustand    | Lightweight state library that works across React reconciler boundaries |
