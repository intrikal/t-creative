/**
 * zones — Zone definitions and camera presets for the 3D studio.
 *
 * Each zone maps to a business vertical (lash & skin, jewelry, craft, consulting)
 * with associated camera positions, platform sizes, and marketing copy.
 * All spatial units are meters (1 unit ≈ 1 meter).
 *
 * Consumed by the Three.js landing page scene (`app/(public)/page.tsx`)
 * and the zone navigation UI. Changes here directly affect camera
 * animations, pedestal placement, and the marketing text overlays.
 *
 * Coordinate system: Y is up, camera faces -Z. The room is centered
 * at [0, 0, -5] with dimensions 14 wide x 10 deep x 4.5 tall.
 *
 * @module lib/zones
 */
export type ZoneId = "lash" | "jewelry" | "crochet" | "consulting";

/**
 * Full definition for a single zone in the 3D studio scene.
 * Contains both marketing copy (label, heading, description, CTA) and
 * spatial data (camera angles, pedestal placement, platform dimensions).
 */
export interface ZoneDefinition {
  /** Unique identifier matching the business vertical. */
  id: ZoneId;
  /** Short display name shown in the zone navigation bar. */
  label: string;
  /** Tagline shown beneath the label in the zone overlay. */
  subtitle: string;
  /** Full heading for the zone detail panel. */
  heading: string;
  /** Marketing body copy shown in the zone detail panel. */
  description: string;
  /** Call-to-action button — label text and route to navigate to. */
  cta: { label: string; href: string };
  /** Brand color for this zone (hex) — used for accent borders, glows, and UI highlights. */
  color: string;
  /** Where the camera moves to when this zone is selected [x, y, z] in meters. */
  cameraPosition: [number, number, number];
  /** Point the camera aims at when this zone is selected [x, y, z] in meters. */
  cameraLookAt: [number, number, number];
  /** World position of the display pedestal (product showcase platform) [x, y, z]. */
  pedestalPosition: [number, number, number];
  /** Platform width (X) and depth (Z) in meters — lash zone is largest. */
  platformSize: [number, number];
  /** Height (Y) for the HTML zone label floating above the display pedestal. */
  labelHeight: number;
}

/**
 * Camera positions for non-zone states (no zone selected).
 *
 * HERO_CAMERA: Pulled-back landing page view — positioned outside
 * the room looking in, used on initial page load before the user
 * interacts with any zone.
 *
 * CENTER_CAMERA: Inside the room, high enough to see all four zones.
 * Used when the user clicks "back" from a zone view.
 */
// Elevated isometric overview — see the whole room like a dollhouse
export const HERO_CAMERA = {
  position: [10, 9, 10] as [number, number, number],
  lookAt: [0, 0.5, -5] as [number, number, number],
};

// Same elevated view used as the "overview" when no zone is selected
export const CENTER_CAMERA = {
  position: [10, 9, 10] as [number, number, number],
  lookAt: [0, 0.5, -5] as [number, number, number],
};

/**
 * Zone layout (top-down, camera faces -Z):
 *
 *         BACK WALL (teal, Z = -10)
 *  ┌─────────────┬─────────────┐
 *  │   LASH      │  CROCHET    │
 *  │  (-4, -7.5) │  (4, -7.5)  │
 *  ├─────────────┼─────────────┤
 *  │ CONSULTING  │  JEWELRY    │
 *  │  (-4, -2.5) │  (4, -2.5)  │
 *  └─────────────┴─────────────┘
 *         FRONT (Z = 0)
 */
export const ZONES: Record<ZoneId, ZoneDefinition> = {
  lash: {
    id: "lash",
    label: "Lash & Skin Studio",
    subtitle: "Precision. Patience. Artistry.",
    heading: "Lash Extensions & Skin Treatments",
    description:
      "Full sets, fills, and removals — each appointment structured around technique and care. Classic, hybrid, and volume sets tailored to your eye shape and lifestyle. Personalized skin consultations and treatments designed to restore, protect, and reveal your best skin.",
    cta: { label: "Book Your Appointment", href: "/book/tcreativestudio" },
    color: "#C4907A",
    cameraPosition: [-2, 2.0, -4.8],
    cameraLookAt: [-4, 0.5, -7.5],
    pedestalPosition: [-4, 0, -7.5],
    platformSize: [3.8, 3.2],
    labelHeight: 2.4,
  },
  jewelry: {
    id: "jewelry",
    label: "Permanent Jewelry",
    subtitle: "14k gold-filled and sterling silver, sealed with intention.",
    heading: "Welded. Worn. Kept.",
    description:
      "Custom-fit chains welded on-site. No clasp. Bracelets, anklets, and necklaces sized to you — a single, permanent gesture. Perfect for couples, best friends, or a promise to yourself.",
    cta: { label: "Book a Welding Session", href: "/book/tcreativestudio" },
    color: "#D4A574",
    cameraPosition: [2.2, 2.0, -0.3],
    cameraLookAt: [4, 0.6, -2.5],
    pedestalPosition: [4, 0, -2.5],
    platformSize: [2.8, 2.4],
    labelHeight: 2.2,
  },
  crochet: {
    id: "crochet",
    label: "Creative Craftsmanship",
    subtitle: "Handmade. Designed. Made to order.",
    heading: "Crochet, Hair & 3D Printing",
    description:
      "Crochet hair installs — box braids, goddess locs, knotless braids. Handcrafted crochet pieces — bags, accessories, home goods. Custom 3D-printed designs and creative commissions. Every piece is made with intention, built to be one-of-a-kind.",
    cta: { label: "Browse the Collection", href: "/shop" },
    color: "#7BA3A3",
    cameraPosition: [2.2, 2.0, -5],
    cameraLookAt: [4, 0.6, -7.5],
    pedestalPosition: [4, 0, -7.5],
    platformSize: [2.8, 2.4],
    labelHeight: 2.2,
  },
  consulting: {
    id: "consulting",
    label: "Business Consulting",
    subtitle: "Structure. Clarity. Growth.",
    heading: "HR & Business Infrastructure",
    description:
      "Operational strategy, HR systems, and business consulting for small businesses and creative entrepreneurs. We build the systems that let you focus on the work that matters.",
    cta: { label: "Request a Consultation", href: "/contact" },
    color: "#5B8A8A",
    cameraPosition: [-2.2, 2.0, -0.3],
    cameraLookAt: [-4, 0.6, -2.5],
    pedestalPosition: [-4, 0, -2.5],
    platformSize: [2.8, 2.4],
    labelHeight: 2.2,
  },
};

/**
 * Navigation order for zone cycling (arrow keys, mobile swipe).
 * Follows a clockwise path through the room starting from the
 * primary business vertical (lash studio).
 */
export const ZONE_ORDER = [
  "lash",
  "jewelry",
  "crochet",
  "consulting",
] as const satisfies readonly ZoneId[];
