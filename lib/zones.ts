/**
 * zones — Zone definitions and camera presets for the 3D studio.
 *
 * Each zone maps to a business vertical (lash, jewelry, crochet, consulting)
 * with associated camera positions, platform sizes, and marketing copy.
 * All spatial units are meters (1 unit ≈ 1 meter).
 */
export type ZoneId = "lash" | "jewelry" | "crochet" | "consulting";

export interface ZoneDefinition {
  id: ZoneId;
  label: string;
  subtitle: string;
  heading: string;
  description: string;
  cta: { label: string; href: string };
  color: string;
  cameraPosition: [number, number, number];
  cameraLookAt: [number, number, number];
  pedestalPosition: [number, number, number];
  /** Platform width (X) and depth (Z) — lash zone is largest */
  platformSize: [number, number];
  /** Height for the HTML zone label above the display */
  labelHeight: number;
}

/**
 * Camera positions for non-zone states.
 *
 * HERO_CAMERA: Pulled-back landing page view.
 * CENTER_CAMERA: Inside room, surveying all four zones.
 *
 * Room is 14 wide × 10 deep × 4.5 tall, centered at [0, 0, -5].
 */
export const HERO_CAMERA = {
  position: [0, 2.8, 9] as [number, number, number],
  lookAt: [0, 1, -4] as [number, number, number],
};

export const CENTER_CAMERA = {
  position: [0, 2.2, 3] as [number, number, number],
  lookAt: [0, 0.8, -5] as [number, number, number],
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
    label: "Lash Extensions",
    subtitle: "Precision. Patience. Artistry.",
    heading: "Lash Extensions",
    description:
      "Full sets, fills, and removals — each appointment structured around technique and care. Classic, hybrid, and volume sets tailored to your eye shape and lifestyle.",
    cta: { label: "Book Appointment", href: "#booking" },
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
    subtitle: "Welded. Worn. Kept.",
    heading: "Permanent Jewelry",
    description:
      "14k gold-filled and sterling silver chains, custom-fit and welded on. No clasp. Bracelets, anklets, and necklaces sized to you and sealed with intention.",
    cta: { label: "Book Session", href: "#booking" },
    color: "#D4A574",
    cameraPosition: [2.2, 2.0, -0.3],
    cameraLookAt: [4, 0.6, -2.5],
    pedestalPosition: [4, 0, -2.5],
    platformSize: [2.8, 2.4],
    labelHeight: 2.2,
  },
  crochet: {
    id: "crochet",
    label: "Crochet Marketplace",
    subtitle: "Handmade. Made to order.",
    heading: "Custom Crochet",
    description:
      "Handcrafted crochet pieces — bags, accessories, home goods, and custom commissions. Each item made to order with care and precision.",
    cta: { label: "Browse Collection", href: "#marketplace" },
    color: "#7BA3A3",
    cameraPosition: [2.2, 2.0, -5],
    cameraLookAt: [4, 0.6, -7.5],
    pedestalPosition: [4, 0, -7.5],
    platformSize: [2.8, 2.4],
    labelHeight: 2.2,
  },
  consulting: {
    id: "consulting",
    label: "HR & Consulting",
    subtitle: "Structure. Clarity. Growth.",
    heading: "HR & Business Consulting",
    description:
      "Operational strategy, HR infrastructure, and business consulting for small businesses and creative entrepreneurs. Systems that work so you can focus on the work.",
    cta: { label: "Request Consultation", href: "#consulting" },
    color: "#5B8A8A",
    cameraPosition: [-2.2, 2.0, -0.3],
    cameraLookAt: [-4, 0.6, -2.5],
    pedestalPosition: [-4, 0, -2.5],
    platformSize: [2.8, 2.4],
    labelHeight: 2.2,
  },
};

export const ZONE_ORDER = [
  "lash",
  "jewelry",
  "crochet",
  "consulting",
] as const satisfies readonly ZoneId[];
