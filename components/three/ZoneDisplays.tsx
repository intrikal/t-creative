"use client";

/**
 * ZoneDisplays — Realistic 3D display objects for each business zone.
 *
 * Each display is built from primitive geometries (no GLTF imports)
 * styled to suggest real furniture and equipment at realistic scale.
 * Units ≈ meters. The lash zone is the visual centerpiece.
 *
 * ┌─────────────────────────────────────────────────┐
 * │ SCALE REFERENCE (1 unit ≈ 1 meter):             │
 * │                                                 │
 * │ • Lash bed:       2.0 × 0.7 × 0.55             │
 * │ • Desk:           1.5 × 0.7 × 0.75             │
 * │ • Chair seat:     0.45 high                     │
 * │ • Ring light:     0.45 diameter, 1.8 tall stand │
 * │ • Bookshelf:      0.9 × 0.3 × 1.4              │
 * └─────────────────────────────────────────────────┘
 */

import { Float } from "@react-three/drei";

// ════════════════════════════════════════════
// COLOR PALETTE — shared across zones
// ════════════════════════════════════════════
const CREAM = "#E8DFD0";
const WARM_WHITE = "#FAF6F1";
const DARK_FRAME = "#2C2420";
const WOOD_LIGHT = "#C4A882";
const WOOD_MED = "#B8986A";
const GOLD = "#D4A574";
const SILVER = "#C0C0C0";
const TEAL = "#5B8A8A";
const BLUSH = "#E8C4B8";
const LASH_PINK = "#C4907A";

// ════════════════════════════════════════════
// LASH EXTENSIONS — Treatment bed, vanity,
// ring light, rolling cart, supplies
// (Visual centerpiece of the studio)
// ════════════════════════════════════════════
export function LashDisplay() {
  return (
    <group>
      {/* ── LASH BED / TREATMENT CHAIR ──
          The hero piece — a padded reclining bed.
          2.0m long × 0.7m wide, ~0.55m seat height */}
      <group position={[0, 0, 0.15]}>
        {/* Bed base / frame — dark metal legs */}
        <mesh position={[0, 0.2, 0]}>
          <boxGeometry args={[0.65, 0.04, 1.9]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Base legs — 4 cylindrical feet */}
        {[
          [-0.25, 0.1, -0.8],
          [0.25, 0.1, -0.8],
          [-0.25, 0.1, 0.8],
          [0.25, 0.1, 0.8],
        ].map((pos, i) => (
          <mesh key={`lash-leg-${i}`} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.025, 0.03, 0.2, 8]} />
            <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.4} />
          </mesh>
        ))}
        {/* Main cushion — thick padded top */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.6, 0.12, 1.8]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.9} metalness={0} />
        </mesh>
        {/* Padded bolster / pillow section at headrest end */}
        <mesh position={[0, 0.34, -0.75]}>
          <boxGeometry args={[0.5, 0.08, 0.35]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.95} metalness={0} />
        </mesh>
        {/* Raised headrest wedge */}
        <mesh position={[0, 0.38, -0.88]} rotation={[-0.15, 0, 0]}>
          <boxGeometry args={[0.45, 0.06, 0.2]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.9} metalness={0} />
        </mesh>
        {/* Thin blanket/cover draped on lower section */}
        <mesh position={[0, 0.37, 0.4]}>
          <boxGeometry args={[0.58, 0.015, 0.8]} />
          <meshStandardMaterial color={BLUSH} roughness={0.95} metalness={0} />
        </mesh>
      </group>

      {/* ── RING LIGHT ON STAND ──
          Tall adjustable stand with circular LED ring.
          Positioned at the head of the lash bed */}
      <group position={[-0.6, 0, -0.6]}>
        {/* Tripod base — three small feet */}
        {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((angle, i) => (
          <mesh
            key={`tripod-${i}`}
            position={[Math.sin(angle) * 0.15, 0.02, Math.cos(angle) * 0.15]}
            rotation={[0, angle, Math.PI / 12]}
          >
            <boxGeometry args={[0.02, 0.04, 0.18]} />
            <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
        {/* Vertical pole */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.015, 0.018, 1.7, 8]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Ring light — torus at top */}
        <mesh position={[0.15, 1.7, 0.1]} rotation={[0.3, 0.2, 0]}>
          <torusGeometry args={[0.22, 0.025, 12, 48]} />
          <meshStandardMaterial
            color="#FFFFFF"
            roughness={0.2}
            metalness={0.3}
            emissive="#FFF5EB"
            emissiveIntensity={0.6}
          />
        </mesh>
        {/* Gooseneck arm connecting pole to ring */}
        <mesh position={[0.08, 1.65, 0.05]} rotation={[0.15, 0.1, 0.4]}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 6]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.5} />
        </mesh>
      </group>

      {/* ── VANITY / SIDE TABLE + MIRROR ──
          To the right of the lash bed */}
      <group position={[0.7, 0, -0.4]}>
        {/* Table surface */}
        <mesh position={[0, 0.72, 0]}>
          <boxGeometry args={[0.8, 0.04, 0.45]} />
          <meshStandardMaterial color={CREAM} roughness={0.6} metalness={0.05} />
        </mesh>
        {/* Table legs */}
        {[
          [-0.35, 0.36, -0.18],
          [0.35, 0.36, -0.18],
          [-0.35, 0.36, 0.18],
          [0.35, 0.36, 0.18],
        ].map((pos, i) => (
          <mesh key={`vanity-leg-${i}`} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.02, 0.025, 0.72, 8]} />
            <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.2} />
          </mesh>
        ))}
        {/* Lighted vanity mirror — large oval */}
        <mesh position={[0, 1.1, -0.2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.35, 6]} />
          <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Mirror glass */}
        <mesh position={[0, 1.35, -0.22]} rotation={[0.1, 0, 0]}>
          <circleGeometry args={[0.2, 32]} />
          <meshStandardMaterial
            color="#FFFFFF"
            roughness={0.05}
            metalness={0.9}
            emissive="#F5E6D3"
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Mirror frame — gold ring with LED glow */}
        <mesh position={[0, 1.35, -0.225]} rotation={[0.1, 0, 0]}>
          <ringGeometry args={[0.2, 0.23, 32]} />
          <meshStandardMaterial
            color={GOLD}
            roughness={0.3}
            metalness={0.5}
            emissive="#FFF5EB"
            emissiveIntensity={0.15}
          />
        </mesh>

        {/* ── Supplies on vanity surface ── */}
        {/* Glue bottle */}
        <mesh position={[-0.25, 0.78, 0.05]}>
          <cylinderGeometry args={[0.015, 0.012, 0.08, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Glue bottle cap */}
        <mesh position={[-0.25, 0.825, 0.05]}>
          <cylinderGeometry args={[0.008, 0.015, 0.02, 8]} />
          <meshStandardMaterial color={LASH_PINK} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Second glue bottle */}
        <mesh position={[-0.18, 0.78, 0.1]}>
          <cylinderGeometry args={[0.012, 0.01, 0.07, 8]} />
          <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.3} />
        </mesh>
        {/* Tweezers — straight pair */}
        <mesh position={[0.15, 0.755, 0.08]} rotation={[0, 0.5, 0]}>
          <boxGeometry args={[0.12, 0.006, 0.012]} />
          <meshStandardMaterial color="#888888" roughness={0.2} metalness={0.8} />
        </mesh>
        {/* Tweezers — curved pair */}
        <mesh position={[0.2, 0.755, 0.02]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.11, 0.006, 0.012]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.2} metalness={0.7} />
        </mesh>
        {/* Lash tile / palette — flat black pad */}
        <mesh position={[0, 0.75, 0.1]}>
          <boxGeometry args={[0.12, 0.008, 0.08]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.1} />
        </mesh>
        {/* Mascara wand container */}
        <mesh position={[0.3, 0.78, -0.05]}>
          <cylinderGeometry args={[0.025, 0.025, 0.09, 12]} />
          <meshStandardMaterial color={BLUSH} roughness={0.7} metalness={0} />
        </mesh>
      </group>

      {/* ── ROLLING CART ──
          Small tiered cart with supplies, next to the bed */}
      <group position={[0.65, 0, 0.5]}>
        {/* Cart frame — vertical poles */}
        {[
          [-0.15, 0.35, -0.12],
          [0.15, 0.35, -0.12],
          [-0.15, 0.35, 0.12],
          [0.15, 0.35, 0.12],
        ].map((pos, i) => (
          <mesh key={`cart-pole-${i}`} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.008, 0.008, 0.7, 6]} />
            <meshStandardMaterial color="#AAAAAA" roughness={0.3} metalness={0.6} />
          </mesh>
        ))}
        {/* Bottom tray */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.28]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Middle tray */}
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.28]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Top tray */}
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[0.35, 0.02, 0.28]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Wheels — 4 tiny spheres */}
        {[
          [-0.12, 0.015, -0.1],
          [0.12, 0.015, -0.1],
          [-0.12, 0.015, 0.1],
          [0.12, 0.015, 0.1],
        ].map((pos, i) => (
          <mesh key={`wheel-${i}`} position={pos as [number, number, number]}>
            <sphereGeometry args={[0.015, 8, 8]} />
            <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
        {/* Under-eye pads box on middle tray */}
        <mesh position={[-0.05, 0.38, 0]}>
          <boxGeometry args={[0.1, 0.03, 0.08]} />
          <meshStandardMaterial color={LASH_PINK} roughness={0.8} metalness={0} />
        </mesh>
        {/* Small bottle on top tray */}
        <mesh position={[0.08, 0.66, 0.04]}>
          <cylinderGeometry args={[0.012, 0.01, 0.06, 8]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.5} metalness={0.1} />
        </mesh>
      </group>

      {/* ── TECHNICIAN STOOL ──
          Adjustable-height round stool with wheels */}
      <group position={[-0.55, 0, 0.6]}>
        {/* Seat — round padded */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.06, 24]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.85} metalness={0} />
        </mesh>
        {/* Hydraulic pole */}
        <mesh position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.45, 8]} />
          <meshStandardMaterial color="#777777" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Star base */}
        {[0, 1.256, 2.513, 3.77, 5.027].map((angle, i) => (
          <mesh
            key={`stool-foot-${i}`}
            position={[Math.sin(angle) * 0.12, 0.025, Math.cos(angle) * 0.12]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.03, 0.02, 0.15]} />
            <meshStandardMaterial color="#777777" roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ════════════════════════════════════════════
// PERMANENT JEWELRY — Display pedestal +
// artisan workbench with torch & tools
// ════════════════════════════════════════════
export function JewelryDisplay() {
  return (
    <group>
      {/* ── DISPLAY PEDESTAL with glass dome ──
          Finished jewelry showcase — front of zone */}
      <group position={[0.5, 0, -0.4]}>
        {/* Column pedestal */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.18, 0.22, 0.9, 24]} />
          <meshStandardMaterial color={CREAM} roughness={0.6} metalness={0.05} />
        </mesh>
        {/* Display platform under dome */}
        <mesh position={[0, 0.92, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 0.04, 24]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.1} />
        </mesh>
        {/* Glass dome */}
        <mesh position={[0, 1.1, 0]}>
          <sphereGeometry args={[0.28, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#FFFFFF"
            roughness={0.05}
            metalness={0.1}
            transparent
            opacity={0.12}
          />
        </mesh>
        {/* Chain bracelet — floating gold */}
        <Float speed={1} floatIntensity={0.06} rotationIntensity={0.015}>
          <mesh position={[0, 1.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.12, 0.01, 12, 48]} />
            <meshStandardMaterial
              color={GOLD}
              roughness={0.2}
              metalness={0.8}
              emissive={GOLD}
              emissiveIntensity={0.1}
            />
          </mesh>
        </Float>
        {/* Necklace — silver */}
        <mesh position={[0.04, 1.0, 0.03]} rotation={[Math.PI / 2, 0, 0.3]}>
          <torusGeometry args={[0.08, 0.006, 12, 48]} />
          <meshStandardMaterial color={SILVER} roughness={0.15} metalness={0.9} />
        </mesh>
        {/* Anklet — rose gold */}
        <mesh position={[-0.03, 0.98, -0.02]} rotation={[Math.PI / 2.5, 0.2, -0.15]}>
          <torusGeometry args={[0.06, 0.004, 12, 48]} />
          <meshStandardMaterial color="#E8B4A0" roughness={0.2} metalness={0.85} />
        </mesh>
      </group>

      {/* ── JEWELER'S WORKBENCH ──
          Compact artisan workspace with tools */}
      <group position={[-0.45, 0, 0.2]}>
        {/* Workbench surface — sturdy wood top */}
        <mesh position={[0, 0.75, 0]}>
          <boxGeometry args={[1.1, 0.05, 0.55]} />
          <meshStandardMaterial color={WOOD_MED} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Bench legs — thick wooden */}
        {[
          [-0.45, 0.375, -0.2],
          [0.45, 0.375, -0.2],
          [-0.45, 0.375, 0.2],
          [0.45, 0.375, 0.2],
        ].map((pos, i) => (
          <mesh key={`bench-leg-${i}`} position={pos as [number, number, number]}>
            <boxGeometry args={[0.06, 0.75, 0.06]} />
            <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} metalness={0.05} />
          </mesh>
        ))}
        {/* Bottom shelf/stretcher */}
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.9, 0.03, 0.4]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.75} metalness={0.05} />
        </mesh>

        {/* ── Tools on bench surface ── */}
        {/* Small butane torch */}
        <mesh position={[0.35, 0.82, 0.1]} rotation={[0, -0.4, 0]}>
          <cylinderGeometry args={[0.02, 0.025, 0.12, 8]} />
          <meshStandardMaterial color="#3366AA" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Torch nozzle */}
        <mesh position={[0.35, 0.89, 0.1]} rotation={[0.3, -0.4, 0]}>
          <cylinderGeometry args={[0.005, 0.008, 0.04, 6]} />
          <meshStandardMaterial color="#AAAAAA" roughness={0.2} metalness={0.7} />
        </mesh>
        {/* Wire spool — gold */}
        <mesh position={[-0.3, 0.82, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.04, 0.015, 8, 24]} />
          <meshStandardMaterial color={GOLD} roughness={0.3} metalness={0.7} />
        </mesh>
        {/* Wire spool — silver */}
        <mesh position={[-0.2, 0.82, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.012, 8, 24]} />
          <meshStandardMaterial color={SILVER} roughness={0.2} metalness={0.8} />
        </mesh>
        {/* Pliers / flat tool */}
        <mesh position={[0.1, 0.79, 0.05]} rotation={[0, 0.8, 0]}>
          <boxGeometry args={[0.14, 0.012, 0.025]} />
          <meshStandardMaterial color="#555555" roughness={0.25} metalness={0.7} />
        </mesh>
        {/* Round-nose pliers */}
        <mesh position={[0.05, 0.79, -0.08]} rotation={[0, -0.5, 0]}>
          <boxGeometry args={[0.13, 0.012, 0.02]} />
          <meshStandardMaterial color="#444444" roughness={0.25} metalness={0.7} />
        </mesh>
        {/* Small bead tray */}
        <mesh position={[-0.05, 0.79, 0.15]}>
          <boxGeometry args={[0.1, 0.015, 0.06]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.8} metalness={0} />
        </mesh>

        {/* ── Magnifying lamp on arm ── */}
        {/* Clamp base */}
        <mesh position={[-0.5, 0.82, 0]}>
          <boxGeometry args={[0.06, 0.06, 0.04]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Arm */}
        <mesh position={[-0.45, 1.1, 0]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.008, 0.008, 0.55, 6]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Magnifying lens head */}
        <mesh position={[-0.38, 1.35, 0]} rotation={[0.3, 0, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.025, 16]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Lens glass */}
        <mesh position={[-0.38, 1.35, 0.015]} rotation={[0.3, 0, 0]}>
          <circleGeometry args={[0.055, 16]} />
          <meshStandardMaterial
            color="#FFFFFF"
            roughness={0.05}
            metalness={0.1}
            transparent
            opacity={0.2}
            emissive="#FFF5EB"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>

      {/* ── PEGBOARD (behind bench) ── */}
      <group position={[-0.45, 0, -0.35]}>
        <mesh position={[0, 1.1, 0]}>
          <boxGeometry args={[0.9, 0.7, 0.03]} />
          <meshStandardMaterial color="#D4C4A8" roughness={0.85} metalness={0} />
        </mesh>
        {/* Hooks with hanging tools — represented as small cylinders */}
        {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
          <group key={`peg-${i}`}>
            <mesh position={[x, 1.2, 0.02]}>
              <cylinderGeometry args={[0.006, 0.006, 0.05, 6]} />
              <meshStandardMaterial color="#888888" roughness={0.3} metalness={0.6} />
            </mesh>
            {/* Hanging tool silhouettes */}
            {i % 2 === 0 && (
              <mesh position={[x, 1.05, 0.03]} rotation={[0, 0, 0.1 * (i - 2)]}>
                <boxGeometry args={[0.015, 0.2, 0.01]} />
                <meshStandardMaterial color="#666666" roughness={0.3} metalness={0.6} />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* Safety glasses on bench corner */}
      <mesh position={[0.05, 0.79, 0.35]} rotation={[Math.PI / 2, 0, 0.2]}>
        <torusGeometry args={[0.035, 0.005, 6, 16, Math.PI]} />
        <meshStandardMaterial color="#444444" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

// ════════════════════════════════════════════
// CROCHET MARKETPLACE — Tall shelf, dress
// form, armchair, yarn baskets
// ════════════════════════════════════════════
export function CrochetDisplay() {
  return (
    <group>
      {/* ── TALL DISPLAY SHELF ──
          Three-tier open bookshelf loaded with yarn and finished goods.
          1.2W × 0.4D × 1.5H */}
      <group position={[-0.35, 0, -0.5]}>
        {/* Shelf sides */}
        <mesh position={[-0.58, 0.75, 0]}>
          <boxGeometry args={[0.04, 1.5, 0.4]} />
          <meshStandardMaterial color={WOOD_MED} roughness={0.7} />
        </mesh>
        <mesh position={[0.58, 0.75, 0]}>
          <boxGeometry args={[0.04, 1.5, 0.4]} />
          <meshStandardMaterial color={WOOD_MED} roughness={0.7} />
        </mesh>
        {/* Shelf back */}
        <mesh position={[0, 0.75, -0.18]}>
          <boxGeometry args={[1.2, 1.5, 0.02]} />
          <meshStandardMaterial color="#D4C4A8" roughness={0.85} />
        </mesh>
        {/* Bottom shelf */}
        <mesh position={[0, 0.08, 0]}>
          <boxGeometry args={[1.12, 0.04, 0.38]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} />
        </mesh>
        {/* Lower-middle shelf */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1.12, 0.04, 0.38]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} />
        </mesh>
        {/* Upper-middle shelf */}
        <mesh position={[0, 0.95, 0]}>
          <boxGeometry args={[1.12, 0.04, 0.38]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} />
        </mesh>
        {/* Top shelf */}
        <mesh position={[0, 1.4, 0]}>
          <boxGeometry args={[1.12, 0.04, 0.38]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} />
        </mesh>

        {/* ── Yarn balls — varied sizes and colors ── */}
        {/* Bottom shelf: bigger yarn balls */}
        <YarnBall position={[-0.35, 0.2, 0.05]} color={LASH_PINK} size={0.1} />
        <YarnBall position={[-0.12, 0.2, 0.08]} color="#7BA3A3" size={0.1} />
        <YarnBall position={[0.12, 0.2, 0.03]} color={BLUSH} size={0.1} />
        <YarnBall position={[0.35, 0.2, 0.06]} color="#B8A090" size={0.1} />

        {/* Lower-middle shelf */}
        <YarnBall position={[-0.3, 0.62, 0.05]} color="#E8B4A0" size={0.09} />
        <YarnBall position={[-0.08, 0.62, 0.08]} color={GOLD} size={0.09} />
        <YarnBall position={[0.15, 0.62, 0.03]} color="#9AB8B8" size={0.09} />
        <YarnBall position={[0.38, 0.62, 0.06]} color="#D4A0A0" size={0.09} />

        {/* Upper-middle shelf: folded items + yarn */}
        <YarnBall position={[-0.35, 1.07, 0.05]} color="#C4907A" size={0.08} />
        <YarnBall position={[-0.12, 1.07, 0.08]} color="#7BA3A3" size={0.08} />
        {/* Folded crocheted item */}
        <mesh position={[0.2, 1.02, 0.02]}>
          <boxGeometry args={[0.2, 0.08, 0.18]} />
          <meshStandardMaterial color={BLUSH} roughness={0.95} metalness={0} />
        </mesh>
        {/* Another folded item */}
        <mesh position={[0.4, 1.02, 0.02]}>
          <boxGeometry args={[0.15, 0.06, 0.15]} />
          <meshStandardMaterial color="#9AB8B8" roughness={0.95} metalness={0} />
        </mesh>

        {/* Top shelf: finished bags */}
        {/* Crocheted bag */}
        <mesh position={[-0.25, 1.48, 0]}>
          <boxGeometry args={[0.18, 0.14, 0.1]} />
          <meshStandardMaterial color={LASH_PINK} roughness={0.95} metalness={0} />
        </mesh>
        {/* Bag strap */}
        <mesh position={[-0.25, 1.58, 0]} rotation={[0, 0, 0.1]}>
          <torusGeometry args={[0.05, 0.008, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#B8A090" roughness={0.8} />
        </mesh>
        <YarnBall position={[0.1, 1.52, 0.05]} color={GOLD} size={0.07} />
        <YarnBall position={[0.3, 1.52, 0.03]} color="#B8A090" size={0.07} />
      </group>

      {/* ── DRESS FORM / MANNEQUIN ──
          Displaying a crocheted shawl/vest */}
      <group position={[0.6, 0, -0.2]}>
        {/* Stand base */}
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.15, 0.18, 0.04, 16]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.3} />
        </mesh>
        {/* Stand pole */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[0.015, 0.018, 0.65, 8]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.3} />
        </mesh>
        {/* Torso — tapered cylinder */}
        <mesh position={[0, 0.95, 0]}>
          <cylinderGeometry args={[0.12, 0.16, 0.6, 12]} />
          <meshStandardMaterial color={CREAM} roughness={0.8} metalness={0} />
        </mesh>
        {/* Bust area — slight widening */}
        <mesh position={[0, 1.1, 0.03]}>
          <sphereGeometry args={[0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={CREAM} roughness={0.8} metalness={0} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.04, 0.06, 0.08, 8]} />
          <meshStandardMaterial color={CREAM} roughness={0.8} metalness={0} />
        </mesh>
        {/* Crocheted shawl/vest draped on form — simulated as slightly larger shell */}
        <mesh position={[0, 1.0, 0.01]}>
          <cylinderGeometry args={[0.14, 0.19, 0.5, 12, 1, true]} />
          <meshStandardMaterial
            color="#7BA3A3"
            roughness={0.95}
            metalness={0}
            transparent
            opacity={0.9}
            side={2}
          />
        </mesh>
      </group>

      {/* ── COZY ARMCHAIR ──
          With a half-finished project draped on it */}
      <group position={[0.4, 0, 0.55]}>
        {/* Seat cushion */}
        <mesh position={[0, 0.3, 0]}>
          <boxGeometry args={[0.6, 0.12, 0.55]} />
          <meshStandardMaterial color="#D4C4B0" roughness={0.9} metalness={0} />
        </mesh>
        {/* Chair back */}
        <mesh position={[0, 0.6, -0.25]}>
          <boxGeometry args={[0.6, 0.55, 0.1]} />
          <meshStandardMaterial color="#D4C4B0" roughness={0.9} metalness={0} />
        </mesh>
        {/* Left armrest */}
        <mesh position={[-0.3, 0.42, 0]}>
          <boxGeometry args={[0.08, 0.15, 0.5]} />
          <meshStandardMaterial color="#C4B4A0" roughness={0.9} metalness={0} />
        </mesh>
        {/* Right armrest */}
        <mesh position={[0.3, 0.42, 0]}>
          <boxGeometry args={[0.08, 0.15, 0.5]} />
          <meshStandardMaterial color="#C4B4A0" roughness={0.9} metalness={0} />
        </mesh>
        {/* Chair legs — short wooden */}
        {[
          [-0.25, 0.1, -0.2],
          [0.25, 0.1, -0.2],
          [-0.25, 0.1, 0.2],
          [0.25, 0.1, 0.2],
        ].map((pos, i) => (
          <mesh key={`arm-leg-${i}`} position={pos as [number, number, number]}>
            <cylinderGeometry args={[0.025, 0.025, 0.2, 8]} />
            <meshStandardMaterial color={WOOD_LIGHT} roughness={0.6} metalness={0.1} />
          </mesh>
        ))}
        {/* Half-finished crochet project draped on seat */}
        <mesh position={[0.05, 0.4, 0.05]}>
          <boxGeometry args={[0.3, 0.03, 0.25]} />
          <meshStandardMaterial color={LASH_PINK} roughness={0.95} metalness={0} />
        </mesh>
        {/* Crochet hook on top */}
        <mesh position={[0.15, 0.43, 0.1]} rotation={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.004, 0.003, 0.15, 6]} />
          <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.3} />
        </mesh>
      </group>

      {/* ── YARN BASKET ──
          Woven basket at the foot of the armchair */}
      <group position={[0.1, 0, 0.65]}>
        {/* Basket body — short wide cylinder */}
        <mesh position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.18, 0.15, 0.22, 16]} />
          <meshStandardMaterial color="#C4A882" roughness={0.85} metalness={0} />
        </mesh>
        {/* Yarn balls spilling out of basket */}
        <YarnBall position={[-0.05, 0.28, 0.02]} color="#E8B4A0" size={0.07} />
        <YarnBall position={[0.06, 0.26, -0.04]} color="#7BA3A3" size={0.065} />
        <YarnBall position={[0.02, 0.3, 0.08]} color={GOLD} size={0.06} />
      </group>
    </group>
  );
}

function YarnBall({
  position,
  color,
  size = 0.08,
}: {
  position: [number, number, number];
  color: string;
  size?: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
    </mesh>
  );
}

// ════════════════════════════════════════════
// HR & CONSULTING — Professional desk, ergo
// chair, bookshelf, dual monitors, plant
// ════════════════════════════════════════════
export function ConsultingDisplay() {
  return (
    <group>
      {/* ── DESK ──
          Wide professional desk, 1.4W × 0.65D × 0.75H */}
      <group position={[0, 0, -0.2]}>
        {/* Desk surface */}
        <mesh position={[0, 0.73, 0]}>
          <boxGeometry args={[1.4, 0.04, 0.65]} />
          <meshStandardMaterial color={CREAM} roughness={0.6} metalness={0.05} />
        </mesh>
        {/* Desk legs — four slim metal */}
        {[
          [-0.62, 0.365, -0.26],
          [0.62, 0.365, -0.26],
          [-0.62, 0.365, 0.26],
          [0.62, 0.365, 0.26],
        ].map((pos, i) => (
          <mesh key={`desk-leg-${i}`} position={pos as [number, number, number]}>
            <boxGeometry args={[0.04, 0.73, 0.04]} />
            <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.4} />
          </mesh>
        ))}
        {/* Modesty panel — front panel */}
        <mesh position={[0, 0.4, 0.3]}>
          <boxGeometry args={[1.3, 0.6, 0.02]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} metalness={0.05} />
        </mesh>

        {/* ── On desk: laptop + second monitor ── */}
        {/* Laptop base */}
        <mesh position={[-0.2, 0.78, 0.05]}>
          <boxGeometry args={[0.35, 0.015, 0.24]} />
          <meshStandardMaterial color="#4A4A4A" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Laptop screen */}
        <mesh position={[-0.2, 0.91, -0.07]} rotation={[-0.2, 0, 0]}>
          <boxGeometry args={[0.35, 0.22, 0.008]} />
          <meshStandardMaterial color="#3A3A3A" roughness={0.2} metalness={0.4} />
        </mesh>
        {/* Laptop screen glow */}
        <mesh position={[-0.2, 0.91, -0.066]} rotation={[-0.2, 0, 0]}>
          <planeGeometry args={[0.3, 0.17]} />
          <meshStandardMaterial
            color="#B8D8D8"
            emissive="#B8D8D8"
            emissiveIntensity={0.25}
            roughness={1}
          />
        </mesh>

        {/* Second monitor — larger, on stand */}
        <mesh position={[0.3, 0.78, -0.15]}>
          <boxGeometry args={[0.06, 0.04, 0.06]} />
          <meshStandardMaterial color="#4A4A4A" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Monitor arm */}
        <mesh position={[0.3, 0.9, -0.15]}>
          <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
          <meshStandardMaterial color="#4A4A4A" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Monitor screen */}
        <mesh position={[0.3, 1.1, -0.16]} rotation={[-0.08, 0, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.015]} />
          <meshStandardMaterial color="#2A2A2A" roughness={0.2} metalness={0.4} />
        </mesh>
        {/* Monitor screen glow */}
        <mesh position={[0.3, 1.1, -0.15]} rotation={[-0.08, 0, 0]}>
          <planeGeometry args={[0.45, 0.25]} />
          <meshStandardMaterial
            color="#D4E8E8"
            emissive="#D4E8E8"
            emissiveIntensity={0.2}
            roughness={1}
          />
        </mesh>

        {/* Coffee cup */}
        <mesh position={[0.55, 0.79, 0.15]}>
          <cylinderGeometry args={[0.035, 0.03, 0.08, 12]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.7} />
        </mesh>
        {/* Cup handle */}
        <mesh position={[0.585, 0.79, 0.15]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.02, 0.005, 6, 12, Math.PI]} />
          <meshStandardMaterial color={WARM_WHITE} roughness={0.7} />
        </mesh>

        {/* Stack of papers / notebook */}
        <mesh position={[-0.5, 0.77, 0.15]}>
          <boxGeometry args={[0.2, 0.025, 0.28]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.95} />
        </mesh>
        {/* Pen on papers */}
        <mesh position={[-0.45, 0.79, 0.12]} rotation={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.004, 0.004, 0.14, 6]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.3} metalness={0.3} />
        </mesh>

        {/* Small potted plant on desk */}
        <mesh position={[0.58, 0.78, -0.18]}>
          <cylinderGeometry args={[0.04, 0.035, 0.06, 8]} />
          <meshStandardMaterial color="#D4C4A8" roughness={0.8} metalness={0} />
        </mesh>
        {/* Plant foliage — cluster of small spheres */}
        <mesh position={[0.58, 0.86, -0.18]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#6B8B6B" roughness={0.9} metalness={0} />
        </mesh>
        <mesh position={[0.56, 0.84, -0.16]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#7B9B7B" roughness={0.9} metalness={0} />
        </mesh>
      </group>

      {/* ── ERGONOMIC OFFICE CHAIR ──
          Modern task chair with headrest */}
      <group position={[0, 0, 0.55]}>
        {/* Star base with casters */}
        {[0, 1.256, 2.513, 3.77, 5.027].map((angle, i) => (
          <mesh
            key={`chair-base-${i}`}
            position={[Math.sin(angle) * 0.2, 0.04, Math.cos(angle) * 0.2]}
            rotation={[0, angle, 0]}
          >
            <boxGeometry args={[0.04, 0.03, 0.22]} />
            <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.5} />
          </mesh>
        ))}
        {/* Casters */}
        {[0, 1.256, 2.513, 3.77, 5.027].map((angle, i) => (
          <mesh
            key={`caster-${i}`}
            position={[Math.sin(angle) * 0.28, 0.02, Math.cos(angle) * 0.28]}
          >
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#333333" roughness={0.3} metalness={0.4} />
          </mesh>
        ))}
        {/* Hydraulic cylinder */}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.4, 8]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.5} />
        </mesh>
        {/* Seat */}
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[0.48, 0.06, 0.45]} />
          <meshStandardMaterial color={TEAL} roughness={0.85} metalness={0} />
        </mesh>
        {/* Back — curved suggestion */}
        <mesh position={[0, 0.75, -0.2]}>
          <boxGeometry args={[0.44, 0.5, 0.05]} />
          <meshStandardMaterial color={TEAL} roughness={0.85} metalness={0} />
        </mesh>
        {/* Headrest */}
        <mesh position={[0, 1.08, -0.2]}>
          <boxGeometry args={[0.28, 0.12, 0.05]} />
          <meshStandardMaterial color={TEAL} roughness={0.85} metalness={0} />
        </mesh>
        {/* Armrests */}
        <mesh position={[-0.25, 0.58, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.25]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0.25, 0.58, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.25]} />
          <meshStandardMaterial color="#555555" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Armrest pads */}
        <mesh position={[-0.25, 0.61, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.2]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.7} metalness={0} />
        </mesh>
        <mesh position={[0.25, 0.61, 0]}>
          <boxGeometry args={[0.06, 0.02, 0.2]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.7} metalness={0} />
        </mesh>
      </group>

      {/* ── BOOKSHELF / CREDENZA ──
          Behind the desk, along the back */}
      <group position={[0.7, 0, -0.75]}>
        {/* Shelf body */}
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.8, 1.2, 0.3]} />
          <meshStandardMaterial color={WOOD_LIGHT} roughness={0.7} metalness={0.05} />
        </mesh>
        {/* Shelf dividers (3 shelves) */}
        {[0.3, 0.6, 0.9].map((y, i) => (
          <mesh key={`shelf-div-${i}`} position={[0, y, 0.01]}>
            <boxGeometry args={[0.76, 0.02, 0.28]} />
            <meshStandardMaterial color={WOOD_MED} roughness={0.7} metalness={0.05} />
          </mesh>
        ))}
        {/* Books — varied heights and colors */}
        {/* Bottom shelf books */}
        <mesh position={[-0.2, 0.18, 0.02]}>
          <boxGeometry args={[0.06, 0.22, 0.15]} />
          <meshStandardMaterial color={TEAL} roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[-0.12, 0.17, 0.02]}>
          <boxGeometry args={[0.04, 0.2, 0.15]} />
          <meshStandardMaterial color={LASH_PINK} roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[-0.05, 0.18, 0.02]}>
          <boxGeometry args={[0.05, 0.22, 0.15]} />
          <meshStandardMaterial color={GOLD} roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[0.05, 0.16, 0.02]}>
          <boxGeometry args={[0.06, 0.18, 0.15]} />
          <meshStandardMaterial color="#7BA3A3" roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[0.15, 0.17, 0.02]}>
          <boxGeometry args={[0.04, 0.2, 0.15]} />
          <meshStandardMaterial color={DARK_FRAME} roughness={0.8} metalness={0} />
        </mesh>
        {/* Middle shelf — notebooks + small object */}
        <mesh position={[-0.15, 0.48, 0.02]}>
          <boxGeometry args={[0.05, 0.18, 0.14]} />
          <meshStandardMaterial color="#B8A090" roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[-0.06, 0.47, 0.02]}>
          <boxGeometry args={[0.06, 0.16, 0.14]} />
          <meshStandardMaterial color={BLUSH} roughness={0.8} metalness={0} />
        </mesh>
        {/* Small motivational frame */}
        <mesh position={[0.15, 0.45, 0.05]}>
          <boxGeometry args={[0.12, 0.1, 0.02]} />
          <meshStandardMaterial color={GOLD} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Top shelf — plant + books */}
        <mesh position={[-0.1, 0.78, 0.02]}>
          <boxGeometry args={[0.05, 0.16, 0.14]} />
          <meshStandardMaterial color={TEAL} roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[-0.02, 0.77, 0.02]}>
          <boxGeometry args={[0.04, 0.14, 0.14]} />
          <meshStandardMaterial color="#9AB8B8" roughness={0.8} metalness={0} />
        </mesh>
        {/* Small plant on top shelf */}
        <mesh position={[0.2, 0.73, 0.02]}>
          <cylinderGeometry args={[0.035, 0.03, 0.05, 8]} />
          <meshStandardMaterial color="#D4C4A8" roughness={0.8} metalness={0} />
        </mesh>
        <mesh position={[0.2, 0.8, 0.02]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#6B8B6B" roughness={0.9} metalness={0} />
        </mesh>
      </group>
    </group>
  );
}
